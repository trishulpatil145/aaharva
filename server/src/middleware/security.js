import { AppError } from '../utils/http.js';
import { getConfig } from '../config/env.js';

const config = getConfig();
const mutating = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function verifyRequestOrigin(req, _res, next) {
  if (!mutating.has(req.method)) return next();
  const origin = req.get('origin');
  // Allow non-browser service clients without Origin; browser requests are origin-bound.
  const allowedOrigins = new Set([config.frontendUrl, ...(process.env.EXTRA_ALLOWED_ORIGINS || '').split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean)]);
  if (origin && !allowedOrigins.has(origin.replace(/\/$/, ''))) return next(new AppError(403, 'Request origin is not allowed.', 'ORIGIN_NOT_ALLOWED'));
  next();
}

export function noSqlSanitize(req, _res, next) {
  // Public payloads are validated with schemas and never spread into query objects.
  // Reject MongoDB operator keys in user-submitted nested objects as defense in depth.
  const inspect = (value) => {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(inspect);
    return Object.entries(value).some(([key, child]) => key.startsWith('$') || key.includes('.') || inspect(child));
  };
  if (inspect(req.body)) return next(new AppError(400, 'Invalid request fields.', 'INVALID_FIELDS'));
  next();
}
