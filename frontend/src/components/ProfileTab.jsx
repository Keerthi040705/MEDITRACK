import { useState } from 'react';
import Modal from './Modal';
import { SectionHeader } from './DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { Api } from '../api/client';
import { useAction } from '../utils/useApi';
import { useToast } from '../context/ToastContext';

/**
 * Profile view + edit modal, configured per role.
 *  view:      [{ label, value(user), style? }]
 *  sections:  [{ label, value(user), style? }]   (full-width blocks under the grid)
 *  editFields:[{ key, label, type?, options?, rows?, required? }]
 */
export default function ProfileTab({ heading, subheading, badge, view, sections = [], editFields, editTitle, successMessage }) {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [passwordForm, setPasswordForm] = useState({ userId: user.userId || '', oldPassword: '', newPassword: '' });
  const { busy, run } = useAction();

  const openEditor = () => {
    setForm(Object.fromEntries(editFields.map((f) => [f.key, user[f.key] ?? ''])));
    setOpen(true);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try { const r = await Api.changePassword(passwordForm); showToast(r.message, 'success'); setPasswordForm({ userId: user.userId || '', oldPassword: '', newPassword: '' }); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {};
    for (const f of editFields) {
      const v = form[f.key];
      payload[f.key] = f.type === 'number' ? (v === '' ? null : Number(v)) : String(v ?? '').trim();
    }
    const { ok, result } = await run(() => Api.updateProfile(user.id, payload), successMessage);
    if (ok) {
      updateUser(result);
      setOpen(false);
    }
  };

  const half = [];
  const rows = [];
  editFields.forEach((f) => (f.full ? rows.push([f]) : half.push(f)));
  for (let i = 0; i < half.length; i += 2) rows.push(half.slice(i, i + 2));

  const renderInput = (f) => {
    const common = {
      className: 'form-control',
      value: form[f.key] ?? '',
      required: f.required,
      onChange: (e) => setForm((s) => ({ ...s, [f.key]: e.target.value })),
    };
    if (f.options) {
      // options may be plain strings or { value, label }
      return (
        <select {...common}>
          {f.options.map((o) => {
            const { value, label } = typeof o === 'string' ? { value: o, label: o } : o;
            return <option key={value} value={value}>{label}</option>;
          })}
        </select>
      );
    }
    if (f.rows) return <textarea {...common} rows={f.rows} />;
    return <input {...common} type={f.type || 'text'} />;
  };

  return (
    <>
      <SectionHeader title={heading} subtitle={subheading} />
      <div className="profile-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>{user.name}</h2>
            <span className="badge badge-accepted" style={{ fontSize: '0.85rem', marginTop: 6 }}>{badge(user)}</span>
          </div>
          <button type="button" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={openEditor}>Edit Profile</button>
        </div>

        <div className="profile-grid">
          {view.map((v) => (
            <div key={v.label}>
              <small>{v.label}</small>
              <p style={v.style}>{v.value(user)}</p>
            </div>
          ))}
        </div>

        {sections.map((s) => (
          <div className="profile-section" key={s.label}>
            <small>{s.label}</small>
            <p style={{ marginTop: 4, lineHeight: 1.6, ...(s.style || { color: 'var(--text-muted)' }) }}>{s.value(user)}</p>
          </div>
        ))}
      </div>

      <div className="profile-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginBottom: 14 }}>Change Password</h3>
        <form onSubmit={changePassword}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Username</label><input className="form-control" required value={passwordForm.userId} onChange={(e) => setPasswordForm((v) => ({ ...v, userId: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Old Password</label><input className="form-control" type="password" required value={passwordForm.oldPassword} onChange={(e) => setPasswordForm((v) => ({ ...v, oldPassword: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">New Password</label><input className="form-control" type="password" minLength={8} required value={passwordForm.newPassword} onChange={(e) => setPasswordForm((v) => ({ ...v, newPassword: e.target.value }))} /></div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Update Password</button>
        </form>
      </div>

      <Modal open={open} title={editTitle} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          {rows.map((row, i) => (
            <div className={row.length > 1 ? 'form-row' : undefined} key={i}>
              {row.map((f) => (
                <div className="form-group" key={f.key}>
                  <label className="form-label">{f.label}</label>
                  {renderInput(f)}
                </div>
              ))}
            </div>
          ))}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={busy}>
              {busy ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
