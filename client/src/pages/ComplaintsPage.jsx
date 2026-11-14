import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button, EmptyState, Field, Loading, Notice, PageHeader, ResourceMeta, StatusPill } from '../components/Ui';
import { dateTime, humanize } from '../utils/format';

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState([]); const [incidents, setIncidents] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [tab, setTab] = useState('complaint'); const [saving, setSaving] = useState(false);
  const [complaint, setComplaint] = useState({ category: 'other', description: '', resourceType: 'other', resourceId: '' });
  const [incident, setIncident] = useState({ relatedType: 'donation', relatedId: '', severity: 'medium', description: '' });
  const load = useCallback(async () => { setLoading(true); setError(''); try { const [c, i] = await Promise.all([api.get('/complaints', { params: { limit: 60 } }), api.get('/incidents', { params: { limit: 60 } })]); setComplaints(c.items || []); setIncidents(i.items || []); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      if (tab === 'complaint') {
        const body = { ...complaint, ...(complaint.resourceId.trim() ? { resourceId: complaint.resourceId.trim() } : {}) }; if (!body.resourceId) delete body.resourceId;
        await api.post('/complaints', body); setComplaint({ category: 'other', description: '', resourceType: 'other', resourceId: '' }); setMessage('Complaint submitted. Authorized administrators will review it.');
      } else {
        await api.post('/incidents', incident); setIncident({ relatedType: 'donation', relatedId: '', severity: 'medium', description: '' }); setMessage('Safety incident submitted. The related food is held for authorized review where applicable.');
      }
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }
  const cset = (key, value) => setComplaint(p => ({ ...p, [key]: value })); const iset = (key, value) => setIncident(p => ({ ...p, [key]: value }));
  return <div className="page-stack"><PageHeader eyebrow="Support & food safety" title="Speak up. Help protect trust." description="Report an issue with an order, donation or delivery, or submit a specific food safety concern for authorized review." />
    {error && <Notice type="error">{error}</Notice>}{message && <Notice type="success" onClose={() => setMessage('')}>{message}</Notice>}
    <div className="safety-report-banner"><span>!</span><div><strong>Suspected food safety issue?</strong><p>An incident report places linked food on a temporary hold, where applicable. This is a precaution — it is not a public finding that a person or organization did anything wrong.</p></div></div>
    <section className="panel form-panel support-form-panel"><div className="segmented-tabs"><button className={tab === 'complaint' ? 'segmented-active' : ''} onClick={() => setTab('complaint')}>General complaint</button><button className={tab === 'incident' ? 'segmented-active' : ''} onClick={() => setTab('incident')}>Food safety incident</button></div>
      <form className="form-grid" onSubmit={submit}>{tab === 'complaint' ? <>
        <Field label="Issue category" required><select value={complaint.category} onChange={e => cset('category', e.target.value)}>{[['food_quality','Food quality'],['delivery','Delivery'],['order','Order'],['organization','Organization'],['platform','Platform'],['other','Other']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Related item type" required><select value={complaint.resourceType} onChange={e => cset('resourceType', e.target.value)}>{[['other','Other / general'],['donation','Donation'],['listing','Marketplace listing'],['order','Order'],['school_request','School request'],['delivery','Delivery'],['organization','Organization']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Related item ID" hint="Optional — copy the exact ID from its details if available."><input value={complaint.resourceId} onChange={e => cset('resourceId', e.target.value)} maxLength={24} placeholder="24-character resource ID" /></Field>
        <Field label="Describe the issue" required className="form-span"><textarea rows={4} value={complaint.description} onChange={e => cset('description', e.target.value)} required minLength={10} maxLength={3000} placeholder="What happened, when did it happen, and what follow-up would help?" /></Field>
      </> : <>
        <Field label="Related resource type" required><select value={incident.relatedType} onChange={e => iset('relatedType', e.target.value)}>{[['donation','Food donation'],['listing','Marketplace listing'],['order','Order'],['organization','Organization'],['delivery','Delivery']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Related resource ID" required hint="Enter the exact 24-character ID of the food, order or organization involved."><input value={incident.relatedId} onChange={e => iset('relatedId', e.target.value)} required minLength={24} maxLength={24} pattern="[a-fA-F0-9]{24}" placeholder="24-character resource ID" /></Field>
        <Field label="Severity" required><select value={incident.severity} onChange={e => iset('severity', e.target.value)}>{[['low','Low'],['medium','Medium'],['high','High'],['critical','Critical']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Describe the safety concern" required className="form-span"><textarea rows={4} value={incident.description} onChange={e => iset('description', e.target.value)} required minLength={10} maxLength={3000} placeholder="Describe what you observed. Avoid assumptions; include times and handling details where known." /></Field>
      </>}
        <div className="form-actions form-span"><Button type="submit" loading={saving}>{tab === 'complaint' ? 'Submit complaint' : 'Submit safety incident'} <span>→</span></Button></div>
      </form>
    </section>

    <div className="support-lists-grid"><section className="panel"><div className="panel-heading-row"><div><h2>My complaints</h2><p>Issues you reported and their follow-up status.</p></div><span className="panel-count">{complaints.length}</span></div>{loading ? <Loading /> : complaints.length ? <div className="compact-resource-list">{complaints.map(item => <article key={item._id} className="compact-resource"><div className="compact-resource-header"><strong>{humanize(item.category)} issue</strong><StatusPill status={item.status} /></div><p>{item.description}</p><ResourceMeta date={item.createdAt} category={item.resourceType !== 'other' ? humanize(item.resourceType) : ''} />{item.resolutionNotes && <div className="resolution-note"><strong>Resolution note</strong><p>{item.resolutionNotes}</p></div>}</article>)}</div> : <p className="panel-empty-text">No complaints reported yet.</p>}</section>
    <section className="panel"><div className="panel-heading-row"><div><h2>My safety incidents</h2><p>Submitted safety concerns and review progress.</p></div><span className="panel-count">{incidents.length}</span></div>{loading ? <Loading /> : incidents.length ? <div className="compact-resource-list">{incidents.map(item => <article key={item._id} className="compact-resource"><div className="compact-resource-header"><strong>{humanize(item.relatedType)} concern</strong><StatusPill status={item.status} /></div><p>{item.description}</p><div className="incident-meta-row"><span className={`severity-tag severity-${item.severity}`}>{humanize(item.severity)} severity</span><span>{dateTime(item.createdAt)}</span></div>{item.reviewNotes && <div className="resolution-note"><strong>Review notes</strong><p>{item.reviewNotes}</p></div>}</article>)}</div> : <p className="panel-empty-text">No safety incidents reported yet.</p>}</section></div>
  </div>;
}
