import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import ProfileTab from '../../components/ProfileTab';
import { useAuth } from '../../context/AuthContext';
import { BLOOD_GROUPS, GENDERS } from '../../constants';
import Appointments from './Appointments';
import Pharmacy from './Pharmacy';
import SymptomChecker from './SymptomChecker';
import DnnPredictor from './DnnPredictor';
import HealthLogs from './HealthLogs';

const TABS = [
 { key: 'appointments', label: ' Appointments' },
 { key: 'pharmacy', label: ' Order Medicines & Bills' },
 { key: 'symptoms', label: ' Symptom Checker' },
 { key: 'dnn', label: ' Disease Risk Models (ML)' },
 { key: 'healthlogs', label: ' Daily Health Updates' },
 { key: 'profile', label: ' Medical Profile' },
];

export default function PatientDashboard() {
 const { user } = useAuth();
 const [tab, setTab] = useState('appointments');
 const [cart, setCart] = useState([]); // kept here so it survives tab switches
 const [dnnKey, setDnnKey] = useState('diabetes');

 return (
 <DashboardLayout
 subtitle="Patient Health Portal"
 metaLine={`Blood: ${user.bloodGroup || '—'}`}
 tabs={TABS}
 activeTab={tab}
 onTabChange={setTab}
 >
 {tab === 'appointments' && <Appointments />}
 {tab === 'pharmacy' && <Pharmacy cart={cart} setCart={setCart} />}
 {tab === 'symptoms' && <SymptomChecker onOpenModel={(k) => { setDnnKey(k); setTab('dnn'); }} />}
 {tab === 'dnn' && <DnnPredictor initialKey={dnnKey} />}
 {tab === 'healthlogs' && <HealthLogs />}
 {tab === 'profile' && (
 <ProfileTab
 heading="Patient Medical Profile"
 subheading="Manage your health history, emergency contacts, and recorded allergies"
 badge={(u) => `Patient Member • Blood ${u.bloodGroup || '—'}`}
 view={[
 { label: 'Age / Gender', value: (u) => `${u.age ?? '—'} Yrs • ${u.gender || '—'}` },
 { label: 'Blood Group', value: (u) => u.bloodGroup || '—', style: { color: 'var(--accent-mint)' } },
 { label: 'Primary Phone', value: (u) => u.phone || 'N/A' },
 { label: 'Emergency Contact', value: (u) => u.emergencyContact || 'N/A' },
 { label: 'Account Email', value: (u) => u.email || u.userId },
 ]}
 sections={[
 { label: 'Known Allergies & Drug Sensitivities', value: (u) => u.allergies || 'No known allergies reported.', style: { color: '#fca5a5', fontWeight: 600 } },
 { label: 'Medical History', value: (u) => u.medicalHistory || 'No pre-existing conditions logged.' },
 ]}
 editTitle="Edit Patient Profile"
 successMessage="Patient medical profile updated!"
 editFields={[
 { key: 'name', label: 'Full Name', required: true, full: true },
 { key: 'email', label: 'Email Address', type: 'email' },
 { key: 'age', label: 'Age', type: 'number' },
 { key: 'gender', label: 'Gender', options: GENDERS },
 { key: 'bloodGroup', label: 'Blood Group', options: BLOOD_GROUPS },
 { key: 'phone', label: 'Phone', type: 'tel' },
 { key: 'emergencyContact', label: 'Emergency Contact', full: true },
 { key: 'allergies', label: 'Known Allergies', full: true },
 { key: 'medicalHistory', label: 'Medical History', rows: 2, full: true },
 ]}
 />
 )}
 </DashboardLayout>
 );
}
