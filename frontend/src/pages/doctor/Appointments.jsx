import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SectionHeader, TableStatus } from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import { Api } from '../../api/client';
import { useAction } from '../../utils/useApi';
import { appointmentBadge, mapsLink, MODE_LABEL, safeLink } from '../../utils/format';

export default function Appointments({ state }) {
 const { data: list, loading, error, reload } = state;
 const { busy, run } = useAction();
 const { user } = useAuth();
 const [accepting, setAccepting] = useState(null); // online appointment waiting for a video link
 const [link, setLink] = useState('');

 const updateStatus = async (id, status, notes = '', meetingLink) => {
 const { ok } = await run(() => Api.updateAppointmentStatus(id, status, notes, meetingLink), `Appointment ${status.toLowerCase()}.`);
 if (ok) {
 setAccepting(null);
 reload();
 }
 };

 const reschedule = async (a) => {
 const appointmentDate = window.prompt('New appointment date (YYYY-MM-DD):', a.appointmentDate);
 if (!appointmentDate) return;
 const appointmentTime = window.prompt('New appointment time:', a.appointmentTime || '10:30 AM');
 if (!appointmentTime) return;
 const { ok } = await run(() => Api.doctorRescheduleAppointment(a.id, appointmentDate, appointmentTime), 'Appointment rescheduled.');
 if (ok) reload();
 };

 const cancelByDoctor = async (a) => {
 if (!window.confirm(`Cancel the appointment with ${a.patientName}?`)) return;
 const { ok } = await run(() => Api.doctorCancelAppointment(a.id), 'Appointment cancelled.');
 if (ok) reload();
 };

 const onAccept = (a) => {
 if (a.mode === 'ONLINE') {
 setLink(user.meetingLink || '');
 setAccepting(a);
 } else {
 updateStatus(a.id, 'ACCEPTED');
 }
 };

 return (
 <>
 <SectionHeader
 title="Patient Consultation Appointments"
 subtitle="Review booking requests, evaluate reported symptoms, and manage appointments"
 >
 <button type="button" className="btn-secondary" onClick={reload}>↻ Refresh</button>
 </SectionHeader>

 <div className="table-container">
 <table className="data-table">
 <thead>
 <tr>
 <th>Patient Name</th><th>Date &amp; Time</th><th>Type &amp; Place</th><th>Reason for Visit</th><th>Reported Symptoms</th>
 <th>Status</th><th>Doctor Notes</th><th>Actions</th>
 </tr>
 </thead>
 <tbody>
 <TableStatus colSpan={8} loading={loading && !list.length} error={error} empty={!list.length} emptyText="No patient appointments scheduled yet." />
 {!error && list.map((a) => {
 const badge = appointmentBadge(a.status);
 return (
 <tr key={a.id}>
 <td><strong>{a.patientName || 'Patient'}</strong></td>
 <td>
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-mint)' }}>{a.appointmentDate}</span><br />
 <small style={{ color: 'var(--text-muted)' }}>{a.appointmentTime}</small>
 </td>
 <td style={{ maxWidth: 200 }}>
 <span className="badge badge-accepted">{MODE_LABEL[a.mode] || MODE_LABEL.OFFLINE}</span>
 <div className="appt-place">
 {a.mode === 'ONLINE' ? (
 safeLink(a.meetingLink)
 ? <a href={safeLink(a.meetingLink)} target="_blank" rel="noopener noreferrer">Start video call </a>
 : 'You add the call link when accepting'
 ) : a.clinicAddress ? (
 <>{a.clinicAddress}{a.clinicCity ? `, ${a.clinicCity}` : ''}<br />
 <a href={mapsLink(a.clinicAddress, a.clinicCity, a.clinicMapUrl)} target="_blank" rel="noopener noreferrer">Map </a></>
 ) : '—'}
 </div>
 </td>
 <td style={{ maxWidth: 200 }}>{a.reason || 'General Consultation'}</td>
 <td style={{ maxWidth: 220, fontSize: '0.84rem', color: 'var(--text-muted)' }}>{a.symptoms || 'None specified'}</td>
 <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
 <td>{a.doctorNotes || '—'}</td>
 <td>
 {['PENDING', 'ACCEPTED'].includes(a.status) ? (
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
 {a.status === 'PENDING' && <button type="button" className="btn-success" disabled={busy} onClick={() => onAccept(a)}>Accept</button>}
 <button type="button" className="btn-secondary" disabled={busy} onClick={() => reschedule(a)}>Reschedule</button>
 <button type="button" className="btn-danger" disabled={busy} onClick={() => cancelByDoctor(a)}>Cancel</button>
 </div>
 ) : <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Done</span>}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 <Modal open={Boolean(accepting)} title="Accept Online Appointment" onClose={() => setAccepting(null)}>
 <form onSubmit={(e) => { e.preventDefault(); updateStatus(accepting.id, 'ACCEPTED', '', link.trim()); }}>
 <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 12 }}>
 <strong style={{ color: '#fff' }}>{accepting?.patientName}</strong> will see this video-call link on{' '}
 {accepting?.appointmentDate} at {accepting?.appointmentTime}.
 </p>
 <div className="form-group">
 <label className="form-label" htmlFor="accept-link">Video-call link <span className="req">*</span></label>
 <input id="accept-link" type="url" required className="form-control" value={link}
 onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
 <small style={{ color: 'var(--text-dim)' }}>Google Meet, Zoom, Jitsi… Save a default in your profile to pre-fill this.</small>
 </div>
 <div className="modal-actions">
 <button type="button" className="btn-secondary" onClick={() => setAccepting(null)}>Cancel</button>
 <button type="submit" className="btn-success" disabled={busy}>Accept &amp; Share Link</button>
 </div>
 </form>
 </Modal>
 </>
 );
}
