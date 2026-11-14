import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button, Field, Loading, Notice, PageHeader, StatusPill } from '../components/Ui';
import { dateTime, humanize } from '../utils/format';

export default function ProfilePage() {
  const { user, refresh, logout } = useAuth(); const navigate = useNavigate();
  const [organization, setOrganization] = useState(null); const [verification, setVerification] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [savingProfile, setSavingProfile] = useState(false); const [savingPassword, setSavingPassword] = useState(false);
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' }); const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const hasOrganization = ['restaurant', 'ngo', 'rescue_partner', 'school'].includes(user?.role);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    if (!hasOrganization) { setLoading(false); return; }
    try { const data = await api.get('/organizations/me'); setOrganization(data.organization); setVerification(data.verification); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [hasOrganization]);
  useEffect(() => { void load(); }, [load]);
  async function saveProfile(event) { event.preventDefault(); setSavingProfile(true); setError(''); setMessage(''); try { await api.patch('/auth/profile', profile); await refresh(); setMessage('Profile updated.'); } catch (e) { setError(e.message); } finally { setSavingProfile(false); } }
  async function changePassword(event) {
    event.preventDefault(); setSavingPassword(true); setError(''); setMessage('');
    try { await api.post('/auth/change-password', password); await logout(); navigate('/login', { replace: true }); }
    catch (e) { setError(e.message); }
    finally { setSavingPassword(false); }
  }

  return <div className="page-stack"><PageHeader eyebrow="Account settings" title="Your profile, your workspace." description="Manage your contact details, review verification status and keep your account secure." />
    {error && <Notice type="error">{error}</Notice>}{message && <Notice type="success" onClose={() => setMessage('')}>{message}</Notice>}
    <div className="profile-grid"><section className="panel profile-panel"><div className="profile-panel-heading"><span className="profile-large-avatar">{user?.name?.trim()?.slice(0, 1)?.toUpperCase() || 'A'}</span><div><h2>{user?.name}</h2><p>{user?.email}</p><StatusPill status={user?.accountStatus} /></div></div><div className="profile-facts"><div><small>Account type</small><strong>{humanize(user?.role)}</strong></div><div><small>Phone number</small><strong>{user?.phone || 'Not added'}</strong></div><div><small>Member since</small><strong>{dateTime(user?.createdAt).split(',')[0]}</strong></div></div><form className="form-stack profile-edit-form" onSubmit={saveProfile}><div className="profile-section-label"><h3>Personal details</h3><p>Your name and a coordination contact.</p></div><Field label="Full name" required><input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} required minLength={2} maxLength={100} /></Field><Field label="Phone number"><input type="tel" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} maxLength={30} placeholder="Add a phone number" /></Field><Button type="submit" loading={savingProfile}>Save profile</Button></form></section>
    <div className="profile-side-column">{hasOrganization && <section className="panel organization-panel"><div className="panel-heading-row"><div><h2>Organization verification</h2><p>Operational access depends on an authorized review.</p></div><span className="organization-status-icon">⌂</span></div>{loading ? <Loading label="Loading organization status…" /> : organization ? <><div className="organization-profile-name"><strong>{organization.name}</strong><StatusPill status={organization.verificationStatus} /></div><p className="organization-address">{organization.address}<br />{organization.city}, {organization.state} {organization.postalCode}</p><div className="verification-steps"><div className={organization.verificationStatus !== 'pending' ? 'verification-step-done' : 'verification-step-current'}><span>1</span><div><strong>Application received</strong><small>Organization details are on file</small></div></div><div className={organization.verificationStatus === 'approved' ? 'verification-step-done' : organization.verificationStatus === 'rejected' ? 'verification-step-rejected' : ''}><span>2</span><div><strong>Administrator review</strong><small>{verification?.reviewedAt ? `Reviewed ${dateTime(verification.reviewedAt)}` : 'Awaiting authorized review'}</small></div></div></div>{verification?.reason && <Notice type={verification.status === 'rejected' ? 'error' : 'info'}>{verification.reason}</Notice>}</> : <p className="panel-empty-text">No organization profile is linked to this user.</p>}</section>}
      <section className="panel password-panel"><div className="profile-section-label"><h3>Change password</h3><p>Changing your password signs out current sessions.</p></div><form className="form-stack" onSubmit={changePassword}><Field label="Current password" required><input type="password" autoComplete="current-password" value={password.currentPassword} onChange={e => setPassword(p => ({ ...p, currentPassword: e.target.value }))} required maxLength={128} /></Field><Field label="New password" required hint="At least 10 characters with uppercase, lowercase and a number."><input type="password" autoComplete="new-password" value={password.newPassword} onChange={e => setPassword(p => ({ ...p, newPassword: e.target.value }))} required minLength={10} maxLength={128} /></Field><Button variant="secondary" type="submit" loading={savingPassword}>Update password</Button></form></section>
      <section className="privacy-note"><span>♢</span><div><strong>Your account is protected</strong><p>Passwords are hashed by the server. Your session cookie is HttpOnly and your private notifications are only available to your account.</p></div></section>
    </div></div>
  </div>;
}
