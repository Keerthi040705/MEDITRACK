export const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);

/** Local date as YYYY-MM-DD */
export function todayStr(date = new Date()) {
 const y = date.getFullYear();
 const m = String(date.getMonth() + 1).padStart(2, '0');
 const d = String(date.getDate()).padStart(2, '0');
 return `${y}-${m}-${d}`;
}

export function addDaysStr(days) {
 const d = new Date();
 d.setDate(d.getDate() + days);
 return todayStr(d);
}

export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');
export const fmtTime = (v) => (v ? new Date(v).toLocaleTimeString() : '');

export function riskBadgeClass(level = '') {
 if (level.includes('HIGH') || level.includes('STRONG')) return 'badge-danger';
 if (level.includes('MODERATE') || level.includes('PARTIAL')) return 'badge-warning';
 return 'badge-accepted';
}

export function appointmentBadge(status, forPatient = false) {
 switch (status) {
 case 'ACCEPTED': return { cls: 'badge-accepted', label: 'Confirmed' };
 case 'REJECTED': return { cls: 'badge-rejected', label: 'Rejected' };
 case 'CANCELLED': return { cls: 'badge-rejected', label: 'Cancelled' };
 default: return { cls: 'badge-pending', label: forPatient ? 'Pending Doctor Review' : 'Pending Review' };
 }
}

/** Number from an <input>, or the fallback when empty / invalid */
export function num(value, fallback = 0) {
 const n = parseFloat(value);
 return Number.isFinite(n) ? n : fallback;
}

/** Medicine helpers (pharmacist views) */
export const isExpired = (m) => Boolean(m.expiryDate) && m.expiryDate < todayStr();
export const isLow = (m) => !isExpired(m) && m.quantity <= (m.minStockThreshold ?? 15);

/** Google Maps link for a clinic: the doctor's own map link if given, otherwise a search for the address. */
export function mapsLink(address, city, mapUrl) {
 if (mapUrl && /^https?:\/\//i.test(mapUrl)) return mapUrl;
 const q = [address, city].filter(Boolean).join(', ');
 return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

/** Only http(s) links are ever rendered as clickable */
export const safeLink = (url) => (url && /^https?:\/\//i.test(url) ? url : null);

export const MODE_LABEL = { ONLINE: ' Online', OFFLINE: ' In-person' };
