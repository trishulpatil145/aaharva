import { Link } from 'react-router-dom';
import { humanize, dateTime } from '../utils/format';

export function Brand({ light = false, compact = false }) {
  return <Link className={`brand ${light ? 'brand-light' : ''} ${compact ? 'brand-compact' : ''}`} to="/" aria-label="Aaharva home">
    <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M9 27C9 14 18 7 32 7C32 21 24 30 11 30" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round"/><path d="M10 32C14 23 20 17 29 12" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round"/><path d="M11 30C7 27 5 23 5 18" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round"/></svg></span>
    {!compact && <span className="brand-word">aaharva<span className="brand-dot">.</span></span>}
  </Link>;
}

export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action && <div className="page-header-action">{action}</div>}</div>;
}

export function Button({ children, variant = 'primary', className = '', loading = false, block = false, ...props }) {
  return <button className={`button button-${variant} ${block ? 'button-block' : ''} ${className}`} disabled={loading || props.disabled} {...props}>{loading && <span className="spinner spinner-small" aria-hidden="true" />}{children}</button>;
}

export function Notice({ type = 'info', children, onClose }) {
  if (!children) return null;
  return <div className={`notice notice-${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}{onClose && <button className="notice-close" onClick={onClose} aria-label="Dismiss message">×</button>}</div>;
}

export function Loading({ label = 'Loading your workspace…' }) {
  return <div className="loading-block"><span className="spinner" /><span>{label}</span></div>;
}

export function EmptyState({ icon = '○', title, description, action }) {
  return <div className="empty-state"><div className="empty-icon" aria-hidden="true">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function StatusPill({ status }) {
  const key = String(status || 'unknown').toLowerCase();
  const tone = ['approved', 'active', 'available', 'completed', 'delivered', 'cleared', 'fulfilled', 'receipt_confirmed', 'ready'].includes(key) ? 'good'
    : ['pending', 'pending_review', 'submitted', 'in_transit', 'accepted', 'preparing', 'awaiting_receipt', 'pickup_scheduled', 'investigating'].includes(key) ? 'wait'
    : ['rejected', 'flagged', 'failed', 'cancelled', 'suspended', 'deactivated', 'expired', 'paused'].includes(key) ? 'bad' : 'neutral';
  return <span className={`status-pill status-${tone}`}><span className="status-dot" />{humanize(status)}</span>;
}

export function Field({ label, required, hint, children, className = '' }) {
  return <label className={`field ${className}`}><span className="field-label">{label}{required && <span className="required-mark"> *</span>}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export function ResourceMeta({ date, owner, category }) {
  return <div className="resource-meta">{category && <span>{category}</span>}{owner && <span>{owner}</span>}{date && <span>{dateTime(date)}</span>}</div>;
}

export function SectionHeading({ title, subtitle, action }) {
  return <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
