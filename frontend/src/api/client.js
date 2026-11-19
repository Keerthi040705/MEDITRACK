/**
 * API client for the Express backend.
 *
 * - Development: React runs on :5173 and Vite proxies "/api" to http://localhost:5000.
 * - Production:  Express serves the built React app, so "/api" is the same origin.
 * - Set VITE_API_URL (e.g. http://192.168.1.10:5000) only if the backend is elsewhere.
 *
 * There is NO fake/offline fallback: every failure is shown to the user.
 */
const API_BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/api`;

export class ApiError extends Error {
  constructor(message, { status = 0, network = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.network = network;
  }
}

// ---- auth token + 401 handling ----
let authToken = null;
let unauthorizedHandler = null;
export const setAuthToken = (token) => { authToken = token || null; };
export const setUnauthorizedHandler = (fn) => { unauthorizedHandler = fn; };

// ---- tiny connection-status store (used by <ConnectionBanner/>) ----
const listeners = new Set();
let connection = { backend: null, database: null, aiService: null };
export const getConnection = () => connection;
export function subscribeConnection(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setConnection(patch) {
  const next = { ...connection, ...patch };
  if (JSON.stringify(next) !== JSON.stringify(connection)) {
    connection = next;
    listeners.forEach((fn) => fn(connection));
  }
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
    const data = await res.json();
    setConnection({ backend: true, database: data.database === 'UP', aiService: data.aiService === 'UP' });
  } catch (e) {
    setConnection({ backend: false });
  }
  return connection;
}

export async function apiRequest(path, { method = 'GET', body, timeoutMs = 15000 } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    setConnection({ backend: false });
    throw new ApiError('Cannot reach the backend server. Make sure it is running (npm run dev) - see README.', { network: true });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = text; }
  }

  // The Vite dev proxy answers 500/502/504 with an empty or HTML body when the backend is down
  if (!res.ok && (typeof data !== 'object' || data === null) && [500, 502, 503, 504].includes(res.status)) {
    setConnection({ backend: false });
    throw new ApiError('Cannot reach the backend server. Make sure it is running (npm run dev) - see README.', { network: true, status: res.status });
  }

  setConnection({ backend: true });
  if (!res.ok) {
    const message = (data && data.error) || `Request failed (HTTP ${res.status})`;
    if (res.status === 503 && /database/i.test(message)) setConnection({ database: false });
    if (res.status === 401 && authToken && unauthorizedHandler) unauthorizedHandler(message);
    throw new ApiError(message, { status: res.status });
  }
  return data;
}

const enc = encodeURIComponent;

export const Api = {
  // Auth
  login: (userId, password, role) => apiRequest('/auth/login', { method: 'POST', body: { userId, password, role } }),
  register: (data) => apiRequest('/auth/register', { method: 'POST', body: data }),
  changePassword: (data) => apiRequest('/auth/change-password', { method: 'POST', body: data }),
  me: () => apiRequest('/auth/me'),
  updateProfile: (id, data) => apiRequest(`/auth/profile/${enc(id)}`, { method: 'PUT', body: data }),
  getDoctors: () => apiRequest('/auth/doctors'),
  getPatients: () => apiRequest('/auth/patients'),

  // Appointments
  bookAppointment: (data) => apiRequest('/appointments', { method: 'POST', body: data }),
  getDoctorAppointments: (id) => apiRequest(`/appointments/doctor/${enc(id)}`),
  getPatientAppointments: (id) => apiRequest(`/appointments/patient/${enc(id)}`),
  updateAppointmentStatus: (id, status, notes = '', meetingLink) =>
    apiRequest(`/appointments/${enc(id)}/status`, { method: 'PUT', body: { status, notes, ...(meetingLink ? { meetingLink } : {}) } }),
  cancelAppointment: (id) => apiRequest(`/appointments/${enc(id)}/cancel`, { method: 'PUT' }),
  rescheduleAppointment: (id, appointmentDate, appointmentTime) => apiRequest(`/appointments/${enc(id)}/reschedule`, { method: 'PUT', body: { appointmentDate, appointmentTime } }),
  doctorRescheduleAppointment: (id, appointmentDate, appointmentTime) => apiRequest(`/appointments/${enc(id)}/doctor-reschedule`, { method: 'PUT', body: { appointmentDate, appointmentTime } }),
  doctorCancelAppointment: (id, reason) => apiRequest(`/appointments/${enc(id)}/doctor-cancel`, { method: 'PUT', body: { reason } }),

  // Medicines
  getMedicines: () => apiRequest('/medicines'),
  getAvailableMedicines: () => apiRequest('/medicines/available'),
  getLowStockAlerts: () => apiRequest('/medicines/low-stock-alerts'),
  addMedicine: (data) => apiRequest('/medicines', { method: 'POST', body: data }),
  updateMedicine: (id, data) => apiRequest(`/medicines/${enc(id)}`, { method: 'PUT', body: data }),
  deleteMedicine: (id) => apiRequest(`/medicines/${enc(id)}`, { method: 'DELETE' }),
  removeExpiredMedicines: () => apiRequest('/medicines/remove-expired', { method: 'POST' }),

  // Prescriptions
  issuePrescription: (data) => apiRequest('/prescriptions', { method: 'POST', body: data }),
  updatePrescription: (id, data) => apiRequest(`/prescriptions/${enc(id)}`, { method: 'PUT', body: data }),
  getDoctorPrescriptions: (id) => apiRequest(`/prescriptions/doctor/${enc(id)}`),
  getPatientPrescriptions: (id) => apiRequest(`/prescriptions/patient/${enc(id)}`),

  // Orders
  createOrder: (data) => apiRequest('/orders', { method: 'POST', body: data }),
  getPatientOrders: (id) => apiRequest(`/orders/patient/${enc(id)}`),
  getSalesHistory: () => apiRequest('/orders/sales-history'),

  // Health logs
  submitHealthLog: (data) => apiRequest('/health-logs', { method: 'POST', body: data }),
  getPatientHealthLogs: (id) => apiRequest(`/health-logs/patient/${enc(id)}`),
  getDoctorHealthLogs: (id) => apiRequest(`/health-logs/doctor/${enc(id)}`),
  addDoctorFeedback: (id, feedback) => apiRequest(`/health-logs/${enc(id)}/feedback`, { method: 'PUT', body: { feedback } }),


  // AI (Node forwards these to the Python service)
  getAiModels: () => apiRequest('/ai/models', { timeoutMs: 60000 }),
  checkSymptoms: (symptoms) => apiRequest('/ai/symptom-check', { method: 'POST', body: { symptoms } }),
  // Assistant chatbot (all dashboards)
  chat: (message) => apiRequest('/chat', { method: 'POST', body: { message }, timeoutMs: 60000 }),
  predictDisease: (diseaseType, features) => apiRequest('/ai/predict-disease', { method: 'POST', body: { diseaseType, features }, timeoutMs: 60000 }),
};
