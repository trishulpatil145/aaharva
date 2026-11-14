import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button, EmptyState, Loading, Notice, PageHeader, ResourceMeta, StatusPill } from '../components/Ui';
import { dateTime, humanize } from '../utils/format';

const nextActions = { accepted: [{ status: 'pickup_scheduled', label: 'Schedule pickup' }, { status: 'cancelled', label: 'Cancel', variant: 'secondary' }], pickup_scheduled: [{ status: 'picked_up', label: 'Confirm pickup' }, { status: 'failed', label: 'Report failed pickup', variant: 'secondary' }], picked_up: [{ status: 'in_transit', label: 'Start delivery' }, { status: 'failed', label: 'Report issue', variant: 'secondary' }], in_transit: [{ status: 'delivered', label: 'Confirm delivered' }, { status: 'failed', label: 'Report failed delivery', variant: 'secondary' }], delivered: [{ status: 'completed', label: 'Complete assignment' }] };

export default function DeliveriesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busyId, setBusyId] = useState(''); const [timelines, setTimelines] = useState({});
  const canAccept = user?.role === 'rescue_partner';
  const load = useCallback(async () => { setLoading(true); setError(''); try { const data = await api.get('/assignments', { params: { limit: 60 } }); setItems(data.items || []); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(item, action) {
    setBusyId(item._id); setError(''); setMessage('');
    try {
      if (action === 'accept') await api.post(`/assignments/${item._id}/accept`, {});
      else if (action === 'decline') await api.post(`/assignments/${item._id}/decline`, { notes: 'Not available to take this collection.' });
      else await api.post(`/assignments/${item._id}/status`, { status: action, notes: action === 'failed' ? 'Failure reported by assigned rescue partner; follow-up required.' : '' });
      setMessage(action === 'accept' ? 'Assignment accepted. Update each collection and delivery milestone as it happens.' : action === 'decline' ? 'Offer declined for your account; it remains available to other rescue partners.' : `Delivery milestone updated to ${humanize(action)}.`);
      await load();
      if (timelines[item._id]) await loadTimeline(item._id);
    } catch (e) { setError(e.message); }
    finally { setBusyId(''); }
  }

  async function loadTimeline(id) {
    try { const data = await api.get(`/assignments/${id}/events`); setTimelines(p => ({ ...p, [id]: data.events || [] })); }
    catch (e) { setError(e.message); }
  }
  async function toggleTimeline(item) {
    if (Object.prototype.hasOwnProperty.call(timelines, item._id)) { setTimelines(p => { const next = { ...p }; delete next[item._id]; return next; }); return; }
    await loadTimeline(item._id);
  }

  return <div className="page-stack"><PageHeader eyebrow="Rescue partner network" title="Move food safely, step by step." description="Assignments keep pickup, transport and handover events connected. Update a status only after that milestone actually happens." action={<Button variant="secondary" onClick={load}>Refresh deliveries ↻</Button>} />
    {error && <Notice type="error">{error}</Notice>}{message && <Notice type="success" onClose={() => setMessage('')}>{message}</Notice>}
    <Notice type="info">Aaharva records status updates and supplied coordinates only. Continuous GPS tracking and estimated arrival times are not provided.</Notice>
    {loading ? <Loading label="Loading rescue assignments…" /> : items.length ? <div className="resource-list">{items.map(item => { const donation = item.donationId || {}; const assignedToMe = String(item.rescuePartnerId?._id || item.rescuePartnerId || '') === String(user?._id); const availableToAccept = canAccept && item.status === 'offered' && !item.rescuePartnerId; const actions = assignedToMe || user?.role === 'admin' ? (nextActions[item.status] || []) : []; return <article className="panel delivery-card" key={item._id}><div className="delivery-card-top"><div className="delivery-icon">↗</div><div className="delivery-heading"><h3>{donation.name || 'Food rescue collection'}</h3><ResourceMeta category={donation.category} owner={item.rescuePartnerId?.name ? `Rescue: ${item.rescuePartnerId.name}` : 'Rescue partner needed'} date={item.createdAt} /></div><StatusPill status={item.status} /></div><div className="delivery-route"><div className="route-dot route-dot-start"/><div><small>Collection point</small><p>{item.pickupAddress}</p></div><div className="route-connector"><span>·················</span><b>↧</b></div><div className="route-dot route-dot-end"/><div><small>Destination</small><p>{item.destinationAddress}</p></div></div><div className="delivery-details"><span><small>Safe-use deadline</small><strong>{dateTime(donation.expiresAt)}</strong></span><span><small>Food quantity</small><strong>{donation.quantity || '—'} {donation.unit || ''}</strong></span><span><small>Assignment ID</small><strong>…{String(item._id).slice(-7).toUpperCase()}</strong></span></div>
        <div className="delivery-actions">{availableToAccept && <><Button size="small" onClick={() => act(item, 'accept')} loading={busyId === item._id}>Accept assignment</Button><Button size="small" variant="secondary" onClick={() => act(item, 'decline')} loading={busyId === item._id}>Decline offer</Button></>}{actions.map(action => <Button key={action.status} size="small" variant={action.variant || 'primary'} onClick={() => act(item, action.status)} loading={busyId === item._id}>{action.label}</Button>)}<Button size="small" variant="secondary" onClick={() => toggleTimeline(item)}>{timelines[item._id] ? 'Hide timeline' : 'View timeline'} <span>{timelines[item._id] ? '↑' : '↓'}</span></Button></div>
        {timelines[item._id] && <div className="timeline-list">{timelines[item._id].length ? timelines[item._id].map(event => <div className="timeline-event" key={event._id}><span className="timeline-event-dot"/><div><strong>{humanize(event.status)}</strong><small>{dateTime(event.createdAt)}{event.actorId?.name ? ` · ${event.actorId.name}` : ''}</small>{event.notes && <p>{event.notes}</p>}</div></div>) : <p className="timeline-empty">No delivery events have been recorded yet.</p>}</div>}
      </article>; })}</div> : <EmptyState icon="↗" title="No rescue assignments yet" description={canAccept ? 'New collection offers from eligible donors will appear here.' : 'Assignments related to your organization or donations will appear here when created.'} action={user?.role === 'restaurant' && <span className="subtle-help">Create an assignment from an accepted donation in Food donations.</span>} />}
  </div>;
}
