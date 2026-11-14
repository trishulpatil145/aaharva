export function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}
export function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
export function humanize(value) { return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, m => m.toUpperCase()); }
export function errorMessage(error) { return error?.message || 'Something went wrong. Please try again.'; }
export function toLocalDateTime(value) {
  let date = value ? new Date(value) : new Date(Date.now() + 2 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
export function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `ah-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
