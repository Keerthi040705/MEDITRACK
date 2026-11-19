import { useMemo, useState } from 'react';
import { SectionHeader, TableStatus } from '../../components/DashboardLayout';
import InvoiceModal from '../../components/InvoiceModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Api } from '../../api/client';
import { useAction, useApi } from '../../utils/useApi';
import { fmtDate, money } from '../../utils/format';
import { MEDICINE_CATEGORIES } from '../../constants';

export default function Pharmacy({ cart, setCart }) {
 const { user } = useAuth();
 const { showToast } = useToast();
 const { busy, run } = useAction();

 const meds = useApi(() => Api.getAvailableMedicines(), []);
 const prescriptions = useApi(() => Api.getPatientPrescriptions(user.id), [user.id]);
 const orders = useApi(() => Api.getPatientOrders(user.id), [user.id]);

 const [search, setSearch] = useState('');
 const [category, setCategory] = useState('ALL');
 const [invoice, setInvoice] = useState(null);
 const [deliveryAddress, setDeliveryAddress] = useState('');

 const filtered = useMemo(() => {
 const q = search.trim().toLowerCase();
 return meds.data.filter((m) =>
 (category === 'ALL' || (m.category || '').toUpperCase() === category.toUpperCase()) &&
 (!q || m.name.toLowerCase().includes(q) || (m.genericName || '').toLowerCase().includes(q))
 );
 }, [meds.data, search, category]);

 /** Returns false if stock would be exceeded */
 const addToCart = (med, qty = 1, silent = false) => {
 const existing = cart.find((c) => c.medicineId === med.id);
 const newQty = (existing?.quantity || 0) + qty;
 if (newQty > med.quantity) {
 showToast(`Cannot add more ${med.name} than in stock (${med.quantity}).`, 'error');
 return false;
 }
 setCart((c) => (existing
 ? c.map((i) => (i.medicineId === med.id ? { ...i, quantity: newQty } : i))
 : [...c, { medicineId: med.id, medicineName: med.name, unitPrice: med.price, stock: med.quantity, quantity: qty }]));
 if (!silent) showToast(`Added ${med.name} to cart.`, 'success');
 return true;
 };

 const updateQty = (id, value) => {
 const qty = parseInt(value, 10);
 setCart((c) => (Number.isFinite(qty) && qty > 0
 ? c.map((i) => (i.medicineId === id ? { ...i, quantity: Math.min(qty, i.stock) } : i))
 : c.filter((i) => i.medicineId !== id)));
 };

 const orderPrescription = (rx) => {
 let added = 0;
 const missing = [];
 for (const item of rx.items || []) {
 const name = item.medicineName.toLowerCase();
 const med = meds.data.find((m) => m.id === item.medicineId) ||
 meds.data.find((m) => m.name.toLowerCase().includes(name) || name.includes(m.name.toLowerCase()));
 if (med && addToCart(med, Math.min(item.quantity || 1, med.quantity), true)) added += 1;
 else missing.push(item.medicineName);
 }
 if (added) showToast(`Added ${added} prescribed medicine(s) to your cart.`, 'success');
 if (missing.length) showToast(`Not available in the dispensary right now: ${missing.join(', ')}`, 'error');
 };

 const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
 const tax = Math.round(subtotal * 0.05 * 100) / 100;
 const total = Math.round((subtotal + tax) * 100) / 100;

 const checkout = async () => {
 if (!cart.length) return showToast('Your cart is empty.', 'error');
 if (!deliveryAddress.trim()) return showToast('Please enter your delivery address.', 'error');
 const { ok, result } = await run(
 () => Api.createOrder({
 items: cart.map((i) => ({ medicineId: i.medicineId, quantity: i.quantity })),
 deliveryAddress: deliveryAddress.trim(),
 }),
 'Order placed successfully! Bill generated.'
 );
 if (ok) {
 setCart([]);
 setDeliveryAddress('');
 setInvoice(result);
 meds.reload();
 orders.reload();
 }
 };

 return (
 <>
 <SectionHeader
 title="Order Medicines & Detailed Itemized Bill"
 subtitle="Order doctor-prescribed medications or browse available pharmacy stock with instant itemized invoices"
 />

 <div style={{ marginBottom: 24 }}>
 <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-emerald)', marginBottom: 8 }}> Active Doctor Prescriptions:</h3>
 {!prescriptions.loading && !prescriptions.data.length && (
 <div style={{ padding: 14, background: 'rgba(0,255,136,0.04)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
 No active prescriptions from your doctor currently.
 </div>
 )}
 {prescriptions.data.map((rx) => (
 <div key={rx.id} style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid var(--border-active)', borderRadius: 'var(--radius-md)', padding: 18, marginBottom: 14 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
 <div>
 <strong style={{ color: '#fff', fontSize: '1rem' }}>Prescribed by {rx.doctorName}</strong>
 <span className="badge badge-accepted" style={{ marginLeft: 10 }}>{rx.status}</span>
 </div>
 <button type="button" className="btn-secondary" style={{ fontSize: '0.82rem', padding: '5px 12px' }} onClick={() => orderPrescription(rx)}>Order Prescribed Medicines</button>
 </div>
 <p style={{ fontSize: '0.86rem', color: 'var(--accent-mint)' }}><strong>Diagnosis:</strong> {rx.diagnosis}</p>
 <ul style={{ paddingLeft: 20, margin: '8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
 {(rx.items || []).map((i, k) => <li key={k}>{i.medicineName} — {i.dosage} ({i.frequency}, {i.durationDays} Days, {i.quantity} units)</li>)}
 </ul>
 {rx.notes && <small style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Advice: {rx.notes}</small>}
 </div>
 ))}
 </div>

 <div className="prescription-builder-grid">
 <div>
 <div className="inventory-actions-bar">
 <div className="search-filter-wrap">
 <input className="form-control" style={{ maxWidth: 260 }} placeholder="Search medications..." value={search} onChange={(e) => setSearch(e.target.value)} />
 <select className="form-control" style={{ maxWidth: 190 }} value={category} onChange={(e) => setCategory(e.target.value)}>
 <option value="ALL">All Categories</option>
 {MEDICINE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
 </select>
 </div>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
 {meds.loading && !meds.data.length && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading pharmacy stock…</div>}
 {!meds.loading && !filtered.length && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No available pharmacy stock matches your criteria.</div>}
 {filtered.map((m) => (
 <div className="pillar-card" key={m.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
 <div>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
 <span className="badge badge-accepted">{m.category}</span>
 <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>{money(m.price)}</span>
 </div>
 <h3 style={{ fontSize: '1.05rem', marginBottom: 4 }}>{m.name}</h3>
 <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{m.genericName} ({m.dosageForm})</p>
 <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 4 }}>Mfg: {m.manufacturer || 'Certified Pharma'}</p>
 </div>
 <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
 <small style={{ color: 'var(--accent-mint)', fontWeight: 600 }}>In Stock: {m.quantity}</small>
 <button type="button" className="btn-primary" style={{ width: 'auto', padding: '6px 16px', fontSize: '0.85rem' }} onClick={() => addToCart(m)}>+ Add</button>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className="rx-card" style={{ height: 'fit-content' }}>
 <h3><span></span> Order Cart &amp; Checkout</h3>
 <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 14 }}>
 {!cart.length && <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>Your order cart is empty.</div>}
 {cart.map((item) => (
 <div key={item.medicineId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', gap: 8 }}>
 <div>
 <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{item.medicineName}</strong>
 <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{money(item.unitPrice)} each</div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <input type="number" min="1" max={item.stock} className="form-control" style={{ width: 60, padding: 4 }}
 value={item.quantity} onChange={(e) => updateQty(item.medicineId, e.target.value)} />
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontWeight: 700, width: 70, textAlign: 'right' }}>{money(item.unitPrice * item.quantity)}</span>
 <button type="button" className="btn-danger" style={{ padding: '2px 7px' }} onClick={() => updateQty(item.medicineId, 0)}>✕</button>
 </div>
 </div>
 ))}
 </div>

 <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginBottom: 18 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.9rem' }}><span style={{ color: 'var(--text-muted)' }}>Items Subtotal:</span><span style={{ fontWeight: 700 }}>{money(subtotal)}</span></div>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.9rem' }}><span style={{ color: 'var(--text-muted)' }}>Medical Tax 5%:</span><span style={{ fontWeight: 700 }}>{money(tax)}</span></div>
 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: 10 }}><span>Total Amount:</span><span>{money(total)}</span></div>
 </div>
 <div style={{ marginBottom: 16 }}>
 <label className="form-label" htmlFor="medicine-delivery-address">Patient Delivery Address <span className="req">*</span></label>
 <textarea
 id="medicine-delivery-address"
 className="form-control"
 rows={3}
 placeholder="Enter house/flat number, street, area, city, state and PIN code"
 value={deliveryAddress}
 onChange={(e) => setDeliveryAddress(e.target.value)}
 required
 />
 <small style={{ color: 'var(--text-muted)' }}>The pharmacist will use this address to deliver your medicines.</small>
 </div>
 <button type="button" className="btn-primary" disabled={busy || !cart.length || !deliveryAddress.trim()} onClick={checkout}>
 {busy ? 'Placing order…' : 'Place Order & Generate Itemized Bill'}
 </button>
 </div>
 </div>

 <div style={{ marginTop: 36 }}>
 <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: 14 }}> Past Pharmacy Invoices &amp; Receipts</h3>
 <div className="table-container">
 <table className="data-table">
 <thead><tr><th>Bill Invoice #</th><th>Order Date</th><th>Medicines Purchased</th><th>Status</th><th>Total Billed</th><th>Action</th></tr></thead>
 <tbody>
 <TableStatus colSpan={6} loading={orders.loading && !orders.data.length} error={orders.error} empty={!orders.data.length} emptyText="No past medication orders found." />
 {!orders.error && orders.data.map((o) => (
 <tr key={o.id}>
 <td><strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-mint)' }}>{o.billNumber}</strong></td>
 <td>{fmtDate(o.orderDate)}</td>
 <td>{(o.items || []).map((i) => `${i.medicineName} (${i.quantity})`).join(', ')}</td>
 <td><span className="badge badge-accepted">{o.paymentStatus}</span></td>
 <td><strong>{money(o.totalAmount)}</strong></td>
 <td><button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setInvoice(o)}>View Bill</button></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 <InvoiceModal order={invoice} onClose={() => setInvoice(null)} />
 </>
 );
}
