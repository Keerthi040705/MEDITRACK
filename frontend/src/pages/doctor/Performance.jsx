import { useState } from 'react';
import { SectionHeader, TableStatus } from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import { Api } from '../../api/client';
import { useAction } from '../../utils/useApi';

function bpBadge(sys, dia) {
  if (sys > 139 || dia > 89) return <span className="badge badge-danger">{sys}/{dia} (Elevated)</span>;
  if (sys > 129) return <span className="badge badge-warning">{sys}/{dia}</span>;
  return <span className="badge badge-accepted">{sys}/{dia} mmHg</span>;
}

function adherenceBadge(value) {
  if (value === 'YES') return <span className="badge badge-accepted">100% Taken</span>;
  if (value === 'PARTIAL') return <span className="badge badge-warning">Partial</span>;
  return <span className="badge badge-danger">Missed Doses</span>;
}

export default function Performance({ state }) {
  const { data: logs, loading, error, reload } = state;
  const { busy, run } = useAction();
  const [target, setTarget] = useState(null);
  const [feedback, setFeedback] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const { ok } = await run(() => Api.addDoctorFeedback(target.id, feedback.trim()), 'Clinical feedback sent to the patient record!');
    if (ok) {
      setTarget(null);
      reload();
    }
  };

  return (
    <>
      <SectionHeader
        title="Patient Daily Performance & Vitals Telemetry"
        subtitle="Inspect daily metrics, blood pressure, glucose, medication adherence, and provide clinical feedback"
      >
        <button type="button" className="btn-secondary" onClick={reload}>↻ Refresh</button>
      </SectionHeader>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr><th>Patient</th><th>Log Date</th><th>Blood Pressure</th><th>Glucose &amp; Vitals</th><th>Rx Adherence</th><th>Symptoms &amp; Notes</th><th>Clinical Advice</th></tr>
          </thead>
          <tbody>
            <TableStatus colSpan={7} loading={loading && !logs.length} error={error} empty={!logs.length} emptyText="No patient daily logs received yet." />
            {!error && logs.map((log) => (
              <tr key={log.id}>
                <td><strong>{log.patientName}</strong></td>
                <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-mint)' }}>{log.logDate}</span></td>
                <td>{bpBadge(log.systolicBp, log.diastolicBp)}</td>
                <td>
                  <strong style={{ color: 'var(--accent-emerald)' }}>{log.bloodGlucose ?? '—'}</strong> mg/dL<br />
                  <small style={{ color: 'var(--text-dim)' }}>{log.heartRate ?? '—'} bpm | {log.weight ?? '—'} kg</small>
                </td>
                <td>{adherenceBadge(log.medicationAdherence)}</td>
                <td style={{ maxWidth: 220, fontSize: '0.85rem' }}>
                  {log.symptoms || 'No symptoms reported.'}
                  {log.patientNotes && <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: 4 }}>Note: {log.patientNotes}</div>}
                  {log.doctorFeedback && (
                    <div style={{ marginTop: 6, padding: '4px 8px', background: 'rgba(0,255,136,0.08)', borderLeft: '2px solid var(--accent-emerald)', borderRadius: 4, fontSize: '0.78rem', color: '#a7f3d0' }}>
                      <strong>Your Advice:</strong> {log.doctorFeedback}
                    </div>
                  )}
                </td>
                <td>
                  <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                    onClick={() => { setFeedback(log.doctorFeedback || ''); setTarget(log); }}>
                    {log.doctorFeedback ? 'Update Feedback' : 'Give Advice'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(target)} title="Physician Clinical Feedback" onClose={() => setTarget(null)}>
        <form onSubmit={submit}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Provide clinical feedback on the daily health update for: <strong style={{ color: '#fff' }}>{target?.patientName}</strong>
          </p>
          <div className="form-group">
            <label className="form-label">Doctor Advice and Adjustment <span className="req">*</span></label>
            <textarea className="form-control" rows={4} required value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Enter clinical advice or confirm satisfactory vitals..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setTarget(null)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={busy}>Send Advice</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
