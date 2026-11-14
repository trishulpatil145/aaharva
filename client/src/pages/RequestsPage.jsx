import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button, EmptyState, Field, Loading, Notice, PageHeader, ResourceMeta, StatusPill } from '../components/Ui';
import { dateTime, humanize, toLocalDateTime } from '../utils/format';

const requestInitial = () => ({ title: '', description: '', categories: 'Prepared meals, Fruit', requestedQuantity: '80', unit: 'portions', beneficiaryCount: '60', dietaryRequirements: '', requestedFor: toLocalDateTime(new Date(Date.now() + 48 * 60 * 60 * 1000)), collectionWindow: '10:00–12:00' });

export default function RequestsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [formOpen, setFormOpen] = useState(false); const [form, setForm] = useState(requestInitial); const [busyId, setBusyId] = useState(''); const [values, setValues] = useState({}); const [saving, setSaving] = useState(false);
  const isSchool = user?.role === 'school'; const canContribute = ['restaurant', 'ngo', 'admin'].includes(user?.role);
  const load = useCallback(async () => { setLoading(true); setError(''); try { const data = await api.get('/school-requests', { params: { limit: 60 } }); setItems(data.items || []); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  async function create(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      await api.post('/school-requests', { ...form, categories: form.categories.split(',').map(x => x.trim()).filter(Boolean), requestedQuantity: Number(form.requestedQuantity), beneficiaryCount: form.beneficiaryCount === '' ? undefined : Number(form.beneficiaryCount), requestedFor: new Date(form.requestedFor).toISOString() });
      setMessage('Supplementary food support request submitted for administrator review.'); setForm(requestInitial()); setFormOpen(false); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function contribute(item) {
    const fields = values[item._id] || {};
    const quantity = Number(fields.quantity);
    if (!fields.donationId || !Number.isSafeInteger(quantity) || quantity <= 0) { setError('Enter a donation ID and a positive whole-number quantity.'); return; }
    setBusyId(item._id); setError(''); setMessage('');
    try {
      await api.post(`/school-requests/${item._id}/fulfill`, { donationId: fields.donationId.trim(), quantity, note: fields.note || '' });
      setMessage('Food contribution allocated. The school must confirm receipt before it counts as fulfilled.'); await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(''); }
  }

  async function receipt(item) {
    const fields = values[item._id] || {};
    const quantity = Number(fields.receiptQuantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) { setError('Enter a positive whole-number receipt quantity.'); return; }
    setBusyId(item._id); setError(''); setMessage('');
    try {
      await api.post(`/school-requests/${item._id}/receipt`, { quantity, notes: fields.receiptNotes || '' });
      setMessage('Receipt confirmation saved. Request progress reflects the confirmed quantity.'); await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(''); }
  }

  return <div className="page-stack"><PageHeader eyebrow="Supplementary food assistance" title={isSchool ? 'Support requests for your school.' : 'Help fulfil a school request.'} description={isSchool ? 'Create and track supplementary food requests. Only confirm quantities that have actually been received.' : 'Review approved requests from verified school organizations and contribute eligible food donations when you can fulfill them safely.'} action={isSchool && <Button onClick={() => setFormOpen(v => !v)}>{formOpen ? 'Close form' : '+ New food request'}</Button>} />
    <Notice type="info">School requests coordinate supplementary food support. They do not replace existing government school meal programs.</Notice>
    {error && <Notice type="error">{error}</Notice>}{message && <Notice type="success" onClose={() => setMessage('')}>{message}</Notice>}
    {formOpen && isSchool && <section className="panel form-panel"><div className="form-panel-heading"><div><p className="eyebrow">New support request</p><h2>Tell the network what your school needs</h2><p>Avoid including children's names or other unnecessary personal information.</p></div></div><form className="form-grid" onSubmit={create}>
      <Field label="Request title" required><input value={form.title} onChange={e => set('title', e.target.value)} required maxLength={160} placeholder="e.g. Supplementary breakfast support" /></Field>
      <Field label="Food categories" required hint="Separate categories with commas."><input value={form.categories} onChange={e => set('categories', e.target.value)} required placeholder="Prepared meals, fruit" /></Field>
      <Field label="Description"><textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} maxLength={2000} placeholder="Describe the request and any logistics." /></Field>
      <div className="form-grid-two"><Field label="Quantity requested" required><input type="number" min="1" step="1" value={form.requestedQuantity} onChange={e => set('requestedQuantity', e.target.value)} required /></Field><Field label="Unit" required><select value={form.unit} onChange={e => set('unit', e.target.value)}>{['portions', 'meals', 'packs', 'kg', 'litres', 'items'].map(v => <option key={v}>{v}</option>)}</select></Field></div>
      <Field label="Beneficiary count" hint="Optional estimate only; do not enter names."><input type="number" min="0" step="1" value={form.beneficiaryCount} onChange={e => set('beneficiaryCount', e.target.value)} /></Field>
      <Field label="Requested date" required><input type="datetime-local" value={form.requestedFor} onChange={e => set('requestedFor', e.target.value)} required /></Field>
      <Field label="Collection / delivery window"><input value={form.collectionWindow} onChange={e => set('collectionWindow', e.target.value)} maxLength={250} /></Field>
      <Field label="Dietary and allergen requirements"><textarea rows={2} value={form.dietaryRequirements} onChange={e => set('dietaryRequirements', e.target.value)} maxLength={1000} placeholder="Include only the requirements needed to safely fulfil this request." /></Field>
      <div className="form-actions form-span"><Button type="submit" loading={saving}>Submit request <span>→</span></Button><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button></div>
    </form></section>}
    {loading ? <Loading label="Loading school food requests…" /> : items.length ? <div className="resource-list">{items.map(item => { const progress = item.requestedQuantity ? Math.min(100, Math.round((item.receivedQuantity / item.requestedQuantity) * 100)) : 0; const fields = values[item._id] || {}; return <article className="panel request-card" key={item._id}><div className="resource-card-main"><div className="resource-card-heading"><span className="resource-icon resource-icon-school">⌂</span><div><h3>{item.title}</h3><ResourceMeta owner={item.schoolOrganizationId?.name || 'Verified school'} date={item.createdAt} /></div></div><StatusPill status={item.status} /></div><p className="resource-description">{item.description || 'Supplementary food request.'}</p><div className="request-stats"><div><small>Requested</small><strong>{item.requestedQuantity} {item.unit}</strong></div><div><small>Allocated</small><strong>{item.allocatedQuantity || 0} {item.unit}</strong></div><div><small>Received</small><strong>{item.receivedQuantity || 0} {item.unit}</strong></div><div><small>Needed by</small><strong>{dateTime(item.requestedFor)}</strong></div></div><div className="progress-track" role="progressbar" aria-label="Confirmed request fulfillment" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><div className="request-progress-label"><span>{progress}% received</span><span>{Math.max(0, item.requestedQuantity - (item.receivedQuantity || 0))} {item.unit} remaining</span></div>
      {item.dietaryRequirements && <p className="request-detail"><strong>Dietary & allergen needs:</strong> {item.dietaryRequirements}</p>}
      {canContribute && ['approved', 'partially_fulfilled', 'awaiting_receipt'].includes(item.status) && <div className="contribution-box"><strong>Contribute an eligible donation</strong><p>Choose one available, safety-cleared donation. Quantity must match that donation and fit the remaining request.</p><div className="form-grid-two"><Field label="Donation ID" required><input value={fields.donationId || ''} onChange={e => setValues(p => ({ ...p, [item._id]: { ...p[item._id], donationId: e.target.value }}))} placeholder="Paste your donation ID" /></Field><Field label="Donation quantity" required><input type="number" min="1" step="1" value={fields.quantity || ''} onChange={e => setValues(p => ({ ...p, [item._id]: { ...p[item._id], quantity: e.target.value }}))} placeholder="Must match donation" /></Field></div><Field label="Handover note"><input value={fields.note || ''} onChange={e => setValues(p => ({ ...p, [item._id]: { ...p[item._id], note: e.target.value }}))} placeholder="Optional coordination note" /></Field><Button size="small" onClick={() => contribute(item)} loading={busyId === item._id}>Allocate donation <span>→</span></Button></div>}
      {isSchool && ['approved', 'partially_fulfilled', 'awaiting_receipt'].includes(item.status) && item.allocatedQuantity > item.receivedQuantity && <div className="contribution-box contribution-receipt"><strong>Confirm what arrived</strong><p>Record the quantity actually received. Do not confirm food that is still in transit or not delivered.</p><div className="form-grid-two"><Field label="Quantity received" required><input type="number" min="1" step="1" value={fields.receiptQuantity || ''} onChange={e => setValues(p => ({ ...p, [item._id]: { ...p[item._id], receiptQuantity: e.target.value }}))} /></Field><Field label="Receipt notes"><input value={fields.receiptNotes || ''} onChange={e => setValues(p => ({ ...p, [item._id]: { ...p[item._id], receiptNotes: e.target.value }}))} placeholder="Optional handover notes" /></Field></div><Button size="small" onClick={() => receipt(item)} loading={busyId === item._id}>Confirm receipt</Button></div>}
      <div className="resource-card-footer"><span>Categories: {item.categories?.join(', ')}</span><span>{item.collectionWindow || 'Collection window to be coordinated'}</span></div>
    </article>; })}</div> : <EmptyState icon="⌂" title={isSchool ? 'No requests created yet' : 'No approved requests to display'} description={isSchool ? 'Create a supplementary food support request so administrators and eligible partners can review it.' : 'Approved school requests will appear here for eligible donors and NGOs to review.'} action={isSchool && <Button onClick={() => setFormOpen(true)}>Create a request</Button>} />}
  </div>;
}
