import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import ConnectionBanner from './components/ConnectionBanner';
import Splash from './pages/Splash';
import AuthPage from './pages/AuthPage';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import PatientDashboard from './pages/patient/PatientDashboard';
import PharmacistDashboard from './pages/pharmacist/PharmacistDashboard';

const DASHBOARDS = {
  doctor: DoctorDashboard,
  patient: PatientDashboard,
  pharmacist: PharmacistDashboard,
};

export default function App() {
  const { user } = useAuth();
  const [screen, setScreen] = useState('splash'); // 'splash' | 'auth' (when signed out)

  let content;
  if (user) {
    const Dashboard = DASHBOARDS[user.role];
    content = Dashboard ? <Dashboard key={user.id} /> : <AuthPage />;
  } else if (screen === 'splash') {
    content = <Splash onEnter={() => setScreen('auth')} />;
  } else {
    content = <AuthPage onBack={() => setScreen('splash')} />;
  }

  return (
    <>
      <ConnectionBanner />
      {content}
    </>
  );
}
