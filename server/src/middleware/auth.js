import jwt from 'jsonwebtoken';
import { getConfig } from '../config/env.js';
import { User } from '../models/index.js';
import { AppError, asyncHandler } from '../utils/http.js';

const config = getConfig();

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[config.cookieName] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) throw new AppError(401, 'Sign in to continue.', 'AUTH_REQUIRED');
  let claims;
  try { claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }); }
  catch { throw new AppError(401, 'Your session has expired. Please sign in again.', 'SESSION_INVALID'); }
  const user = await User.findById(claims.sub).select('+passwordHash');
  if (!user || user.accountStatus === 'deactivated' || user.accountStatus === 'suspended' || claims.ver !== (user.tokenVersion || 0)) throw new AppError(401, 'This account cannot access the platform.', 'ACCOUNT_UNAVAILABLE');
  req.user = user;
  next();
});


export const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[config.cookieName] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) return next();
  try {
    const claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const user = await User.findById(claims.sub).select('+passwordHash');
    if (user && !['deactivated', 'suspended'].includes(user.accountStatus) && claims.ver === (user.tokenVersion || 0)) req.user = user;
  } catch { /* Invalid optional credentials do not block public listing reads. */ }
  next();
});

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'Sign in to continue.', 'AUTH_REQUIRED'));
    if (!roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission to perform this action.', 'FORBIDDEN'));
    if (req.user.role !== 'admin' && req.user.accountStatus !== 'approved') {
      return next(new AppError(403, 'Your organization must be approved before using operational features.', 'ORGANIZATION_NOT_APPROVED'));
    }
    next();
  };
}

export function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') return next(new AppError(403, 'Administrator access is required.', 'ADMIN_REQUIRED'));
  if (req.user.accountStatus !== 'approved') return next(new AppError(403, 'This administrator account is not active.', 'ACCOUNT_NOT_APPROVED'));
  next();
}
