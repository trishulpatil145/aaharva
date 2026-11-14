import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Brand, StatusPill } from '../components/Ui';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: '⌂', roles: '*' },
  { to: '/donations', label: 'Food donations', icon: '♧', roles: ['restaurant', 'ngo', 'admin'] },
  { to: '/marketplace', label: 'Surplus marketplace', icon: '◈', roles: '*' },
  { to: '/orders', label: 'Orders', icon: '▤', roles: ['buyer', 'restaurant', 'admin'] },
  { to: '/requests', label: 'School support', icon: '⌂', roles: ['school', 'restaurant', 'ngo', 'admin'] },
  { to: '/deliveries', label: 'Rescue & delivery', icon: '↗', roles: ['rescue_partner', 'restaurant', 'ngo', 'school', 'admin'] },
  { to: '/notifications', label: 'Notifications', icon: '♢', roles: '*' },
  { to: '/complaints', label: 'Help & safety', icon: '◉', roles: '*' },
  { to: '/admin', label: 'Administration', icon: '⌘', roles: ['admin'] }
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const items = useMemo(() => navigation.filter(item => item.roles === '*' || item.roles.includes(user?.role)), [user?.role]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    const loadCount = () => api.get('/notifications', { params: { unread: 'true', limit: 1 } }).then(data => { if (active) setUnread(data.unread || 0); }).catch(() => {});
    void loadCount();
    const timer = window.setInterval(loadCount, 45000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?._id]);

  async function doLogout() {
    setLoggingOut(true);
    try { await logout(); navigate('/', { replace: true }); }
    finally { setLoggingOut(false); }
  }

  return <div className="app-frame">
    <aside className="sidebar">
      <div className="sidebar-brand"><Brand /></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {items.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `side-link ${isActive ? 'side-link-active' : ''}`}>
          <span className="side-link-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{item.to === '/notifications' && unread > 0 && <span className="nav-count">{unread > 9 ? '9+' : unread}</span>}
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help"><span className="help-icon">✳</span><div><strong>Food has value.</strong><p>Every rescue can make a difference.</p></div></div>
        <button className="sidebar-profile" onClick={() => navigate('/profile')}>
          <span className="avatar">{user?.name?.trim()?.slice(0, 1)?.toUpperCase() || 'A'}</span>
          <span className="profile-copy"><strong>{user?.name}</strong><small>{roleLabel(user?.role)}</small></span><span className="profile-more">···</span>
        </button>
      </div>
    </aside>

    <div className="app-main">
      <header className="topbar">
        <div className="mobile-brand"><Brand compact /><span>aaharva<span className="brand-dot">.</span></span></div>
        <div className="topbar-left"><span className="topbar-context">Good work starts here</span><span className="topbar-separator">/</span><span className="topbar-current">{roleLabel(user?.role)} workspace</span></div>
        <div className="topbar-actions">
          <button className="icon-button notification-button" onClick={() => navigate('/notifications')} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><span aria-hidden="true">♢</span>{unread > 0 && <i />}</button>
          <button className="topbar-user" onClick={() => setProfileMenu(value => !value)} aria-expanded={profileMenu} aria-label="Open account menu"><span className="avatar avatar-small">{user?.name?.trim()?.slice(0, 1)?.toUpperCase() || 'A'}</span><span>{user?.name?.split(' ')[0]}</span><span aria-hidden="true">⌄</span></button>
          {profileMenu && <div className="profile-popover"><button onClick={() => { navigate('/profile'); setProfileMenu(false); }}>Profile & settings</button><button onClick={doLogout} disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Sign out'}</button></div>}
        </div>
      </header>

      {user?.accountStatus !== 'approved' && user?.role !== 'buyer' && user?.role !== 'admin' && <div className={`verification-banner ${user?.accountStatus === 'rejected' ? 'verification-rejected' : ''}`}><span aria-hidden="true">ⓘ</span><div><strong>{user?.accountStatus === 'rejected' ? 'Organization verification needs attention' : 'Your organization is awaiting verification'}</strong><p>{user?.statusReason || 'Operational actions become available after an administrator reviews your organization details.'}</p></div><button onClick={() => navigate('/profile')}>Review profile <span aria-hidden="true">→</span></button></div>}

      <main className="page-content"><Outlet /></main>
      <footer className="app-footer"><span>© {new Date().getFullYear()} Aaharva</span><span>Rescue food. Reduce waste. Nourish lives.</span></footer>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {items.filter(i => ['/dashboard', '/marketplace', '/donations', '/requests', '/notifications'].includes(i.to)).slice(0, 5).map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `mobile-nav-item ${isActive ? 'mobile-nav-active' : ''}`}><span aria-hidden="true">{item.icon}</span><small>{item.label === 'Surplus marketplace' ? 'Market' : item.label === 'Food donations' ? 'Donations' : item.label === 'Notifications' ? 'Alerts' : item.label === 'School support' ? 'Schools' : 'Home'}</small></NavLink>)}
    </nav>
  </div>;
}

function roleLabel(role) {
  return ({ restaurant: 'Food partner', ngo: 'NGO partner', rescue_partner: 'Rescue partner', school: 'School partner', buyer: 'Community buyer', admin: 'Administrator' })[role] || 'Community';
}
