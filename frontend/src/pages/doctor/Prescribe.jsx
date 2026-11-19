import { useState } from 'react';
import { SectionHeader, TableStatus } from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Api } from '../../api/client';
import { useAction, useApi } from '../../utils/useApi';
import { money } from '../../utils/format';

const EMPTY_ITEM = { medicineId: '', dosage: '', frequency: '', durationDays: 14, quantity: 28, instructions: '' };

export default function Prescribe() {
 const { user } = useAuth();
 const { showToast } = useToast();
 const { busy, run } = useAction();

 const patients = useApi(() => Api.getPatients(), []);
 const meds = useApi(() => Api.getAvailableMedicines(), []);
 const history = useApi(() => Api.getDoctorPrescriptions(user.id), [user.id]);

 const [patientId, setPatientId] = useState('');
 const [diagnosis, setDiagnosis] = useState('');
 const [notes, setNotes] = useState('');
 const [item, setItem] = useState(EMPTY_ITEM);
 const [cart, setCart] = useState([]);
 const [editing, setEditing] = useState(null); // prescription copy being edited

 const setI = (k) => (e) => setItem((s) => ({ ...s, [k]: e.target.value }));

 const addItem = () => {
 const med = meds.data.find((m) => m.id === item.medicineId);
 if (!med) return showToast('Please select a medicine from available pharmacy inventory.', 'error');
 const qty = parseInt(item.quantity, 10) || 0;
 if (qty < 1) return showToast('Quantity must be at least 1.', 'error');
 if (qty > med.quantity) return showToast(`Requested quantity (${qty}) exceeds available pharmacy stock (${med.quantity}).`, 'error');

 setCart((c) => [...c, {
 medicineId: med.id,
 medicineName: med.name,
 dosage: item.dosage.trim() || 'As directed',
 frequency: item.frequency.trim() || '1-0-1 after meals',
 durationDays: parseInt(item.durationDays, 10) || 7,
 quantity: qty,
 unitPrice: med.price,
 instructions: item.instructions.trim() || 'Take as directed',
 }]);
 setItem((s) => ({ ...s, dosage: '', instructions: '' }));
 showToast(`Added ${med.name} to prescription.`, 'success');
 };

 const submit = async (e) => {
 e.preventDefault();
 if (!patientId) return showToast('Please select a patient.', 'error');
 if (!cart.length) return showToast('Please add at least one medication from the pharmacy stock.', 'error');
 const { ok } = await run(
 () => Api.issuePrescription({ patientId, diagnosis: diagnosis.trim() || 'Clinical Consultation', notes: notes.trim(), items: cart }),
 (rx) => `Prescription successfully issued to ${rx.patientName}!`
 );
 if (ok) {
 setCart([]);
 setDiagnosis('');
 setNotes('');
 history.reload();
 }
 };

 const saveEdit = async () => {
 const items = editing.items.map((i) => ({ ...i, quantity: parseInt(i.quantity, 10) || 1 }));
 const { ok } = await run(
 () => Api.updatePrescription(editing.id, { diagnosis: editing.diagnosis, notes: editing.notes, items, status: 'MODIFIED' }),
 'Prescription updated successfully!'
 );
 if (ok) {
 setEditing(null);
 history.reload();
 }
 };

 const setEditItem = (idx, key, value) =>
 setEditing((rx) => ({ ...rx, items: rx.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)) }));

 return (
 <>
 <SectionHeader
 title="Issue Medication Prescription"
 subtitle="Prescribe drugs strictly verified in current dispensary inventory, adjust dosages, and edit active orders"
 />

 <div className="prescription-builder-grid">
 <div className="rx-card">
 <h3><span></span> Clinical Prescription Cart</h3>
 <form onSubmit={submit}>
 <div className="form-group">
 <label className="form-label">Select Patient <span className="req">*</span></label>
 <select className="form-control" value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
 <option value="">-- Select Patient --</option>
 {patients.data.map((p) => (
 <option key={p.id} value={p.id}>{p.name} - Age {p.age ?? '—'} - Blood {p.bloodGroup || '—'}</option>
 ))}
 </select>
 </div>
 <div className="form-group">
 <label className="form-label">Clinical Diagnosis <span className="req">*</span></label>
 <input className="form-control" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Stage 1 Essential Hypertension" required />
 </div>

 <div style={{ borderTop: '1px dashed var(--border-subtle)', margin: '18px 0', paddingTop: 14 }}>
 <label className="form-label" style={{ color: 'var(--accent-emerald)' }}>Add Drug from Pharmacy Stock <span className="req">*</span></label>
 <select className="form-control" style={{ marginBottom: 12 }} value={item.medicineId} onChange={setI('medicineId')}>
 <option value="">
 {meds.data.length ? `-- Choose in-stock medicine (${meds.data.length} available) --` : 'No pharmacy stock currently available'}
 </option>
 {meds.data.map((m) => (
 <option key={m.id} value={m.id}>{m.name} ({m.dosageForm}) - In Stock: {m.quantity} | {money(m.price)}</option>
 ))}
 </select>
 <div className="form-row">
 <div className="form-group"><label className="form-label">Dosage</label><input className="form-control" value={item.dosage} onChange={setI('dosage')} placeholder="500 mg" /></div>
 <div className="form-group"><label className="form-label">Frequency Schedule</label><input className="form-control" value={item.frequency} onChange={setI('frequency')} placeholder="1-0-1 after meals" /></div>
 </div>
 <div className="form-row">
 <div className="form-group"><label className="form-label">Duration in Days</label><input type="number" min="1" className="form-control" value={item.durationDays} onChange={setI('durationDays')} /></div>
 <div className="form-group"><label className="form-label">Total Units to Dispense</label><input type="number" min="1" className="form-control" value={item.quantity} onChange={setI('quantity')} /></div>
 </div>
 <div className="form-group">
 <label className="form-label">Clinical Usage Instructions</label>
 <input className="form-control" value={item.instructions} onChange={setI('instructions')} placeholder="e.g. Take with plenty of water. Monitor morning BP." />
 </div>
 <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={addItem}>+ Add Medicine to Prescription</button>
 </div>

 <div className="form-group">
 <label className="form-label">Dietary and Lifestyle Advice</label>
 <textarea className="form-control" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Low sodium, aerobic exercise 30 min daily..." />
 </div>

 <div className="rx-items-list">
 {!cart.length && <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 20 }}>No medications added yet. Pick from available pharmacy stock above.</div>}
 {cart.map((it, idx) => (
 <div className="rx-item-row" key={idx}>
 <div>
 <h4>{it.medicineName} <span style={{ color: 'var(--accent-emerald)', fontSize: '0.82rem' }}>({it.dosage})</span></h4>
 <p>{it.frequency} • {it.durationDays} Days • Qty: {it.quantity} units</p>
 <small style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>{it.instructions}</small>
 </div>
 <button type="button" className="btn-danger" onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}>✕ Remove</button>
 </div>
 ))}
 </div>

 <button type="submit" className="btn-primary" style={{ marginTop: 18 }} disabled={busy}>Issue &amp; Save Prescription</button>
 </form>
 </div>

 <div className="rx-card">
 <h3><span></span> Issued Prescriptions</h3>
 <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>Review and modify active prescriptions issued to your patients</p>
 <div className="table-container" style={{ maxHeight: 520 }}>
 <table className="data-table">
 <thead><tr><th>Patient</th><th>Diagnosis</th><th>Medicines Prescribed</th><th>Notes</th><th>Status</th><th>Action</th></tr></thead>
 <tbody>
 <TableStatus colSpan={6} loading={history.loading && !history.data.length} error={history.error} empty={!history.data.length} emptyText="No prescriptions issued yet." />
 {!history.error && history.data.map((rx) => (
 <tr key={rx.id}>
 <td><strong>{rx.patientName}</strong></td>
 <td>{rx.diagnosis}</td>
 <td>
 <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.85rem', color: 'var(--accent-mint)' }}>
 {(rx.items || []).map((i, k) => <li key={k}>{i.medicineName} ({i.dosage}, {i.quantity} units)</li>)}
 </ul>
 </td>
 <td><small style={{ color: 'var(--text-muted)' }}>{rx.notes || '—'}</small></td>
 <td><span className="badge badge-accepted">{rx.status}</span></td>
 <td>
 <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}
 onClick={() => setEditing(JSON.parse(JSON.stringify(rx)))}>Edit Rx</button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>

 <Modal open={Boolean(editing)} title="Edit Patient Prescription" onClose={() => setEditing(null)} maxWidth={720}>
 {editing && (
 <>
 <div style={{ marginBottom: 14 }}><strong>Patient:</strong> <span style={{ color: 'var(--accent-emerald)' }}>{editing.patientName}</span></div>
 <div className="form-group">
 <label className="form-label">Diagnosis</label>
 <input className="form-control" value={editing.diagnosis || ''} onChange={(e) => setEditing((rx) => ({ ...rx, diagnosis: e.target.value }))} />
 </div>
 <div className="form-group">
 <label className="form-label">Prescribed Medicines</label>
 <table className="data-table" style={{ fontSize: '0.84rem' }}>
 <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Qty</th></tr></thead>
 <tbody>
 {editing.items.map((it, idx) => (
 <tr key={idx}>
 <td><strong>{it.medicineName}</strong></td>
 <td><input className="form-control" style={{ padding: 6 }} value={it.dosage || ''} onChange={(e) => setEditItem(idx, 'dosage', e.target.value)} /></td>
 <td><input className="form-control" style={{ padding: 6 }} value={it.frequency || ''} onChange={(e) => setEditItem(idx, 'frequency', e.target.value)} /></td>
 <td><input type="number" min="1" className="form-control" style={{ padding: 6, width: 70 }} value={it.quantity ?? ''} onChange={(e) => setEditItem(idx, 'quantity', e.target.value)} /></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <div className="form-group">
 <label className="form-label">Doctor Notes and Instructions</label>
 <textarea className="form-control" rows={2} value={editing.notes || ''} onChange={(e) => setEditing((rx) => ({ ...rx, notes: e.target.value }))} />
 </div>
 <div className="modal-actions">
 <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
 <button type="button" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={busy} onClick={saveEdit}>Save Updates</button>
 </div>
 </>
 )}
 </Modal>
 </>
 );
}
