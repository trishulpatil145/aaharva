import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Brand, Button, EmptyState, Field, Loading, Notice, PageHeader, ResourceMeta, StatusPill } from '../components/Ui';
import { dateTime, money, toLocalDateTime } from '../utils/format';

const listingFormInitial = () => ({ name: '', category: 'Prepared meals', foodType: 'vegetarian', description: '', manufacturerName: '', ingredients: '', batchNumber: '', manufacturedAt: '', originalLabelConfirmed: false, quantity: '12', unit: 'portions', preparedAt: toLocalDateTime(new Date(Date.now() - 60 * 60 * 1000)), expiresAt: toLocalDateTime(new Date(Date.now() + 10 * 60 * 60 * 1000)), storageRequirements: '', allergens: '', pickupAddress: '', pickupDeadline: toLocalDateTime(new Date(Date.now() + 6 * 60 * 60 * 1000)), originalPrice: '150', discountedPrice: '90', fulfillmentOptions: ['pickup'] });

export default function MarketplacePage({ publicMode = false }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]); const [myItems, setMyItems] = useState([]); const [tab, setTab] = useState('available');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [search, setSearch] = useState(''); const [category, setCategory] = useState(''); const [maxPrice, setMaxPrice] = useState(''); const [location, setLocation] = useState('');
  const [showForm, setShowForm] = useState(false); const [form, setForm] = useState(listingFormInitial); const [saving, setSaving] = useState(false); const [busyId, setBusyId] = useState(''); const [quantities, setQuantities] = useState({}); const [paymentMethod, setPaymentMethod] = useState('pay_on_pickup'); const idempotencyKeys = useRef(new Map());
  const isRestaurant = user?.role === 'restaurant'; const canOrder = user?.role === 'buyer';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { limit: 60, search: search || undefined, category: category || undefined, maxPrice: maxPrice || undefined, location: location || undefined };
      const data = await api.get('/listings', { params });
      setItems(data.items || []);
      if (isRestaurant) {
        const mine = await api.get('/my-listings', { params: { limit: 60 } });
        setMyItems(mine.items || []);
      } else setMyItems([]);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [search, category, maxPrice, location, isRestaurant]);
  useEffect(() => { void load(); }, [load]);
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  async function createListing(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const payload = { ...form, manufacturedAt: form.manufacturedAt ? new Date(form.manufacturedAt).toISOString() : '', quantity: Number(form.quantity), originalPrice: Number(form.originalPrice), discountedPrice: Number(form.discountedPrice), preparedAt: new Date(form.preparedAt).toISOString(), expiresAt: new Date(form.expiresAt).toISOString(), pickupDeadline: new Date(form.pickupDeadline).toISOString() };
      await api.post('/listings', payload);
      setMessage('Listing created and sent for food safety review. It will appear publicly after authorized clearance.'); setForm(listingFormInitial()); setShowForm(false); setTab('mine'); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function placeOrder(item) {
    const quantity = Number(quantities[item._id] || 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.availableQuantity) { setError('Choose a whole-number quantity within the available stock.'); return; }
    setBusyId(item._id); setError(''); setMessage('');
    const attemptKey = `${item._id}:${quantity}:${paymentMethod}`;
    let key = idempotencyKeys.current.get(attemptKey);
    if (!key) { key = requestKey(); idempotencyKeys.current.set(attemptKey, key); }
    try {
      await api.post('/orders', { listingId: item._id, quantity, paymentMethod, idempotencyKey: key });
      idempotencyKeys.current.delete(attemptKey);
      setMessage('Order placed. Aaharva does not process online payments; pay on pickup or delivery.');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(''); }
  }

  const displayItems = isRestaurant && tab === 'mine' ? myItems : items;

  return <div className={publicMode ? 'public-browse' : 'page-stack'}>
    {publicMode && <header className="browse-header"><Brand /><div><Link className="text-action" to="/">Home</Link>{user ? <Link className="button button-secondary" to="/dashboard">Workspace</Link> : <><Link className="text-action" to="/login">Sign in</Link><Link className="button button-primary" to="/register">Join Aaharva</Link></>}</div></header>}
    <div className={publicMode ? 'browse-content' : ''}>
      <PageHeader eyebrow="Affordable surplus food" title={isRestaurant && tab === 'mine' ? 'Your food listings.' : 'Good food, for a little less.'} description="Discover eligible surplus food from local partners. Each listing includes current availability and food-specific handling details." action={isRestaurant && <Button onClick={() => setShowForm(v => !v)}>{showForm ? 'Close form' : '+ Create listing'}</Button>} />
      {error && <Notice type="error">{error}</Notice>}{message && <Notice type="success" onClose={() => setMessage('')}>{message}</Notice>}
      {isRestaurant && <div className="segmented-tabs"><button className={tab === 'available' ? 'segmented-active' : ''} onClick={() => setTab('available')}>Available marketplace</button><button className={tab === 'mine' ? 'segmented-active' : ''} onClick={() => setTab('mine')}>My listings <span>{myItems.length}</span></button></div>}

      {showForm && isRestaurant && <section className="panel form-panel"><div className="form-panel-heading"><div><p className="eyebrow">New marketplace listing</p><h2>Offer surplus food at a lower price</h2><p>Food becomes public only after an authorized safety review.</p></div></div><form className="form-grid" onSubmit={createListing}>
        <Field label="Food name" required><input value={form.name} onChange={e => set('name', e.target.value)} required maxLength={160} placeholder="e.g. Seasonal vegetable rice bowl" /></Field>
        <Field label="Food category" required><select value={form.category} onChange={e => set('category', e.target.value)}>{['Prepared meals', 'Bakery', 'Produce', 'Packaged food', 'Dairy', 'Other'].map(v => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Food type / diet label" required hint="Use Not applicable only when vegetarian/non-vegetarian does not apply."><select value={form.foodType} onChange={e => set('foodType', e.target.value)}><option value="vegetarian">Vegetarian</option><option value="non_vegetarian">Non-vegetarian</option><option value="not_applicable">Not applicable</option></select></Field>
        {form.category === 'Packaged food' && <><Field label="Manufacturer name (from original label)" required><input value={form.manufacturerName} onChange={e => set('manufacturerName', e.target.value)} required maxLength={200} /></Field><Field label="Ingredients (from original label)" required><textarea rows={2} value={form.ingredients} onChange={e => set('ingredients', e.target.value)} required maxLength={2000} /></Field><Field label="Batch number" required><input value={form.batchNumber} onChange={e => set('batchNumber', e.target.value)} required maxLength={100} /></Field><Field label="Manufacturing date" required><input type="date" value={form.manufacturedAt} onChange={e => set('manufacturedAt', e.target.value)} required /></Field><Field label="Original package label is intact and readable" required><span className="check-label"><input type="checkbox" checked={form.originalLabelConfirmed} onChange={e => set('originalLabelConfirmed', e.target.checked)} required /> <span>I confirmed the original label is present and readable.</span></span></Field></>}
        <Field label="Description"><textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} maxLength={2000} placeholder="What is included? Any important notes?" /></Field>
        <div className="form-grid-two"><Field label="Original price (₹)" required><input type="number" min="0.01" step="0.01" value={form.originalPrice} onChange={e => set('originalPrice', e.target.value)} required /></Field><Field label="Surplus price (₹)" required><input type="number" min="0" step="0.01" value={form.discountedPrice} onChange={e => set('discountedPrice', e.target.value)} required /></Field></div>
        <div className="form-grid-two"><Field label="Available quantity" required><input type="number" min="1" step="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} required /></Field><Field label="Unit" required><select value={form.unit} onChange={e => set('unit', e.target.value)}>{['portions', 'meals', 'bowls', 'packs', 'kg', 'litres', 'items'].map(v => <option key={v}>{v}</option>)}</select></Field></div>
        <Field label="Prepared / packed at" required><input type="datetime-local" value={form.preparedAt} onChange={e => set('preparedAt', e.target.value)} required /></Field>
        <Field label="Applicable safe-use deadline" required><input type="datetime-local" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} required /></Field>
        <Field label="Collection deadline" required><input type="datetime-local" value={form.pickupDeadline} onChange={e => set('pickupDeadline', e.target.value)} required /></Field>
        <Field label="Pickup address" required><input value={form.pickupAddress} onChange={e => set('pickupAddress', e.target.value)} required maxLength={400} placeholder="Street, area, city" /></Field>
        <Field label="Storage & transport requirements" required><textarea rows={2} value={form.storageRequirements} onChange={e => set('storageRequirements', e.target.value)} required maxLength={500} /></Field>
        <Field label="Allergen information" required><textarea rows={2} value={form.allergens} onChange={e => set('allergens', e.target.value)} required maxLength={500} /></Field>
        <Field label="Fulfillment options" required><div className="check-row"><label><input type="checkbox" checked={form.fulfillmentOptions.includes('pickup')} onChange={e => set('fulfillmentOptions', e.target.checked ? [...new Set([...form.fulfillmentOptions, 'pickup'])] : form.fulfillmentOptions.filter(x => x !== 'pickup'))} /> Pickup</label><label><input type="checkbox" checked={form.fulfillmentOptions.includes('delivery')} onChange={e => set('fulfillmentOptions', e.target.checked ? [...new Set([...form.fulfillmentOptions, 'delivery'])] : form.fulfillmentOptions.filter(x => x !== 'delivery'))} /> Delivery</label></div></Field>
        <div className="form-actions form-span"><Button type="submit" loading={saving}>Submit for review <span>→</span></Button><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button></div>
      </form></section>}

      <section className="market-filter panel"><div className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes, categories…" aria-label="Search marketplace" /></div><select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter food category"><option value="">All categories</option>{['Prepared meals', 'Bakery', 'Produce', 'Packaged food', 'Dairy', 'Other'].map(v => <option key={v}>{v}</option>)}</select><select value={maxPrice} onChange={e => setMaxPrice(e.target.value)} aria-label="Filter maximum price"><option value="">Any price</option><option value="50">Up to ₹50</option><option value="100">Up to ₹100</option><option value="200">Up to ₹200</option><option value="500">Up to ₹500</option></select><input value={location} onChange={e => setLocation(e.target.value)} aria-label="Filter city or state" placeholder="City or state" maxLength={100} /><button className="button button-secondary" onClick={load}>Apply filters</button></section>
      {loading ? <Loading label="Finding eligible surplus food…" /> : displayItems.length ? <div className="market-grid">{displayItems.map(item => <article className="market-card" key={item._id}>
        <div className={`market-card-art market-art-${Math.abs(String(item._id).charCodeAt(0) || 0) % 4}`}><span className="market-art-stamp">A<span>·</span></span><span className="market-art-category">{item.category}</span><div className="dish-illustration" aria-hidden="true"><span className="dish-leaf dish-leaf-a"/><span className="dish-leaf dish-leaf-b"/><span className="dish-tomato"/><span className="dish-carrot"/><span className="dish-grain"/></div>{item.discountPercent > 0 && <span className="discount-badge">{item.discountPercent}% off</span>}</div>
        <div className="market-card-body"><div className="market-card-title"><h3>{item.name}</h3><span className="stock-indicator"><i />{item.availableQuantity} left</span></div><ResourceMeta owner={item.sellerId?.name || 'Local food partner'} date={item.createdAt} /><p className="market-description">{item.description || 'Surplus food available while listed quantities last.'}</p><div className="price-row"><div><strong>{money(item.discountedPrice)}</strong><del>{money(item.originalPrice)}</del></div><small>per {item.unit.replace(/s$/, '')}</small></div><div className="listing-deadline"><span>⌖ {shortAddress(item.pickupAddress)}</span><span>Use by {dateTime(item.expiresAt)}</span></div>
          {isRestaurant && tab === 'mine' ? <div className="market-own-footer"><StatusPill status={item.status} /><small>Safety: {item.safetyStatus?.replaceAll('_', ' ')}</small></div> : canOrder ? <div className="order-controls"><div className="order-quantity"><label htmlFor={`qty-${item._id}`}>Qty</label><input id={`qty-${item._id}`} type="number" min="1" max={item.availableQuantity} value={quantities[item._id] || 1} onChange={e => setQuantities(prev => ({ ...prev, [item._id]: e.target.value }))} /></div><Button size="small" onClick={() => placeOrder(item)} loading={busyId === item._id}>Place order <span>→</span></Button></div> : !user ? <div className="market-card-cta"><Link to="/login" state={{ from: '/marketplace' }} className="text-action text-action-green">Sign in to order <span>→</span></Link></div> : <div className="market-card-cta"><span className="subtle-help">Purchasing is available to buyer accounts.</span></div>}
        </div></article>)}</div> : <EmptyState icon="◈" title={isRestaurant && tab === 'mine' ? 'You haven’t listed food yet' : 'No matching listings right now'} description={isRestaurant && tab === 'mine' ? 'Create a listing with accurate safety information and send it for review.' : 'Try a different search or check back later. Only currently eligible food is shown.'} action={isRestaurant && tab === 'mine' && <Button onClick={() => setShowForm(true)}>Create a listing</Button>} />}
      {!publicMode && <div className="payment-note"><span>ⓘ</span><p><strong>Pay on pickup or delivery.</strong> Aaharva does not process online payments in this version. Stock is reserved when your order is placed.</p></div>}
    </div>
    {publicMode && <footer className="browse-footer"><Brand compact /><span>Rescue Food. Reduce Waste. Nourish Lives.</span><Link to="/register">Become a partner ↗</Link></footer>}
  </div>;
}
function shortAddress(value) { return String(value || 'Collection details shared after order').split(',').slice(-2).join(',').trim(); }
function requestKey() { return globalThis.crypto?.randomUUID?.() || `ah-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`; }
