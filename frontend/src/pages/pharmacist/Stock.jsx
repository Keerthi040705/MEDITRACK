import { useMemo, useState } from 'react';
import { SectionHeader, TableStatus } from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import { Api } from '../../api/client';
import { useAction } from '../../utils/useApi';
import { addDaysStr, isExpired, isLow, money } from '../../utils/format';
import { DOSAGE_FORMS, MEDICINE_CATEGORIES } from '../../constants';

const newStockForm = () => ({
 id: null, name: '', genericName: '', category: 'Cardiovascular', dosageForm: 'Tablet',
 batchNumber: `BAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
 price: '15.00', quantity: '100', expiryDate: addDaysStr(365), manufacturer: '', minStockThreshold: '15',
});

export default function Stock({ state }) {
 const { data: meds, loading, error, reload } = state;
 const { busy, run } = useAction();
 const [search, setSearch] = useState('');
 const [filter, setFilter] = useState('ALL');
 const [form, setForm] = useState(null); // null = modal closed

 const expired = meds.filter(isExpired);
 const low = meds.filter(isLow);

 const shown = useMemo(() => {
 let list = meds;
 if (filter === 'LOW') list = list.filter(isLow);
 else if (filter === 'EXPIRED') list = list.filter(isExpired);
 else if (filter !== 'ALL') list = list.filter((m) => (m.category || '').toUpperCase() === filter.toUpperCase());
 const q = search.trim().toLowerCase();
 if (q) {
 list = list.filter((m) => [m.name, m.genericName, m.batchNumber].some((v) => (v || '').toLowerCase().includes(q)));
 }
 return list;
 }, [meds, filter, search]);

 const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

 const openEdit = (m) => setForm({
 id: m.id, name: m.name, genericName: m.genericName || '', category: m.category || 'Cardiovascular',
 dosageForm: m.dosageForm || 'Tablet', batchNumber: m.batchNumber || '', price: m.price, quantity: m.quantity,
 expiryDate: m.expiryDate || '', manufacturer: m.manufacturer || '', minStockThreshold: m.minStockThreshold ?? 15,
 });

 const save = async (e) => {
 e.preventDefault();
 const data = {
 name: form.name.trim(), genericName: form.genericName.trim(), category: form.category, dosageForm: form.dosageForm,
 batchNumber: form.batchNumber.trim(), price: parseFloat(form.price) || 0, quantity: parseInt(form.quantity, 10) || 0,
 expiryDate: form.expiryDate, manufacturer: form.manufacturer.trim(), minStockThreshold: parseInt(form.minStockThreshold, 10) || 0,
 };
 const { ok } = await run(
 () => (form.id ? Api.updateMedicine(form.id, data) : Api.addMedicine(data)),
 form.id ? `"${data.name}" updated.` : `"${data.name}" added to inventory.`
 );
 if (ok) {
 setForm(null);
 reload();
 }
 };

 const restock = async (m) => {
 const { ok } = await run(() => Api.updateMedicine(m.id, { quantity: m.quantity + 50 }), `Restocked ${m.name} (+50). Total: ${m.quantity + 50}`);
 if (ok) reload();
 };

 const remove = async (m) => {
 if (!window.confirm(`Delete ${m.name} (batch ${m.batchNumber || 'N/A'}) from inventory?`)) return;
 const { ok } = await run(() => Api.deleteMedicine(m.id), `${m.name} deleted from inventory.`);
 if (ok) reload();
 };

 const purgeExpired = async () => {
 const { ok } = await run(() => Api.removeExpiredMedicines(), (res) => (res.removedCount
 ? `Auto-purge complete: ${res.removedCount} expired batch(es) removed.`
 : 'No expired medications found.'));
 if (ok) reload();
 };

 return (
 <>
 {expired.length > 0 && (
 <div className="alert-banner-expired" style={{ display: 'flex' }}>
 <div>
 <strong style={{ color: '#f87171', fontSize: '1rem' }}> Expired Medication Warning</strong>
 <p style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: 2 }}>
 {expired.length} expired batch(es) in stock: {expired.map((m) => m.name).join(', ')}.
 </p>
 </div>
 <button type="button" className="btn-danger" style={{ fontSize: '0.88rem', padding: '8px 18px' }} disabled={busy} onClick={purgeExpired}>
 Auto-Remove All Expired Batches
 </button>
 </div>
 )}

 {low.length > 0 && (
 <div className="alert-banner-low" style={{ display: 'flex' }}>
 <div>
 <strong style={{ color: '#fbbf24', fontSize: '1rem' }}> Low Stock Alert</strong>
 <p style={{ fontSize: '0.85rem', color: '#fde68a', marginTop: 2 }}>
 {low.length} item(s) at or below reorder threshold: {low.map((m) => `${m.name} (${m.quantity} left)`).join(', ')}.
 </p>
 </div>
 <button type="button" className="btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setFilter('LOW')}>Filter Low Stock Items</button>
 </div>
 )}

 <SectionHeader
 title="Pharmaceutical Inventory & Stock Control"
 subtitle="Add medicines, adjust prices and quantities, remove expired drugs, and configure safety thresholds"
 >
 <button type="button" className="btn-primary" style={{ width: 'auto', padding: '10px 22px' }} onClick={() => setForm(newStockForm())}>+ Add New Medicine Stock</button>
 </SectionHeader>

 <div className="inventory-actions-bar">
 <div className="search-filter-wrap">
 <input className="form-control" style={{ maxWidth: 280 }} placeholder="Search by name, generic, or batch..." value={search} onChange={(e) => setSearch(e.target.value)} />
 <select className="form-control" style={{ maxWidth: 220 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
 <option value="ALL">All Categories</option>
 <option value="LOW"> Low Stock Alert</option>
 <option value="EXPIRED"> Expired Batches</option>
 {MEDICINE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
 </select>
 </div>
 <button type="button" className="btn-secondary" onClick={reload}>↻ Refresh Inventory</button>
 </div>

 <div className="table-container">
 <table className="data-table">
 <thead>
 <tr><th>Medicine Name</th><th>Generic Name</th><th>Category</th><th>Dosage Form</th><th>Batch Number</th><th>Unit Price</th><th>Stock Qty</th><th>Expiry Date</th><th>Status</th><th>Quick Actions</th></tr>
 </thead>
 <tbody>
 <TableStatus colSpan={10} loading={loading && !meds.length} error={error} empty={!shown.length} emptyText="No medicine inventory records found." />
 {!error && shown.map((m) => {
 const exp = isExpired(m);
 const lowStock = isLow(m);
 return (
 <tr key={m.id}>
 <td><strong>{m.name}</strong></td>
 <td>{m.genericName || '—'}</td>
 <td><span className="badge badge-accepted" style={{ fontSize: '0.72rem' }}>{m.category || 'General'}</span></td>
 <td>{m.dosageForm || 'Tablet'}</td>
 <td><code style={{ color: 'var(--accent-mint)' }}>{m.batchNumber || 'N/A'}</code></td>
 <td><strong>{money(m.price)}</strong></td>
 <td><strong style={{ color: lowStock ? 'var(--status-warning)' : 'var(--accent-emerald)', fontSize: '1rem' }}>{m.quantity}</strong></td>
 <td style={{ color: exp ? 'var(--status-danger)' : 'inherit' }}>{m.expiryDate || 'N/A'}</td>
 <td>
 {exp ? <span className="badge badge-expired">Expired</span>
 : lowStock ? <span className="badge badge-low-stock">Low Stock ({m.quantity})</span>
 : <span className="badge badge-in-stock">In Stock</span>}
 </td>
 <td>
 <div style={{ display: 'flex', gap: 6 }}>
 <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.78rem' }} onClick={() => openEdit(m)}>Edit</button>
 <button type="button" className="btn-success" style={{ padding: '4px 8px', fontSize: '0.78rem' }} disabled={busy} onClick={() => restock(m)}>+50</button>
 <button type="button" className="btn-danger" style={{ padding: '4px 6px', fontSize: '0.78rem' }} disabled={busy} onClick={() => remove(m)}>✕</button>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 <Modal open={Boolean(form)} title={form?.id ? 'Edit Medicine Stock' : 'Add New Pharmaceutical Stock'} onClose={() => setForm(null)}>
 {form && (
 <form onSubmit={save}>
 <div className="form-row">
 <div className="form-group"><label className="form-label">Brand Medicine Name <span className="req">*</span></label><input className="form-control" required value={form.name} onChange={set('name')} placeholder="e.g. Metformin HCl" /></div>
 <div className="form-group"><label className="form-label">Generic Chemical Name</label><input className="form-control" value={form.genericName} onChange={set('genericName')} placeholder="e.g. Metformin" /></div>
 </div>
 <div className="form-row">
 <div className="form-group">
 <label className="form-label">Therapeutic Category</label>
 <select className="form-control" value={form.category} onChange={set('category')}>{MEDICINE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
 </div>
 <div className="form-group">
 <label className="form-label">Dosage Form</label>
 <select className="form-control" value={form.dosageForm} onChange={set('dosageForm')}>{DOSAGE_FORMS.map((d) => <option key={d}>{d}</option>)}</select>
 </div>
 </div>
 <div className="form-row">
 <div className="form-group"><label className="form-label">Batch Number</label><input className="form-control" value={form.batchNumber} onChange={set('batchNumber')} /></div>
 <div className="form-group"><label className="form-label">Unit Retail Price <span className="req">*</span></label><input type="number" step="0.01" min="0" className="form-control" required value={form.price} onChange={set('price')} /></div>
 </div>
 <div className="form-row">
 <div className="form-group"><label className="form-label">Stock Quantity <span className="req">*</span></label><input type="number" min="0" className="form-control" required value={form.quantity} onChange={set('quantity')} /></div>
 <div className="form-group"><label className="form-label">Expiry Date <span className="req">*</span></label><input type="date" className="form-control" required value={form.expiryDate} onChange={set('expiryDate')} /></div>
 </div>
 <div className="form-row">
 <div className="form-group"><label className="form-label">Manufacturer</label><input className="form-control" value={form.manufacturer} onChange={set('manufacturer')} placeholder="e.g. Pfizer Labs" /></div>
 <div className="form-group"><label className="form-label">Low Stock Alert Threshold</label><input type="number" min="0" className="form-control" value={form.minStockThreshold} onChange={set('minStockThreshold')} /></div>
 </div>
 <div className="modal-actions">
 <button type="button" className="btn-secondary" onClick={() => setForm(null)}>Cancel</button>
 <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={busy}>Save Inventory Record</button>
 </div>
 </form>
 )}
 </Modal>
 </>
 );
}
