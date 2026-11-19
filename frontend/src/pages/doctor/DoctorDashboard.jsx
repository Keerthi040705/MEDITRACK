import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import ProfileTab from '../../components/ProfileTab';
import { useAuth } from '../../context/AuthContext';
import { Api } from '../../api/client';
import { useApi } from '../../utils/useApi';
import Appointments from './Appointments';
import Prescribe from './Prescribe';
import Performance from './Performance';
import { mapsLink } from '../../utils/format';

const CONSULT_LABEL = { BOTH: 'Online and In-person', OFFLINE: 'In-person only (clinic)', ONLINE: 'Online only (video call)' };

const TABS = [
 { key: 'appointments', label: ' Patient Appointments' },
 { key: 'prescribe', label: ' Prescribe Medication' },
 { key: 'performance', label: ' Patient Daily Performance & Logs' },
 { key: 'profile', label: ' Doctor Profile' },
];

export default function DoctorDashboard() {
 const { user } = useAuth();
 const [tab, setTab] = useState('appointments');

 // Loaded here so the stats row stays correct on every tab
 const appts = useApi(() => Api.getDoctorAppointments(user.id), [user.id]);
 const logs = useApi(() => Api.getDoctorHealthLogs(user.id), [user.id]);


 return (
 <DashboardLayout
 subtitle="Physician Clinical Dashboard"
 metaLine={user.specialization || 'Physician'}
 tabs={TABS}
 activeTab={tab}
 onTabChange={setTab}
 >
 {tab === 'appointments' && <Appointments state={appts} />}
 {tab === 'prescribe' && <Prescribe />}
 {tab === 'performance' && <Performance state={logs} />}
 {tab === 'profile' && (
 <ProfileTab
 heading="Doctor Professional Profile"
 subheading="Manage your medical licensing, clinical affiliations, and consultation hours"
 badge={(u) => u.specialization || 'Clinical Doctor'}
 view={[
 { label: 'Medical License No.', value: (u) => u.licenseNumber || 'N/A', style: { color: 'var(--accent-mint)', fontFamily: 'var(--font-mono)' } },
 { label: 'Hospital / Clinic', value: (u) => u.hospital || 'N/A' },
 { label: 'Years of Experience', value: (u) => `${u.experienceYears ?? 0} Years` },
 { label: 'Consultation Hours', value: (u) => u.consultationHours || 'By Appointment' },
 { label: 'Email Contact', value: (u) => u.email || u.userId },
 { label: 'Phone', value: (u) => u.phone || 'N/A' },
 { label: 'Consultation Type', value: (u) => CONSULT_LABEL[u.consultationMode || 'BOTH'] },
 { label: 'Video-call Link', value: (u) => u.meetingLink || (u.consultationMode === 'OFFLINE' ? 'Not needed' : 'Not set (asked when accepting)'), style: { wordBreak: 'break-all' } },
 ]}
 sections={[
 {
 label: 'Clinic Location (shown to patients booking in-person visits)',
 value: (u) => {
 if (u.consultationMode === 'ONLINE') return 'Online consultations only.';
 if (!u.clinicAddress) return ' No clinic address yet — patients cannot book in-person visits until you add one.';
 const map = mapsLink(u.clinicAddress, u.clinicCity, u.clinicMapUrl);
 return (
 <>
 {[u.clinicAddress, u.clinicCity].filter(Boolean).join(', ')}
 {map && <> · <a href={map} target="_blank" rel="noopener noreferrer">Open in Google Maps </a></>}
 </>
 );
 },
 style: { color: '#fff' },
 },
 { label: 'Professional Biography', value: (u) => u.bio || 'No biography entered yet.' },
 ]}
 editTitle="Edit Physician Profile"
 successMessage="Doctor profile updated successfully!"
 editFields={[
 { key: 'name', label: 'Full Name', required: true, full: true },
 { key: 'email', label: 'Email Address', type: 'email' },
 { key: 'specialization', label: 'Specialization' },
 { key: 'licenseNumber', label: 'Medical License No.' },
 { key: 'hospital', label: 'Hospital or Practice' },
 { key: 'experienceYears', label: 'Experience in Years', type: 'number' },
 { key: 'consultationHours', label: 'Consultation Hours' },
 { key: 'phone', label: 'Phone Contact', type: 'tel' },
 {
 key: 'consultationMode', label: 'Consultation Type',
 options: Object.entries(CONSULT_LABEL).map(([value, label]) => ({ value, label })),
 },
 { key: 'clinicAddress', label: 'Clinic Address (for in-person visits)', full: true },
 { key: 'clinicCity', label: 'City & PIN' },
 { key: 'clinicMapUrl', label: 'Google Maps Link (optional)', type: 'url' },
 { key: 'meetingLink', label: 'Default Video-call Link (for online visits)', type: 'url', full: true },
 { key: 'bio', label: 'Biography', rows: 3, full: true },
 ]}
 />
 )}
 </DashboardLayout>
 );
}
