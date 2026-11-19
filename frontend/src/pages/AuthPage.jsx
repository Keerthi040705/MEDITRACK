import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { BLOOD_GROUPS, GENDERS } from '../constants';

const EMPTY_REG = {
 role: 'doctor', userId: '', password: '', name: '', email: '', phone: '',
 specialization: '', licenseNumber: '', hospital: '', experienceYears: '', consultationHours: '',
 consultationMode: 'BOTH', clinicAddress: '', clinicCity: '', clinicMapUrl: '', meetingLink: '',
 age: '', gender: '', bloodGroup: '', emergencyContact: '', allergies: '', medicalHistory: '',
 pharmacyName: '', drugLicenseNumber: '', pharmacyAddress: '', storePhone: '',
};

const ROLE_FIELDS = {
 doctor: ['specialization', 'licenseNumber', 'hospital', 'experienceYears', 'consultationHours',
 'consultationMode', 'clinicAddress', 'clinicCity'],
 patient: ['age', 'gender', 'bloodGroup'],
 pharmacist: ['pharmacyName', 'drugLicenseNumber', 'pharmacyAddress'],
};

export default function AuthPage({ onBack }) {
 const { login, register } = useAuth();
 const { showToast } = useToast();
 const [tab, setTab] = useState('login');
 const [busy, setBusy] = useState(false);
 const [loginForm, setLoginForm] = useState({ role: 'doctor', userId: '', password: '' });
 const [reg, setReg] = useState(EMPTY_REG);

 const setL = (k) => (e) => setLoginForm((s) => ({ ...s, [k]: e.target.value }));
 const setR = (k) => (e) => setReg((s) => ({ ...s, [k]: e.target.value }));

 const doLogin = async (role, userId, password) => {
 setBusy(true);
 try {
 const user = await login(userId.trim(), password, role);
 showToast(`Welcome back, ${user.name}!`, 'success');
 } catch (e) {
 showToast(e.message, 'error');
 } finally {
 setBusy(false);
 }
 };

 const onLogin = (e) => {
 e.preventDefault();
 doLogin(loginForm.role, loginForm.userId, loginForm.password);
 };

 const onRegister = async (e) => {
 e.preventDefault();
 if (reg.password.length < 6) {
 showToast('Password must be at least 6 characters.', 'error');
 return;
 }
 const data = {
 role: reg.role, userId: reg.userId.trim(), password: reg.password,
 name: reg.name.trim(), email: reg.email.trim(), phone: reg.phone.trim(),
 };
 for (const k of ROLE_FIELDS[reg.role]) {
 const v = reg[k];
 data[k] = typeof v === 'string' ? v.trim() : v;
 }
 if (reg.role === 'doctor') {
 if (data.consultationMode !== 'ONLINE' && !data.clinicAddress) {
 showToast('Please enter your clinic address so patients can find you for in-person visits.', 'error');
 return;
 }
 for (const [k, label] of [['clinicMapUrl', 'Google Maps link'], ['meetingLink', 'Video-call link']]) {
 if (data[k] && !/^https?:\/\/\S+$/i.test(data[k])) {
 showToast(`${label} must start with http:// or https://`, 'error');
 return;
 }
 }
 }
 if (data.experienceYears !== undefined) data.experienceYears = Number(data.experienceYears) || 0;
 if (data.age !== undefined) data.age = Number(data.age) || null;

 setBusy(true);
 try {
 await register(data);
 showToast('Account registered successfully!', 'success');
 } catch (err) {
 showToast(err.message, 'error');
 } finally {
 setBusy(false);
 }
 };

 const field = (label, key, props = {}) => (
 <div className="form-group">
 <label className="form-label">{label}{props.required && <span className="req"> *</span>}</label>
 <input className="form-control" value={reg[key]} onChange={setR(key)} {...props} />
 </div>
 );

 return (
 <section className="page-view active">
 <div className="auth-wrapper">
 <div className="auth-card fade-in">
 <div className="auth-header">
 <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }} onClick={onBack}>
 <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>MediTrack Health</span>
 </div>
 <h2>Access Clinical Portal</h2>
 <p>Select your authorized role to proceed to your specialized dashboard</p>
 </div>

 <div className="auth-tabs">
 <button type="button" className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
 <button type="button" className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Create Account</button>
 </div>

 {tab === 'login' ? (
 <form onSubmit={onLogin}>
 <div className="form-group">
 <label className="form-label" htmlFor="login-role">Select Role <span className="req">*</span></label>
 <select id="login-role" className="form-control" value={loginForm.role} onChange={setL('role')}>
 <option value="doctor">Doctor</option>
 <option value="patient">Patient</option>
 <option value="pharmacist">Pharmacist</option>
 </select>
 </div>
 <div className="form-group">
 <label className="form-label" htmlFor="login-userid">User ID or Email <span className="req">*</span></label>
 <input id="login-userid" className="form-control" placeholder="Enter User ID or Email" required value={loginForm.userId} onChange={setL('userId')} autoComplete="username" />
 </div>
 <div className="form-group">
 <label className="form-label" htmlFor="login-password">Password <span className="req">*</span></label>
 <input id="login-password" type="password" className="form-control" placeholder="••••••••" required value={loginForm.password} onChange={setL('password')} autoComplete="current-password" />
 </div>
 <button type="submit" className="btn-primary" style={{ marginTop: 10 }} disabled={busy}>
 {busy ? 'Signing in…' : 'Sign In to Portal'}
 </button>

 <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
 <button type="button" className="text-link" onClick={() => setTab('register')}>Don't have an account? Sign up</button>
 </div>
 </form>
 ) : (
 <form onSubmit={onRegister}>
 <div className="form-group">
 <label className="form-label">Register As <span className="req">*</span></label>
 <select className="form-control" value={reg.role} onChange={setR('role')}>
 <option value="doctor">Doctor</option>
 <option value="patient">Patient</option>
 <option value="pharmacist">Pharmacist</option>
 </select>
 </div>
 <div className="form-row">
 {field('Choose User ID', 'userId', { required: true, placeholder: 'unique username', autoComplete: 'username' })}
 {field('Password', 'password', { required: true, type: 'password', placeholder: 'min. 6 characters', minLength: 6, autoComplete: 'new-password' })}
 </div>
 <div className="form-row">
 {field('Full Legal Name', 'name', { required: true, placeholder: 'Full name' })}
 {field('Email Address', 'email', { required: true, type: 'email', placeholder: 'name@domain.com' })}
 </div>
 {field('Contact Phone', 'phone', { required: true, type: 'tel', placeholder: '+91-90000-00000' })}

 {reg.role === 'doctor' && (
 <div className="role-badge-box">
 <div className="role-badge-title"> Doctor Clinical Credentials</div>
 <div className="form-row">
 {field('Specialization', 'specialization', { required: true, placeholder: 'e.g. Cardiologist' })}
 {field('Medical License No.', 'licenseNumber', { required: true, placeholder: 'Medical registration number' })}
 </div>
 <div className="form-row">
 {field('Hospital or Clinic', 'hospital', { required: true, placeholder: 'Hospital or practice name' })}
 {field('Experience in Years', 'experienceYears', { required: true, type: 'number', min: 0 })}
 </div>
 {field('Consultation Hours', 'consultationHours', { required: true, placeholder: '09:00 AM - 04:00 PM' })}

 <div className="role-badge-title" style={{ marginTop: 10 }}> Where you see patients</div>
 <div className="form-group">
 <label className="form-label" htmlFor="reg-mode">Consultation Type</label>
 <select id="reg-mode" required className="form-control" value={reg.consultationMode} onChange={setR('consultationMode')}>
 <option value="BOTH">Online and In-person</option>
 <option value="OFFLINE">In-person only (clinic)</option>
 <option value="ONLINE">Online only (video call)</option>
 </select>
 </div>
 {reg.consultationMode !== 'ONLINE' && (
 <>
 {field('Clinic Address', 'clinicAddress', { required: true, placeholder: 'Clinic address', id: 'reg-clinic-address' })}
 {field('City & PIN', 'clinicCity', { required: true, placeholder: 'City and PIN code' })}
 </>
 )}
 </div>
 )}

 {reg.role === 'patient' && (
 <div className="role-badge-box">
 <div className="role-badge-title"> Patient Medical Baseline</div>
 <div className="form-row">
 {field('Age in Years', 'age', { required: true, type: 'number', min: 1, max: 130 })}
 <div className="form-group">
 <label className="form-label">Gender <span className="req">*</span></label>
 <select required className="form-control" value={reg.gender} onChange={setR('gender')}>
 <option value="">Select gender</option>
 {GENDERS.map((g) => <option key={g}>{g}</option>)}
 </select>
 </div>
 </div>
 <div className="form-row">
 <div className="form-group">
 <label className="form-label">Blood Group <span className="req">*</span></label>
 <select required className="form-control" value={reg.bloodGroup} onChange={setR('bloodGroup')}>
 <option value="">Select blood group</option>
 {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
 </select>
 </div>
 </div>
 </div>
 )}

 {reg.role === 'pharmacist' && (
 <div className="role-badge-box">
 <div className="role-badge-title"> Pharmacy Licensing Details</div>
 <div className="form-row">
 {field('Dispensary Store Name', 'pharmacyName', { required: true, placeholder: 'Pharmacy name' })}
 {field('Drug License Reg. No.', 'drugLicenseNumber', { required: true, placeholder: 'Drug licence number' })}
 </div>
 {field('Pharmacy Store Address', 'pharmacyAddress', { required: true, placeholder: 'Pharmacy address' })}
 </div>
 )}

 <button type="submit" className="btn-primary" style={{ marginTop: 14 }} disabled={busy}>
 {busy ? 'Creating account…' : 'Complete Registration'}
 </button>
 </form>
 )}
 </div>
 </div>
 </section>
 );
}
