import { AuditLog, Notification, User } from '../models/index.js';

export async function createAudit({ actorId, action, resourceType, resourceId, reason = '', metadata = {} }) {
  return AuditLog.create({ actorId, action, resourceType, resourceId, reason, metadata: sanitizeAuditMetadata(metadata) });
}

function sanitizeAuditMetadata(metadata) {
  const allowed = {};
  for (const [key, value] of Object.entries(metadata || {}).slice(0, 30)) {
    if (/password|token|secret|email|phone|address|cookie/i.test(key)) continue;
    if (['string', 'number', 'boolean'].includes(typeof value)) allowed[key] = typeof value === 'string' ? value.slice(0, 180) : value;
  }
  return allowed;
}

export async function notifyUser(recipientId, type, title, message, resourceType = '', resourceId) {
  if (!recipientId) return null;
  return Notification.create({ recipientId, type, title, message, resourceType, resourceId });
}

export async function notifyAdmins(type, title, message, resourceType = '', resourceId) {
  const admins = await User.find({ role: 'admin', accountStatus: { $in: ['approved', 'pending'] } }).select('_id').lean();
  if (!admins.length) return [];
  return Notification.insertMany(admins.map(a => ({ recipientId: a._id, type, title, message, resourceType, resourceId })));
}

export function safeText(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}
