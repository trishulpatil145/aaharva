import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button, EmptyState, Field, Loading, Notice, PageHeader, ResourceMeta, StatusPill } from '../components/Ui';
import { dateTime, humanize, toLocalDateTime } from '../utils/format';

const newFoodForm = () => ({ name: '', category: 'Prepared meals', foodType: 'vegetarian', description: '', manufacturerName: '', ingredients: '', batchNumber: '', manufacturedAt: '', originalLabelConfirmed: false, quantity: '20', unit: 'portions', preparedAt: toLocalDateTime(new Date(Date.now() - 60 * 60 * 1000)), expiresAt: toLocalDateTime(new Date(Date.now() + 12 * 60 * 60 * 1000)), storageRequirements: '', allergens: '', pickupAddress: '', pickupDeadline: toLocalDateTime(new Date(Date.now() + 8 * 60 * 60 * 1000)) });

export default function DonationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false); const [form, setForm] = useState(newFoodForm); const [showForm, setShowForm] = useState(false); const [busyId, setBusyId] = useState(''); const [search, setSearch] = useState('');
  const isRestaurant = user?.role === 'restaurant'; const isNgo = user?.role === 'ngo';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const data = await api.get('/donations', { params: { limit: 50, search: search || undefined } }); setItems(data.items || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [search]);
  useEffect(() => { void load(); }, [load]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  async function create(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const payload = { ...form, manufacturedAt: form.manufacturedAt ? new Date(form.manufacturedAt).toISOString() : '', quantity: Number(form.quantity), preparedAt: new Date(form.preparedAt).toISOString(), expiresAt: new Date(form.expiresAt).toISOString(), pickupDeadline: new Date(form.pickupDeadline).toISOString() };
      await api.post('/donations', payload);
      setMessage('Donation saved as a draft. Submit it for safety review when you are ready.'); setForm(newFoodForm()); setShowForm(false); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function action(item, actionName, body = {}) {
    setBusyId(item._id); setError(''); setMessage('');
    try {
      if (actionName === 'submit') await api.post(`/donations/${item._id}/submit`, {});
      else if (actionName === 'accept') await api.post(`/donations/${item._id}/accept`, {});
      else if (actionName === 'assign') await api.post(`/donations/${item._id}/assignments`, body);
      else await api.post(`/donations/${item._id}/status`, { status: actionName, notes: body.notes || '' });
      setMessage(actionName === 'accept' ? 'Donation accepted. Coordinate a rescue assignment next.' : actionName === 'assign' ? 'Rescue assignment created.' : actionName === 'submit' ? 'Donation sent for safety review.' : `Donation status updated to ${humanize(actionName)}.`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(''); }
  }

  return <div className="page-stack"><PageHeader eyebrow="Donation network" title={isNgo ? 'Find food worth rescuing.' : 'Make surplus count.'} description={isNgo ? 'Browse donations cleared for sharing, review the handling details and accept food you can collect responsibly.' : 'Create and track food donations from draft through safety review, collection and handover.'} action={isRestaurant && <Button onClick={() => setShowForm(v => !v)}>{showForm ? 'Close form' : '+ Create donation'}</Button>} />
    {error && <Notice type="error">{error}</Notice>}{message && <Notice type="success" onClose={() => setMessage('')}>{message}</Notice>}
    {showForm && isRestaurant && <section className="panel form-panel"><div className="form-panel-heading"><div><p className="eyebrow">New donation</p><h2>Food details for a safe handover</h2><p>Accurate preparation, allergen and deadline information is required before review.</p></div></div><form className="form-grid" onSubmit={create}>
      <Field label="Food name" required><input value={form.name} onChange={e => set('name', e.target.value)} required maxLength={160} placeholder="e.g. Vegetable pulao trays" /></Field>
      <Field label="Food category" required><select value={form.category} onChange={e => set('category', e.target.value)}>{['Prepared meals', 'Bakery', 'Produce', 'Packaged food', 'Dairy', 'Other'].map(v => <option key={v}>{v}</option>)}</select></Field>
      <Field label="Food type / diet label" required hint="Use Not applicable only when vegetarian/non-vegetarian does not apply."><select value={form.foodType} onChange={e => set('foodType', e.target.value)}><option value="vegetarian">Vegetarian</option><option value="non_vegetarian">Non-vegetarian</option><option value="not_applicable">Not applicable</option></select></Field>
      {form.category === 'Packaged food' && <><Field label="Manufacturer name (from original label)" required><input value={form.manufacturerName} onChange={e => set('manufacturerName', e.target.value)} required maxLength={200} /></Field><Field label="Ingredients (from original label)" required><textarea rows={2} value={form.ingredients} onChange={e => set('ingredients', e.target.value)} required maxLength={2000} /></Field><Field label="Batch number" required><input value={form.batchNumber} onChange={e => set('batchNumber', e.target.value)} required maxLength={100} /></Field><Field label="Manufacturing date" required><input type="date" value={form.manufacturedAt} onChange={e => set('manufacturedAt', e.target.value)} required /></Field><Field label="Original package label is intact and readable" required><span className="check-label"><input type="checkbox" checked={form.originalLabelConfirmed} onChange={e => set('originalLabelConfirmed', e.target.checked)} required /> <span>I confirmed the original label is present and readable.</span></span></Field></>}
      <Field label="Description"><textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} maxLength={2000} placeholder="Ingredients, packing details, portions…" /></Field>
      <div className="form-grid-two"><Field label="Quantity" required><input type="number" min="0.001" step="any" value={form.quantity} onChange={e => set('quantity', e.target.value)} required /></Field><Field label="Unit" required><select value={form.unit} onChange={e => set('unit', e.target.value)}>{['portions', 'meals', 'packs', 'kg', 'litres', 'trays', 'items'].map(v => <option key={v}>{v}</option>)}</select></Field></div>
      <Field label="Prepared / packed at" required><input type="datetime-local" value={form.preparedAt} onChange={e => set('preparedAt', e.target.value)} required /></Field>
      <Field label="Applicable safe-use deadline" required hint="Use the food-specific deadline, not an assumed universal limit."><input type="datetime-local" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} required /></Field>
      <Field label="Collection deadline" required><input type="datetime-local" value={form.pickupDeadline} onChange={e => set('pickupDeadline', e.target.value)} required /></Field>
      <Field label="Pickup address" required><input value={form.pickupAddress} onChange={e => set('pickupAddress', e.target.value)} required maxLength={400} placeholder="Street, area, city" /></Field>
      <Field label="Storage & transport requirements" required><textarea rows={2} value={form.storageRequirements} onChange={e => set('storageRequirements', e.target.value)} required maxLength={500} placeholder="How must this food be stored and transported?" /></Field>
      <Field label="Allergen information" required hint="Provide known allergens, or explicitly state what is known / not declared."><textarea rows={2} value={form.allergens} onChange={e => set('allergens', e.target.value)} required maxLength={500} placeholder="Allergens, cross-contact notes, or none declared…" /></Field>
      <div className="form-actions form-span"><Button type="submit" loading={saving}>Save donation draft <span>→</span></Button><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button></div>
    </form></section>}

    <div className="filter-row"><div className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search food donations…" aria-label="Search food donations" /></div><div className="filter-summary"><span className="filter-count">{items.length}</span> {isNgo ? 'eligible donations in this view' : 'records in this view'} <button className="subtle-link" onClick={load}>Refresh ↻</button></div></div>
    {loading ? <Loading label="Loading food donations…" /> : items.length ? <div className="resource-list">{items.map(item => <article className="panel resource-card" key={item._id}><div className="resource-card-main"><div className="resource-card-heading"><span className="resource-icon">♧</span><div><h3>{item.name}</h3><ResourceMeta category={item.category} owner={item.donorId?.name} date={item.createdAt} /></div></div><StatusPill status={item.status} /></div><p className="resource-description">{item.description || 'No additional description provided.'}</p><div className="food-info-grid"><div><small>Available quantity</small><strong>{item.quantity} {item.unit}</strong></div><div><small>Safe-use deadline</small><strong>{dateTime(item.expiresAt)}</strong></div><div><small>Collect by</small><strong>{dateTime(item.pickupDeadline)}</strong></div></div><div className="resource-card-footer"><span className={`safety-label ${item.safetyStatus === 'cleared' ? 'safety-cleared' : item.safetyStatus === 'flagged' ? 'safety-flagged' : ''}`}><span>✓</span> Safety: {humanize(item.safetyStatus)}</span><span className="resource-address">⌖ {item.pickupAddress}</span></div>
      {(isRestaurant || isNgo || user?.role === 'admin') && <div className="resource-actions">
        {isRestaurant && ['draft', 'flagged'].includes(item.status) && <Button size="small" onClick={() => action(item, 'submit')} loading={busyId === item._id}>Submit for review</Button>}
        {isNgo && item.status === 'available' && <Button size="small" onClick={() => action(item, 'accept')} loading={busyId === item._id}>Accept donation</Button>}
        {(isRestaurant || isNgo || user?.role === 'admin') && ['accepted', 'pickup_scheduled'].includes(item.status) && <Button size="small" variant="secondary" onClick={() => action(item, 'assign')} loading={busyId === item._id}>Offer rescue assignment</Button>}
        {isRestaurant && ['draft', 'submitted', 'available', 'accepted'].includes(item.status) && <button className="text-action-small" onClick={() => action(item, 'cancelled')} disabled={busyId === item._id}>Cancel donation</button>}
      </div>}
    </article>)}</div> : <EmptyState icon="♧" title={isNgo ? 'No eligible donations found' : 'No donations yet'} description={isNgo ? 'Eligible donations appear after food safety review clears them for collection.' : 'Create a donation draft and include the details needed for an authorized safety review.'} action={isRestaurant && <Button onClick={() => setShowForm(true)}>+ Create donation</Button>} />}
  </div>;
}
