import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button, EmptyState, Loading, Notice, PageHeader, ResourceMeta, StatusPill } from '../components/Ui';
import { dateTime, humanize, money } from '../utils/format';

const sellerActions = { placed: [{ status: 'confirmed', label: 'Confirm order' }, { status: 'rejected', label: 'Reject order', variant: 'secondary' }], confirmed: [{ status: 'preparing', label: 'Mark preparing' }, { status: 'cancelled', label: 'Cancel', variant: 'secondary' }], preparing: [{ status: 'ready', label: 'Ready for handover' }], ready: [{ status: 'completed', label: 'Mark completed' }] };

export default function OrdersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busyId, setBusyId] = useState('');
  const isSeller = user?.role === 'restaurant';
  const load = useCallback(async () => { setLoading(true); setError(''); try { const data = await api.get('/orders', { params: { limit: 60 } }); setItems(data.items || []); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(order, status) {
    setBusyId(order._id); setError(''); setMessage('');
    try {
      if (status === 'cancelled' && !isSeller) await api.post(`/orders/${order._id}/cancel`, {});
      else await api.post(`/orders/${order._id}/status`, { status, notes: '' });
      setMessage(status === 'cancelled' ? 'Order cancelled and reserved stock returned.' : `Order updated to ${humanize(status)}.`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(''); }
  }

  return <div className="page-stack"><PageHeader eyebrow="Marketplace orders" title={isSeller ? 'Manage your orders.' : 'Your food orders.'} description={isSeller ? 'Confirm, prepare and hand over buyer orders while keeping every status update recorded.' : 'Review collection details, check order status and cancel eligible orders when plans change.'} action={<Button variant="secondary" onClick={load}>Refresh orders ↻</Button>} />
    {error && <Notice type="error">{error}</Notice>}{message && <Notice type="success" onClose={() => setMessage('')}>{message}</Notice>}
    <div className="payment-note"><span>ⓘ</span><p><strong>Offline payment only.</strong> Orders use pay-on-pickup or pay-on-delivery. Aaharva does not collect online payments.</p></div>
    {loading ? <Loading label="Loading order history…" /> : items.length ? <div className="resource-list">{items.map(order => { const actions = isSeller ? (sellerActions[order.status] || []) : []; return <article className="panel order-card" key={order._id}><div className="order-card-top"><div className="order-thumb" aria-hidden="true">◈</div><div className="order-title"><h3>{order.listingId?.name || 'Surplus food order'}</h3><ResourceMeta owner={isSeller ? `Buyer: ${order.buyerId?.name || 'Community buyer'}` : `Seller: ${order.sellerId?.name || 'Food partner'}`} date={order.createdAt} /></div><StatusPill status={order.status} /></div><div className="order-info-grid"><div><small>Order total</small><strong>{money(order.totalAmount)}</strong></div><div><small>Quantity</small><strong>{order.quantity} {order.listingId?.unit || 'items'}</strong></div><div><small>Payment method</small><strong>{order.paymentMethod === 'pay_on_pickup' ? 'Pay on pickup' : 'Pay on delivery'}</strong></div></div>{order.listingId?.pickupAddress && <div className="order-address"><span>⌖</span><span>{order.listingId.pickupAddress}</span></div>}
          <div className="order-card-footer"><span className="order-id">Order · {String(order._id).slice(-8).toUpperCase()}</span><div className="resource-actions">{actions.map(action => <Button key={action.status} size="small" variant={action.variant || 'primary'} onClick={() => act(order, action.status)} loading={busyId === order._id}>{action.label}</Button>)}{!isSeller && ['placed', 'confirmed'].includes(order.status) && <Button size="small" variant="secondary" onClick={() => act(order, 'cancelled')} loading={busyId === order._id}>Cancel order</Button>}</div></div>
        </article>; })}</div> : <EmptyState icon="▤" title="No orders to show yet" description={isSeller ? 'Orders placed for your approved listings will appear here.' : 'When you order eligible surplus food, its details and status will stay here.'} />}
  </div>;
}
