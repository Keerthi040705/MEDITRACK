import { useState } from 'react';
import DashboardLayout, { StatCard } from '../../components/DashboardLayout';
import ProfileTab from '../../components/ProfileTab';
import { useAuth } from '../../context/AuthContext';
import { Api } from '../../api/client';
import { useApi } from '../../utils/useApi';
import { isExpired, isLow, money } from '../../utils/format';
import Stock from './Stock';
import Sales from './Sales';

const TABS = [
 { key: 'stock', label: ' Stock Management' },
 { key: 'sales', label: ' Sales History & Invoices' },
 { key: 'profile', label: ' Pharmacist Profile' },
];

export default function PharmacistDashboard() {
 const { user } = useAuth();
 const [tab, setTab] = useState('stock');
 const meds = useApi(() => Api.getMedicines(), []);
 const sales = useApi(() => Api.getSalesHistory(), []);

 const revenue = sales.data.reduce((s, o) => s + (o.totalAmount || 0), 0);

 return (
 <DashboardLayout
 subtitle="Dispensary Inventory & Billing"
 metaLine={user.pharmacyName || 'Dispensary'}
 tabs={TABS}
 activeTab={tab}
 onTabChange={setTab}
 stats={
 <>
 <StatCard title="Total Active Products" value={meds.data.length} sub="Stock catalog entries" />
 <StatCard title="Low Stock Alerts" value={meds.data.filter(isLow).length} sub="Items at or below threshold" valueStyle={{ color: 'var(--status-warning)' }} />
 <StatCard title="Expired Batches" value={meds.data.filter(isExpired).length} sub="Past expiry date" valueStyle={{ color: 'var(--status-danger)' }} />
 <StatCard title="Total Dispensary Revenue" value={money(revenue)} sub="Completed sales history" />
 </>
 }
 >
 {tab === 'stock' && <Stock state={meds} />}
 {tab === 'sales' && <Sales state={sales} />}
 {tab === 'profile' && (
 <ProfileTab
 heading="Pharmacist & Dispensary Profile"
 subheading="Manage dispensary license credentials, store address, and contact numbers"
 badge={() => 'Licensed Pharmacist • Dispensary Admin'}
 view={[
 { label: 'Dispensary Store Name', value: (u) => u.pharmacyName || 'Dispensary', style: { color: 'var(--accent-mint)' } },
 { label: 'Drug License Reg. No.', value: (u) => u.drugLicenseNumber || 'N/A', style: { fontFamily: 'var(--font-mono)' } },
 { label: 'Store Address', value: (u) => u.pharmacyAddress || 'N/A' },
 { label: 'Dispensary Contact Phone', value: (u) => u.storePhone || u.phone || 'N/A' },
 { label: 'Pharmacist Direct Email', value: (u) => u.email || u.userId },
 ]}
 editTitle="Edit Pharmacist Profile"
 successMessage="Pharmacist profile updated!"
 editFields={[
 { key: 'name', label: 'Full Name', required: true, full: true },
 { key: 'email', label: 'Email Address', type: 'email' },
 { key: 'phone', label: 'Phone', type: 'tel' },
 { key: 'pharmacyName', label: 'Dispensary Store Name' },
 { key: 'drugLicenseNumber', label: 'Drug License Reg. No.' },
 { key: 'pharmacyAddress', label: 'Dispensary Address', full: true },
 { key: 'storePhone', label: 'Store Phone', type: 'tel', full: true },
 ]}
 />
 )}
 </DashboardLayout>
 );
}
