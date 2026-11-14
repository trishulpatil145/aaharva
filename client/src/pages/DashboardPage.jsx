import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button, EmptyState, Loading, Notice, PageHeader, SectionHeading, StatusPill } from '../components/Ui';
import { dateTime, humanize, money } from '../utils/format';

const roleCopy = {
  restaurant: { eyebrow: 'Your food operations', title: 'Good food, put to good use.', description: 'Keep track of your donations, surplus listings and the people collecting them.' },
  ngo: { eyebrow: 'Community distribution', title: 'Connect food with people.', description: 'Find eligible donations and coordinate responsible collection and handover.' },
  rescue_partner: { eyebrow: 'Rescue operations', title: 'Every handover moves us forward.', description: 'Review available assignments and keep your deliveries up to date.' },
  school: { eyebrow: 'Supplementary food support', title: 'Coordinate support with care.', description: 'Track requests, contributions and confirmed receipts in one place.' },
  buyer: { eyebrow: 'Affordable surplus food', title: 'Good finds. Less waste.', description: 'Discover discounted surplus food and keep track of your orders.' },
  admin: { eyebrow: 'Platform operations', title: 'A clearer view of the network.', description: 'Review actual platform records, partner verifications and safety work.' }
};

export default function DashboardPage() {
  const { user } = useAuth();
  const copy = roleCopy[user?.role] || roleCopy.buyer;
  const [state, setState] = useState({ loading: true, error: '', analytics: null, donations: null, listings: null, orders: null, requests: null, assignments: null });

  useEffect(() => {
    let live = true;
    async function load() {
      setState(prev => ({ ...prev, loading: true, error: '' }));
      try {
        if (user.role === 'admin') {
          const [analytics, orgs, safety, incidents, complaints] = await Promise.all([
            api.get('/admin/analytics'), api.get('/organizations?status=pending&limit=4'), api.get('/admin/safety-queue'), api.get('/incidents?limit=4'), api.get('/complaints?status=open&limit=4')
          ]);
          if (live) setState({ loading: false, error: '', analytics, donations: { items: safety.donations.slice(0, 4), total: safety.donations.length }, listings: { items: safety.listings.slice(0, 4), total: safety.listings.length }, orders: null, requests: { items: orgs.items, total: orgs.total }, assignments: { items: [...incidents.items, ...complaints.items].slice(0, 4), total: incidents.total + complaints.total } });
          return;
        }
        if (user.accountStatus !== 'approved' && user.role !== 'buyer') {
          if (live) setState({ loading: false, error: '', analytics: null, donations: null, listings: null, orders: null, requests: null, assignments: null });
          return;
        }
        const requests = [];
        const keys = [];
        if (['restaurant', 'ngo'].includes(user.role)) { keys.push('donations'); requests.push(api.get('/donations?limit=5')); }
        if (user.role === 'restaurant') { keys.push('listings'); requests.push(api.get('/my-listings?limit=5')); keys.push('orders'); requests.push(api.get('/orders?limit=5')); }
        if (user.role === 'buyer') { keys.push('listings'); requests.push(api.get('/listings?limit=5')); keys.push('orders'); requests.push(api.get('/orders?limit=5')); }
        if (user.role === 'ngo' || user.role === 'school') { keys.push('requests'); requests.push(api.get('/school-requests?limit=5')); }
        if (user.role === 'rescue_partner') { keys.push('assignments'); requests.push(api.get('/assignments?limit=5')); }
        if (['restaurant', 'ngo', 'school'].includes(user.role)) { keys.push('assignments'); requests.push(api.get('/assignments?limit=5')); }
        const settled = await Promise.allSettled(requests);
        const mapped = {};
        settled.forEach((item, index) => { if (item.status === 'fulfilled') mapped[keys[index]] = item.value; else mapped[`${keys[index]}Error`] = item.reason.message; });
        if (live) setState({ loading: false, error: Object.values(mapped).filter(v => typeof v === 'string').join(' '), analytics: null, donations: mapped.donations || null, listings: mapped.listings || null, orders: mapped.orders || null, requests: mapped.requests || null, assignments: mapped.assignments || null });
      } catch (error) { if (live) setState(prev => ({ ...prev, loading: false, error: error.message })); }
    }
    void load();
    return () => { live = false; };
  }, [user?.role, user?.accountStatus]);

  const stats = useMemo(() => {
    if (state.analytics) return [
      { label: 'Users registered', value: state.analytics.users, icon: '♙', tone: 'sage' },
      { label: 'Donations available', value: state.analytics.donationsAvailable, icon: '♧', tone: 'mint' },
      { label: 'Listings active', value: state.analytics.listingsActive, icon: '◈', tone: 'gold' },
      { label: 'Open safety incidents', value: state.analytics.incidentsOpen, icon: '!', tone: 'rose' }
    ];
    return (user.role === 'restaurant' ? [
      { label: 'My donations', value: state.donations?.total ?? '—', icon: '♧', tone: 'sage' }, { label: 'My listings', value: state.listings?.total ?? '—', icon: '◈', tone: 'mint' }, { label: 'Orders to handle', value: state.orders?.total ?? '—', icon: '▤', tone: 'gold' }, { label: 'Rescue assignments', value: state.assignments?.total ?? '—', icon: '↗', tone: 'rose' }
    ] : user.role === 'ngo' ? [
      { label: 'Eligible donations', value: state.donations?.total ?? '—', icon: '♧', tone: 'sage' }, { label: 'School requests', value: state.requests?.total ?? '—', icon: '⌂', tone: 'mint' }, { label: 'Deliveries', value: state.assignments?.total ?? '—', icon: '↗', tone: 'gold' }
    ] : user.role === 'rescue_partner' ? [
      { label: 'Assignments in view', value: state.assignments?.total ?? '—', icon: '↗', tone: 'sage' }, { label: 'Available to accept', value: state.assignments?.items?.filter(x => x.status === 'offered').length ?? '—', icon: '♧', tone: 'mint' }
    ] : user.role === 'school' ? [
      { label: 'My food requests', value: state.requests?.total ?? '—', icon: '⌂', tone: 'sage' }, { label: 'Delivery assignments', value: state.assignments?.total ?? '—', icon: '↗', tone: 'mint' }
    ] : [
      { label: 'Available listings', value: state.listings?.total ?? '—', icon: '◈', tone: 'sage' }, { label: 'My orders', value: state.orders?.total ?? '—', icon: '▤', tone: 'mint' }
    ]);
  }, [state, user?.role]);

  const recent = state.donations?.items || state.listings?.items || state.orders?.items || state.requests?.items || state.assignments?.items || [];
  const quickLinks = quickLinksFor(user?.role);

  if (state.loading) return <Loading label="Gathering your latest Aaharva activity…" />;

  return <div className="page-stack"><PageHeader eyebrow={copy.eyebrow} title={copy.title} description={`${copy.description}${user?.name ? ` Welcome, ${user.name.split(' ')[0]}.` : ''}`} action={<Link className="button button-primary" to={quickLinks[0]?.to || '/marketplace'}>{quickLinks[0]?.label || 'Explore food'} <span>→</span></Link>} />
    {state.error && <Notice type="error">Some workspace data could not be loaded: {state.error}</Notice>}
    <div className="stat-grid">{stats.map(stat => <article className="stat-card" key={stat.label}><div className="stat-card-top"><span>{stat.label}</span><span className={`stat-icon stat-icon-${stat.tone}`}>{stat.icon}</span></div><strong className="stat-value">{stat.value === undefined || stat.value === null ? '—' : typeof stat.value === 'number' ? stat.value.toLocaleString('en-IN') : stat.value}</strong><small>{state.analytics && stat.label === 'Open safety incidents' ? 'Require authorized review' : user?.role === 'admin' ? 'Current database count' : 'From your current records'}</small></article>)}</div>

    {state.analytics && <section className="dashboard-admin-strip"><div><span className="admin-strip-icon">↗</span><div><strong>Verified rescued food</strong><p>Quantity from non-demo donations already delivered, receipt-confirmed or completed.</p></div></div><strong className="admin-strip-number">{Number(state.analytics.verifiedRescuedQuantity || 0).toLocaleString('en-IN')}</strong><small>quantity units · seeded demo data excluded</small></section>}

    <div className="dashboard-main-grid"><section className="panel activity-panel"><SectionHeading title={user?.role === 'admin' ? 'Items needing a closer look' : 'Your latest activity'} subtitle={user?.role === 'admin' ? 'Safety queue and partner verification' : 'Recent items from your workspace'} action={<Link to={user?.role === 'admin' ? '/admin' : (quickLinks[1]?.to || '/marketplace')} className="subtle-link">View all <span>→</span></Link>} />
      {recent.length ? <div className="activity-list">{recent.slice(0, 5).map((item, index) => <article className="activity-item" key={item._id || `${item.title}-${index}`}><span className="activity-symbol">{activitySymbol(item)}</span><div className="activity-copy"><strong>{item.name || item.title || item.listingId?.name || item.donationId?.name || item.category || 'Platform item'}</strong><p>{activityDescription(item, user?.role)}</p><small>{dateTime(item.updatedAt || item.createdAt)}</small></div><StatusPill status={item.status || item.verificationStatus || 'pending'} /></article>)}</div> : <EmptyState icon="♧" title="Your activity will show up here" description={user?.accountStatus === 'approved' || user?.role === 'buyer' ? 'Once you create a donation, order or request, you will see it here.' : 'Complete organization verification to begin operational workflows.'} action={<Link to={quickLinks[0]?.to || '/profile'} className="subtle-link">{quickLinks[0]?.label || 'View profile'} →</Link>} />}
    </section>
    <aside className="dashboard-side-column"><section className="panel quick-panel"><SectionHeading title="Quick actions" subtitle="A useful next step" />{quickLinks.map((link, index) => <Link key={link.to} to={link.to} className="quick-action"><span className={`quick-action-icon quick-action-${index}`}>{link.icon}</span><span><strong>{link.label}</strong><small>{link.description}</small></span><span className="quick-arrow">↗</span></Link>)}</section>
      <section className="safety-note"><div className="safety-note-icon">✓</div><div><strong>Safety before sharing</strong><p>Complete food details, follow handling requirements and report concerns promptly.</p><Link to="/complaints">Help & safety guide <span>→</span></Link></div></section>
    </aside></div>
    <div className="dashboard-bottom-note"><span>✳</span><p><strong>Every action counts.</strong> Aaharva supports responsible food redistribution and affordable surplus access. School assistance is supplementary and does not replace existing meal programs.</p></div>
  </div>;
}

function quickLinksFor(role) {
  if (role === 'restaurant') return [{ to: '/donations', label: 'Create a donation', description: 'Share eligible surplus food', icon: '♧' }, { to: '/marketplace', label: 'List surplus food', description: 'Offer affordable portions', icon: '◈' }, { to: '/orders', label: 'Manage orders', description: 'Review buyer requests', icon: '▤' }];
  if (role === 'ngo') return [{ to: '/donations', label: 'Find donations', description: 'Browse eligible food', icon: '♧' }, { to: '/requests', label: 'School support requests', description: 'Coordinate contributions', icon: '⌂' }, { to: '/deliveries', label: 'Plan a collection', description: 'Review rescue assignments', icon: '↗' }];
  if (role === 'rescue_partner') return [{ to: '/deliveries', label: 'Find assignments', description: 'Accept a collection', icon: '↗' }, { to: '/notifications', label: 'Review notifications', description: 'Check latest updates', icon: '♢' }];
  if (role === 'school') return [{ to: '/requests', label: 'Create a food request', description: 'Request supplementary support', icon: '⌂' }, { to: '/deliveries', label: 'Track deliveries', description: 'Confirm food receipt', icon: '↗' }];
  if (role === 'admin') return [{ to: '/admin', label: 'Review operations', description: 'Verification and safety queues', icon: '⌘' }, { to: '/complaints', label: 'Investigate reports', description: 'Manage complaints and incidents', icon: '◉' }];
  return [{ to: '/marketplace', label: 'Browse surplus food', description: 'Explore affordable options', icon: '◈' }, { to: '/orders', label: 'Check my orders', description: 'View collection details', icon: '▤' }];
}
function activitySymbol(item) { if (item.status?.includes('deliver')) return '↗'; if (item.originalPrice) return '◈'; if (item.requestedQuantity) return '⌂'; if (item.quantity) return '♧'; return '◉'; }
function activityDescription(item, role) { if (item.originalPrice) return `${money(item.discountedPrice)} · ${item.availableQuantity ?? 0} available`; if (item.requestedQuantity) return `${item.receivedQuantity ?? 0} of ${item.requestedQuantity} ${item.unit || ''} received`; if (item.totalAmount !== undefined) return `${money(item.totalAmount)} · ${humanize(item.status)}`; if (item.quantity) return `${item.quantity} ${item.unit || ''} · ${humanize(item.status)}`; if (item.city) return `${item.city}${item.state ? `, ${item.state}` : ''}`; return `${humanize(item.status || 'Open')} · ${role === 'admin' ? 'Review item' : 'Workspace item'}`; }
