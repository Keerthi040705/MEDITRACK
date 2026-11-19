import { useEffect, useMemo, useState } from 'react';
import { SectionHeader, TableStatus } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { Api } from '../../api/client';
import { useAction, useApi } from '../../utils/useApi';
import { num, todayStr } from '../../utils/format';

const NUMERIC = [
 ['systolicBp', 'Systolic BP (mmHg)', 1], ['diastolicBp', 'Diastolic BP (mmHg)', 1],
 ['bloodGlucose', 'Fasting Glucose (mg/dL)', 0.1], ['heartRate', 'Resting Heart Rate (bpm)', 1],
 ['temperature', 'Body Temperature (°F)', 0.1], ['weight', 'Body Weight (kg)', 0.1],
 ['sleepHours', 'Sleep Hours', 0.5], ['waterIntakeLiters', 'Water Intake (L)', 0.1],
];

const initialForm = () => ({
 doctorId: '', logDate: todayStr(),
 systolicBp: 122, diastolicBp: 78, bloodGlucose: 102, heartRate: 72,
 temperature: 98.4, weight: 78.5, sleepHours: 7.5, waterIntakeLiters: 2.8,
 medicationAdherence: 'YES', symptoms: '', patientNotes: '',
});

export default function HealthLogs() {
 const { user } = useAuth();
 const { busy, run } = useAction();
 const doctors = useApi(() => Api.getDoctors(), []);
 const appointments = useApi(() => Api.getPatientAppointments(user.id), [user.id]);
 const consultingDoctors = useMemo(() => {
 const ids = new Set(appointments.data.filter((a) => a.status === 'ACCEPTED').map((a) => a.doctorId));
 return doctors.data.filter((d) => ids.has(d.id));
 }, [appointments.data, doctors.data]);
 const logs = useApi(() => Api.getPatientHealthLogs(user.id), [user.id]);
 const [form, setForm] = useState(initialForm);
 const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

 // Preselect the first doctor once the list arrives
 useEffect(() => {
 if (!form.doctorId && consultingDoctors.length) setForm((s) => ({ ...s, doctorId: consultingDoctors[0].id }));
 }, [consultingDoctors, form.doctorId]);

 const submit = async (e) => {
 e.preventDefault();
 const payload = {
 ...form,
 symptoms: form.symptoms.trim() || 'No active symptoms reported',
 patientNotes: form.patientNotes.trim(),
 };
 for (const [key] of NUMERIC) payload[key] = num(form[key], null);
 const { ok } = await run(() => Api.submitHealthLog(payload), 'Daily health update sent to your doctor!');
 if (ok) {
 setForm((s) => ({ ...s, symptoms: '', patientNotes: '' }));
 logs.reload();
 }
 };

 const numericRows = [];
 for (let i = 0; i < NUMERIC.length; i += 2) numericRows.push(NUMERIC.slice(i, i + 2));

 return (
 <>
 <SectionHeader
 title="Daily Health Updates & Doctor Telemetry"
 subtitle="Log your daily blood pressure, glucose, temperature and adherence, and send reports directly to your physician"
 />

 <div className="prescription-builder-grid">
 <div className="rx-card">
 <h3><span></span> Submit Daily Health Record</h3>
 <form onSubmit={submit}>
 <div className="form-group">
 <label className="form-label">Reviewing Doctor <span className="req">*</span></label>
 <select className="form-control" required value={form.doctorId} onChange={set('doctorId')}>
 {!consultingDoctors.length && <option value="">No accepted doctor consultation yet</option>}
 {consultingDoctors.map((d) => <option key={d.id} value={d.id}>Send update to {d.name} - {d.specialization || 'Physician'}</option>)}
 </select>
 </div>
 <div className="form-group">
 <label className="form-label">Date of Log</label>
 <input type="date" className="form-control" max={todayStr()} value={form.logDate} onChange={set('logDate')} />
 </div>
 {numericRows.map((row, i) => (
 <div className="form-row" key={i}>
 {row.map(([key, label, step]) => (
 <div className="form-group" key={key}>
 <label className="form-label">{label}</label>
 <input type="number" step={step} className="form-control" value={form[key]} onChange={set(key)} />
 </div>
 ))}
 </div>
 ))}
 <div className="form-group">
 <label className="form-label">Medication Adherence Today <span className="req">*</span></label>
 <select className="form-control" value={form.medicationAdherence} onChange={set('medicationAdherence')}>
 <option value="YES">Yes - Took all prescribed doses on schedule</option>
 <option value="PARTIAL">Partial - Took some doses, missed others</option>
 <option value="NO">No - Did not take prescribed medicines today</option>
 </select>
 </div>
 <div className="form-group">
 <label className="form-label">Active Symptoms Experienced Today</label>
 <input className="form-control" value={form.symptoms} onChange={set('symptoms')} placeholder="e.g. Mild headache after lunch" />
 </div>
 <div className="form-group">
 <label className="form-label">Personal Notes for Doctor</label>
 <textarea className="form-control" rows={2} value={form.patientNotes} onChange={set('patientNotes')} placeholder="Any dietary changes or questions for the doctor..." />
 </div>
 <button type="submit" className="btn-primary" disabled={busy || !form.doctorId || !consultingDoctors.length}>Send Update to Doctor</button>
 </form>
 </div>

 <div className="rx-card">
 <h3><span></span> Log History &amp; Doctor Feedback</h3>
 <div className="table-container" style={{ maxHeight: 520 }}>
 <table className="data-table">
 <thead><tr><th>Date</th><th>BP</th><th>Glucose</th><th>Heart Rate</th><th>Adherence</th><th>Doctor</th><th>Review &amp; Feedback</th></tr></thead>
 <tbody>
 <TableStatus colSpan={7} loading={logs.loading && !logs.data.length} error={logs.error} empty={!logs.data.length} emptyText="No daily health logs submitted yet." />
 {!logs.error && logs.data.map((l) => (
 <tr key={l.id}>
 <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-mint)' }}>{l.logDate}</span></td>
 <td><strong>{l.systolicBp}/{l.diastolicBp}</strong> mmHg</td>
 <td><strong style={{ color: 'var(--accent-emerald)' }}>{l.bloodGlucose}</strong> mg/dL</td>
 <td>{l.heartRate} bpm</td>
 <td><span className={`badge ${l.medicationAdherence === 'YES' ? 'badge-accepted' : 'badge-warning'}`}>{l.medicationAdherence}</span></td>
 <td>{l.doctorName}</td>
 <td>
 {l.reviewedByDoctor ? (
 <div style={{ fontSize: '0.8rem', color: '#a7f3d0', background: 'rgba(0,255,136,0.08)', padding: '4px 8px', borderRadius: 4 }}>
 <strong>Doctor Advice:</strong> {l.doctorFeedback || 'Reviewed'}
 </div>
 ) : <span className="badge badge-pending">Awaiting Review</span>}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </>
 );
}
