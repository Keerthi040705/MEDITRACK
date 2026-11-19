import { useRef } from 'react';
import Modal from './Modal';
import { fmtDate, fmtTime, money } from '../utils/format';

/** Itemized bill, used by the patient (after checkout / past orders) and the pharmacist (sales history). */
export default function InvoiceModal({ order, onClose }) {
 const paperRef = useRef(null);

 const print = () => {
 if (!paperRef.current) return;
 const w = window.open('', '', 'width=800,height=600');
 if (!w) return;
 w.document.write(`<html><head><title>Medical Prescription Bill ${order.billNumber}</title>
 <style>
 body { font-family: sans-serif; background: #fff; color: #111; padding: 30px; }
 table { width: 100%; border-collapse: collapse; margin: 18px 0; }
 th, td { border-bottom: 1px solid #ddd; padding: 10px; text-align: left; }
 th { background: #f3f3f3; }
 .invoice-top, .invoice-totals-row { display: flex; justify-content: space-between; }
 .invoice-grand-total { font-size: 1.2rem; font-weight: bold; }
 </style></head><body>${paperRef.current.outerHTML}</body></html>`);
 w.document.close();
 w.focus();
 w.print();
 };

 return (
 <Modal open={Boolean(order)} title="Itemized Medical Bill & Receipt" onClose={onClose} maxWidth={660}>
 {order && (
 <>
 <div className="invoice-paper" ref={paperRef}>
 <div className="invoice-top">
 <div>
 <div className="invoice-brand">Healthcare Dispensary</div>
 <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
 Medical District Dispensary • License #PH-DL-2026-9981
 </p>
 </div>
 <div style={{ textAlign: 'right' }}>
 <div className="invoice-bill-no">{order.billNumber}</div>
 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
 {fmtDate(order.orderDate)} {fmtTime(order.orderDate)}
 </div>
 <span className="badge badge-accepted" style={{ marginTop: 6 }}>{order.paymentStatus || 'PAID'} &amp; VERIFIED</span>
 </div>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18, fontSize: '0.85rem' }}>
 <div><strong style={{ color: 'var(--text-dim)' }}>PATIENT:</strong> {order.patientName} ({order.patientEmail || ''})</div>
 <div><strong style={{ color: 'var(--text-dim)' }}>DISPENSARY REF:</strong> {order.doctorName || 'Central Dispensary'}</div>
 <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-dim)' }}>DELIVERY ADDRESS:</strong> {order.deliveryAddress || 'Not provided'}</div>
 </div>

 <table className="invoice-summary-table">
 <thead>
 <tr>
 <th>Item Description</th>
 <th style={{ textAlign: 'center' }}>Qty</th>
 <th style={{ textAlign: 'right' }}>Unit Price</th>
 <th style={{ textAlign: 'right' }}>Line Total</th>
 </tr>
 </thead>
 <tbody>
 {(order.items || []).map((i, idx) => (
 <tr key={idx}>
 <td>{i.medicineName}</td>
 <td style={{ textAlign: 'center' }}>{i.quantity}</td>
 <td style={{ textAlign: 'right' }}>{money(i.unitPrice)}</td>
 <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-mint)' }}>
 {money(i.lineTotal ?? i.unitPrice * i.quantity)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>

 <div className="invoice-totals">
 <div className="invoice-totals-row"><span style={{ color: 'var(--text-muted)' }}>Subtotal:</span><strong>{money(order.subtotal)}</strong></div>
 <div className="invoice-totals-row"><span style={{ color: 'var(--text-muted)' }}>Healthcare Dispensary Tax (5%):</span><strong>{money(order.taxAmount)}</strong></div>
 <div className="invoice-totals-row" style={{ marginTop: 8 }}>
 <span className="invoice-grand-total">Total Billed:</span>
 <span className="invoice-grand-total">{money(order.totalAmount)}</span>
 </div>
 </div>

 <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px dashed var(--border-subtle)', paddingTop: 14, fontSize: '0.78rem', color: 'var(--text-dim)' }}>
 This is an official itemized pharmacy bill. Consult your prescribing physician for specific dosage instructions.
 </div>
 </div>
 <div className="modal-actions">
 <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
 <button type="button" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={print}> Print or Save Receipt</button>
 </div>
 </>
 )}
 </Modal>
 );
}
