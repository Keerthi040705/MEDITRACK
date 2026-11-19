import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ChatBot from './ChatBot';

/** Common shell: top nav, sub-nav tabs, stats row and the active tab content. */
export default function DashboardLayout({ subtitle, metaLine, tabs, activeTab, onTabChange, stats, children }) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const handleLogout = () => {
    logout();
    showToast('You have been securely logged out.', 'info');
  };

  return (
    <section className="page-view active dashboard-layout">
      <header className="dashboard-nav">
        <div className="brand-badge">
          <div className="brand-text">
            <h1>Online Medication &amp; Prescription Tracker</h1>
            <span>{subtitle}</span>
          </div>
        </div>
        <div className="nav-user-panel">
          <div className="user-meta">
            <div className="user-meta-name">{user?.name}</div>
            <span className="user-meta-role">{metaLine}</span>
          </div>
          <button type="button" className="btn-nav btn-nav-outline" onClick={() => onTabChange('profile')}>Profile</button>
          <button type="button" className="btn-nav btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-subnav">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`subnav-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => onTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="dashboard-content">
        {stats && <div className="stats-grid">{stats}</div>}
        <div className="tab-pane active">{children}</div>
      </main>

      <ChatBot tabs={tabs} onNavigate={onTabChange} />
    </section>
  );
}

export function StatCard({ title, value, sub, valueStyle }) {
  return (
    <div className="stat-card">
      <div className="stat-card-title">{title}</div>
      <div className="stat-card-val" style={valueStyle}>{value}</div>
      <div className="stat-card-sub">{sub}</div>
    </div>
  );
}

export function SectionHeader({ title, subtitle, children }) {
  return (
    <div className="section-header">
      <div className="section-title-wrap">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Loading / error / empty row for tables */
export function TableStatus({ colSpan, loading, error, empty, emptyText }) {
  if (loading) return <tr><td colSpan={colSpan} className="table-status">Loading…</td></tr>;
  if (error) return <tr><td colSpan={colSpan} className="table-status error">Could not load: {error}</td></tr>;
  if (empty) return <tr><td colSpan={colSpan} className="table-status">{emptyText}</td></tr>;
  return null;
}
