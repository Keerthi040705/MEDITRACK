import { useState } from 'react';
import { SectionHeader, TableStatus } from '../../components/DashboardLayout';
import InvoiceModal from '../../components/InvoiceModal';
import { fmtDate, fmtTime, money } from '../../utils/format';

export default function Sales({ state }) {
  const { data: orders, loading, error, reload } = state;
  const [invoice, setInvoice] = useState(null);

  return (
    <>
      <SectionHeader title="Dispensary Sales History & Invoices" subtitle="Complete audit of all filled patient medication orders and generated bills">
        <button type="button" className="btn-secondary" onClick={reload}>↻ Refresh Sales</button>
      </SectionHeader>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr><th>Bill / Invoice #</th><th>Order Timestamp</th><th>Customer / Patient</th><th>Delivery Address</th><th>Items</th><th>Amount Billed</th><th>Payment Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            <TableStatus colSpan={8} loading={loading && !orders.length} error={error} empty={!orders.length} emptyText="No sales transactions logged yet." />
            {!error && orders.map((o) => (
              <tr key={o.id}>
                <td><strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-mint)' }}>{o.billNumber}</strong></td>
                <td><span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(o.orderDate)}</span><br /><small style={{ color: 'var(--text-muted)' }}>{fmtTime(o.orderDate)}</small></td>
                <td><strong>{o.patientName || 'Customer'}</strong><br /><small style={{ color: 'var(--text-dim)' }}>{o.patientEmail}</small></td>
                <td style={{ minWidth: 190, maxWidth: 260, whiteSpace: 'normal' }}>{o.deliveryAddress || 'Address not available'}</td>
                <td>
                  <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {(o.items || []).map((i, k) => <li key={k}>{i.medicineName} × {i.quantity}</li>)}
                  </ul>
                </td>
                <td><strong>{money(o.totalAmount)}</strong></td>
                <td><span className="badge badge-accepted">{o.paymentStatus || 'PAID'}</span></td>
                <td><button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setInvoice(o)}>View Invoice</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InvoiceModal order={invoice} onClose={() => setInvoice(null)} />
    </>
  );
}
