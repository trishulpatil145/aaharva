import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button, EmptyState, Loading, Notice, PageHeader } from '../components/Ui';
import { dateTime, humanize } from '../utils/format';

export default function NotificationsPage() {
  const [data, setData] = useState({ items: [], unread: 0 }); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busyId, setBusyId] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await api.get('/notifications', { params: { limit: 80 } }); setData(result); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function markRead(id) { setBusyId(id); try { await api.post(`/notifications/${id}/read`, {}); setMessage('Notification marked as read.'); await load(); } catch (e) { setError(e.message); } finally { setBusyId(''); } }
  async function markAllRead() { setBusyId('all'); try { const result = await api.post('/notifications/read-all', {}); setMessage(`${result.markedRead} notification(s) marked as read.`); await load(); } catch (e) { setError(e.message); } finally { setBusyId(''); } }
  return <div className="page-stack"><PageHeader eyebrow="Your updates" title="Keep every handover in view." description="Notifications come from saved platform events: verification decisions, donation status changes, orders and safety follow-up." action={<Button variant="secondary" onClick={markAllRead} disabled={!data.unread} loading={busyId === 'all'}>Mark all read</Button>} />
    {error && <Notice type="error">{error}</Notice>}{message && <Notice type="success" onClose={() => setMessage('')}>{message}</Notice>}
    <div className="notification-summary"><span className="notification-summary-icon">♢</span><div><strong>{data.unread || 0} unread notification{data.unread === 1 ? '' : 's'}</strong><p>Only your account's notifications are shown here.</p></div><button className="subtle-link" onClick={load}>Refresh ↻</button></div>
    {loading ? <Loading label="Loading notifications…" /> : data.items?.length ? <div className="notification-list">{data.items.map(item => <article className={`panel notification-card ${!item.readAt ? 'notification-unread' : ''}`} key={item._id}><span className="notification-icon">{iconFor(item.type)}</span><div className="notification-content"><div className="notification-card-heading"><strong>{item.title}</strong>{!item.readAt && <span className="unread-tag">New</span>}</div><p>{item.message}</p><div className="notification-card-meta"><span>{humanize(item.type)}</span><span>{dateTime(item.createdAt)}</span></div></div>{!item.readAt && <Button size="small" variant="secondary" onClick={() => markRead(item._id)} loading={busyId === item._id}>Mark read</Button>}</article>)}</div> : <EmptyState icon="♢" title="You're all caught up" description="New updates appear here when a donation, organization, order or delivery changes." />}
  </div>;
}
function iconFor(type) { if (String(type).includes('safety') || String(type).includes('incident')) return '!'; if (String(type).includes('order')) return '▤'; if (String(type).includes('donation')) return '♧'; if (String(type).includes('delivery') || String(type).includes('assignment')) return '↗'; if (String(type).includes('organization')) return '⌂'; return '✳'; }
