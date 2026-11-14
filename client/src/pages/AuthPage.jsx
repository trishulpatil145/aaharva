import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Brand, Button, Field, Notice } from '../components/Ui';
import { useAuth } from '../contexts/AuthContext';

const roleOptions = [
  { value: 'restaurant', label: 'Restaurant / food business', detail: 'Donate food or list surplus meals' },
  { value: 'ngo', label: 'NGO / community organization', detail: 'Accept and distribute donations' },
  { value: 'rescue_partner', label: 'Rescue partner', detail: 'Coordinate food pickup and delivery' },
  { value: 'school', label: 'Government school', detail: 'Request supplementary food support' },
  { value: 'buyer', label: 'Community buyer', detail: 'Find affordable surplus food' }
];
const organizationRoles = new Set(['restaurant', 'ngo', 'rescue_partner', 'school']);

export default function AuthPage({ mode = 'login' }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'restaurant', phone: '', organizationName: '', registrationNumber: '', address: '', city: '', state: 'Karnataka', postalCode: '' });
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const needsOrganization = isRegister && organizationRoles.has(form.role);

  async function submit(event) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      if (isRegister) {
        const payload = { name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role, phone: form.phone };
        if (needsOrganization) payload.organization = { name: form.organizationName.trim(), registrationNumber: form.registrationNumber.trim(), address: form.address.trim(), city: form.city.trim(), state: form.state.trim(), postalCode: form.postalCode.trim() };
        await register(payload);
        navigate('/dashboard', { replace: true });
      } else {
        await login({ email: form.email.trim(), password: form.password });
        navigate(location.state?.from || '/dashboard', { replace: true });
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return <div className="auth-screen">
    <aside className="auth-aside"><div className="auth-aside-pattern"/><Brand light /><div className="auth-aside-content"><div className="auth-aside-icon">✳</div><p className="eyebrow">Small acts. Shared impact.</p><h2>Food brings us<br />closer together.</h2><p>Connect surplus with purpose. Aaharva helps communities rescue food responsibly, one coordinated handover at a time.</p><div className="auth-aside-quote"><span>“</span><p>Good food should nourish people, not become waste.</p></div></div><div className="auth-aside-footer"><span>Rescue Food. Reduce Waste. Nourish Lives.</span><span>01 — Community first</span></div></aside>
    <main className="auth-main"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-wrap"><div className="auth-form-heading"><p className="eyebrow">{isRegister ? 'Join the network' : 'Welcome back'}</p><h1>{isRegister ? 'Be part of the change.' : 'Good to see you again.'}</h1><p>{isRegister ? 'Set up your account and help good food find its next destination.' : 'Sign in to your Aaharva workspace and pick up where you left off.'}</p></div>
      <Notice type="error">{error}</Notice>
      <form className="form-stack" onSubmit={submit}>
        {isRegister && <><Field label="Your full name" required><input autoComplete="name" value={form.name} onChange={e => set('name', e.target.value)} required minLength={2} maxLength={100} placeholder="e.g. Ananya Rao" /></Field>
          <Field label="I’m joining as" required><select value={form.role} onChange={e => set('role', e.target.value)}>{roleOptions.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select><span className="field-hint">{roleOptions.find(item => item.value === form.role)?.detail}</span></Field></>}
        <Field label="Email address" required><input type="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} required maxLength={254} placeholder="you@organization.in" /></Field>
        {isRegister && <Field label="Phone number" hint="Optional — used for coordination details." ><input type="tel" autoComplete="tel" value={form.phone} onChange={e => set('phone', e.target.value)} maxLength={30} placeholder="+91 98765 43210" /></Field>}
        <Field label="Password" required hint={isRegister ? 'At least 10 characters with uppercase, lowercase and a number.' : undefined}><div className="password-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={e => set('password', e.target.value)} required minLength={isRegister ? 10 : 1} maxLength={128} placeholder={isRegister ? 'Create a strong password' : 'Enter your password'} /><button type="button" className="password-toggle" onClick={() => setShowPassword(x => !x)}>{showPassword ? 'Hide' : 'Show'}</button></div></Field>
        {needsOrganization && <div className="organization-fields"><div className="form-section-label"><span>Organization details</span><small>Required for verification</small></div><Field label="Organization name" required><input value={form.organizationName} onChange={e => set('organizationName', e.target.value)} required maxLength={180} placeholder="Registered organization name" /></Field><Field label="Registration ID" hint="Optional — an administrator may request verification documents later."><input value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value)} maxLength={100} placeholder="Registration / license number" /></Field><Field label="Street address" required><input autoComplete="street-address" value={form.address} onChange={e => set('address', e.target.value)} required maxLength={400} placeholder="Building, street, area" /></Field><div className="form-grid-two"><Field label="City" required><input autoComplete="address-level2" value={form.city} onChange={e => set('city', e.target.value)} required maxLength={100} placeholder="Bengaluru" /></Field><Field label="State" required><input autoComplete="address-level1" value={form.state} onChange={e => set('state', e.target.value)} required maxLength={100} /></Field></div><Field label="PIN code"><input autoComplete="postal-code" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} maxLength={12} placeholder="560001" /></Field></div>}
        <Button type="submit" block loading={loading} className="auth-submit">{loading ? (isRegister ? 'Creating account…' : 'Signing in…') : (isRegister ? 'Create your account' : 'Sign in')} <span>→</span></Button>
      </form>
      <p className="auth-switch">{isRegister ? 'Already part of Aaharva?' : 'New to the Aaharva network?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
      {isRegister && <p className="auth-footnote">Organization accounts stay pending until reviewed. Administrator accounts can only be created through the secure server-side seed process.</p>}
      <p className="auth-back"><Link to="/">← Back to Aaharva</Link></p>
    </div><div className="auth-bottom-note">Designed for responsible food sharing in India.</div></main>
  </div>;
}
