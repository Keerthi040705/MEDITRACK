import { useEffect, useMemo, useState } from 'react';
import { SectionHeader, TableStatus } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Api } from '../../api/client';
import { useAction, useApi } from '../../utils/useApi';
import { appointmentBadge, mapsLink, MODE_LABEL, safeLink, todayStr } from '../../utils/format';
import { TIME_SLOTS } from '../../constants';

export default function Appointments() {
 const { user } = useAuth();
 const { showToast } = useToast();
 const { busy, run } = useAction();
 const doctors = useApi(() => Api.getDoctors(), []);
 const appts = useApi(() => Api.getPatientAppointments(user.id), [user.id]);

 const [form, setForm] = useState({ doctorId: '', mode: 'OFFLINE', appointmentDate: '', appointmentTime: '10:30 AM', reason: '', symptoms: '' });
 const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

 // Which visit types the chosen doctor offers
 const doctor = useMemo(() => doctors.data.find((d) => d.id === form.doctorId), [doctors.data, form.doctorId]);
 const offers = doctor?.consultationMode || 'BOTH';
 const canOnline = !doctor || offers !== 'OFFLINE';
 const canOffline = !doctor || (offers !== 'ONLINE' && Boolean(doctor.clinicAddress));
 const offlineNote = !doctor ? 'Visit the doctor at their clinic'
 : offers === 'ONLINE' ? 'This doctor consults online only'
 : !doctor.clinicAddress ? 'Clinic address not added yet' : 'Visit the doctor at their clinic';

 // Switch to an allowed mode when the doctor changes
 useEffect(() => {
 if (form.mode === 'OFFLINE' && !canOffline && canOnline) setForm((s) => ({ ...s, mode: 'ONLINE' }));
 if (form.mode === 'ONLINE' && !canOnline && canOffline) setForm((s) => ({ ...s, mode: 'OFFLINE' }));
 }, [form.mode, canOnline, canOffline]);

 const book = async (e) => {
 e.preventDefault();
 if (form.appointmentDate < todayStr()) {
 return showToast('Cannot book an appointment for a past date. Please choose today or a future date.', 'error');
 }
 const { ok } = await run(
 () => Api.bookAppointment({ ...form, reason: form.reason.trim(), symptoms: form.symptoms.trim() }),
 'Appointment requested! The doctor will review it shortly.'
 );
 if (ok) {
 setForm((s) => ({ ...s, reason: '', symptoms: '' }));
 appts.reload();
 }
 };

 const reschedule = async (a) => {
 const appointmentDate = window.prompt('Enter new date (YYYY-MM-DD):', a.appointmentDate);
 if (!appointmentDate) return;
 const appointmentTime = window.prompt('Enter new time:', a.appointmentTime || '10:30 AM');
 if (!appointmentTime) return;
 const { ok } = await run(() => Api.rescheduleAppointment(a.id, appointmentDate, appointmentTime), 'Appointment rescheduled and sent for doctor approval.');
 if (ok) appts.reload();
 };

 const cancel = async (id) => {
 if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
 const { ok } = await run(() => Api.cancelAppointment(id), 'Appointment cancelled.');
 if (ok) appts.reload();
 };

 return (
 <>
 <SectionHeader title="Book Consultation with a Doctor" subtitle="Schedule an appointment with specialized clinicians and track your booking status" />

 <div className="prescription-builder-grid">
 <div className="rx-card">
 <h3><span></span> Schedule New Appointment</h3>
 <form onSubmit={book}>
 <div className="form-group">
 <label className="form-label">Select Specialist Doctor <span className="req">*</span></label>
 <select className="form-control" required value={form.doctorId} onChange={set('doctorId')}>
 <option value="">-- Choose Specialist Doctor --</option>
 {doctors.data.map((d) => (
 <option key={d.id} value={d.id}>{d.name} - {d.specialization || 'Physician'} - {d.clinicCity || d.hospital || 'Medical Center'}</option>
 ))}
 </select>
 </div>
 <div className="form-group">
 <label className="form-label">Consultation Type <span className="req">*</span></label>
 <div className="mode-toggle" role="radiogroup" aria-label="Consultation type">
 <label className={`mode-option ${form.mode === 'ONLINE' ? 'selected' : ''} ${!canOnline ? 'disabled' : ''}`}>
 <input type="radio" name="mode" value="ONLINE" checked={form.mode === 'ONLINE'} disabled={!canOnline} onChange={set('mode')} />
 <span><strong> Online</strong><small>{canOnline ? 'Video call — the doctor sends the link when confirming' : 'This doctor sees patients in person only'}</small></span>
 </label>
 <label className={`mode-option ${form.mode === 'OFFLINE' ? 'selected' : ''} ${!canOffline ? 'disabled' : ''}`}>
 <input type="radio" name="mode" value="OFFLINE" checked={form.mode === 'OFFLINE'} disabled={!canOffline} onChange={set('mode')} />
 <span><strong> In-person (Offline)</strong><small>{offlineNote}</small></span>
 </label>
 </div>
 {form.mode === 'OFFLINE' && doctor?.clinicAddress && (
 <div className="location-card">
 <strong style={{ color: '#fff' }}> Clinic location — {doctor.name}</strong><br />
 {doctor.hospital && <>{doctor.hospital}<br /></>}
 {doctor.clinicAddress}{doctor.clinicCity ? `, ${doctor.clinicCity}` : ''}<br />
 {doctor.consultationHours && <><span style={{ color: 'var(--text-muted)' }}>Hours: {doctor.consultationHours}</span><br /></>}
 <a href={mapsLink(doctor.clinicAddress, doctor.clinicCity, doctor.clinicMapUrl)} target="_blank" rel="noopener noreferrer">Open in Google Maps </a>
 </div>
 )}
 {form.mode === 'OFFLINE' && !doctor && (
 <small style={{ color: 'var(--text-dim)' }}>Choose a doctor to see the clinic location.</small>
 )}
 </div>
 <div className="form-row">
 <div className="form-group">
 <label className="form-label">Appointment Date <span className="req">*</span></label>
 <input type="date" className="form-control" required min={todayStr()} value={form.appointmentDate} onChange={set('appointmentDate')} />
 </div>
 <div className="form-group">
 <label className="form-label">Preferred Time Slot <span className="req">*</span></label>
 <select className="form-control" value={form.appointmentTime} onChange={set('appointmentTime')}>
 {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
 </select>
 </div>
 </div>
 <div className="form-group">
 <label className="form-label">Reason for Visit <span className="req">*</span></label>
 <input className="form-control" required value={form.reason} onChange={set('reason')} placeholder="e.g. Routine hypertension checkup" />
 </div>
 <div className="form-group">
 <label className="form-label">Current Symptoms or Discomfort</label>
 <textarea className="form-control" rows={3} value={form.symptoms} onChange={set('symptoms')} placeholder="Describe what you are currently experiencing..." />
 </div>
 <button type="submit" className="btn-primary" disabled={busy}>Book Consultation Appointment</button>
 </form>
 </div>

 <div className="rx-card">
 <h3><span></span> My Scheduled Appointments</h3>
 <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>Track appointment confirmations and cancel if needed</p>
 <div className="table-container" style={{ maxHeight: 480 }}>
 <table className="data-table">
 <thead><tr><th>Doctor</th><th>Date</th><th>Time</th><th>Type &amp; Place</th><th>Reason</th><th>Status</th><th>Doctor Advice</th><th>Action</th></tr></thead>
 <tbody>
 <TableStatus colSpan={8} loading={appts.loading && !appts.data.length} error={appts.error} empty={!appts.data.length} emptyText="You have no appointments booked yet." />
 {!appts.error && appts.data.map((a) => {
 const badge = appointmentBadge(a.status, true);
 const canCancel = a.status === 'PENDING' || a.status === 'ACCEPTED';
 return (
 <tr key={a.id}>
 <td><strong>{a.doctorName}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{a.doctorSpecialization}</small></td>
 <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-mint)' }}>{a.appointmentDate}</span></td>
 <td>{a.appointmentTime}</td>
 <td>
 <span className="badge badge-accepted">{MODE_LABEL[a.mode] || MODE_LABEL.OFFLINE}</span>
 <div className="appt-place">
 {a.mode === 'ONLINE' ? (
 a.status === 'ACCEPTED' && safeLink(a.meetingLink)
 ? <a href={safeLink(a.meetingLink)} target="_blank" rel="noopener noreferrer">Join video call </a>
 : 'Link shared when the doctor confirms'
 ) : a.clinicAddress ? (
 <>{a.clinicAddress}{a.clinicCity ? `, ${a.clinicCity}` : ''}<br />
 <a href={mapsLink(a.clinicAddress, a.clinicCity, a.clinicMapUrl)} target="_blank" rel="noopener noreferrer">Map </a></>
 ) : '—'}
 </div>
 </td>
 <td>{a.reason}</td>
 <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
 <td>{a.doctorNotes || '—'}</td>
 <td>
 {canCancel
 ? <><button type="button" className="btn-secondary" disabled={busy} onClick={() => reschedule(a)}>Reschedule</button><button type="button" className="btn-danger" disabled={busy} onClick={() => cancel(a.id)}>Cancel Appt</button></>
 : <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Closed</span>}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </>
 );
}
