import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Organization, Verification } from '../models/index.js';
import { asyncHandler, AppError, sendData, safeUser } from '../utils/http.js';
import { authenticate } from '../middleware/auth.js';
import { loginSchema, registerSchema, profileSchema, passwordChangeSchema } from '../validators/schemas.js';
import { getConfig } from '../config/env.js';
import { createAudit } from '../services/system.js';

const router = Router();
const config = getConfig();
const organizationRoles = new Set(['restaurant', 'ngo', 'rescue_partner', 'school']);
const cookieOptions = () => ({ httpOnly: true, secure: config.isProduction, sameSite: 'strict', path: '/', maxAge: parseDuration(config.jwtExpiresIn) });
function parseDuration(value) {
  const match = String(value).match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 60 * 60 * 1000;
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return Number(match[1]) * unit;
}
function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, ver: user.tokenVersion || 0, roleAtIssue: user.role }, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.jwtExpiresIn });
  res.cookie(config.cookieName, token, cookieOptions());
}

router.post('/register', asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  if (await User.exists({ email: data.email })) throw new AppError(409, 'An account with this email already exists.', 'EMAIL_EXISTS');
  const passwordHash = await bcrypt.hash(data.password, 12);
  let user;
  try {
    user = await User.create({ name: data.name, email: data.email, passwordHash, phone: data.phone, role: data.role, accountStatus: data.role === 'buyer' ? 'approved' : 'pending' });
    if (organizationRoles.has(data.role)) {
      const organization = await Organization.create({ ownerId: user._id, type: data.role, ...data.organization, verificationStatus: 'pending' });
      user.organizationId = organization._id;
      await user.save();
      await Verification.create({ userId: user._id, organizationId: organization._id, status: 'pending' });
    }
  } catch (err) {
    if (user?._id) {
      await User.deleteOne({ _id: user._id }).catch(() => {});
      if (user.organizationId) await Organization.deleteOne({ _id: user.organizationId }).catch(() => {});
    }
    throw err;
  }
  setSession(res, user);
  await createAudit({ actorId: user._id, action: 'account.registered', resourceType: 'user', resourceId: user._id, metadata: { role: user.role } });
  return sendData(res, { user: safeUser(user), organizationStatus: user.accountStatus }, 201, 'Account created. Organization accounts require verification before operational access.');
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
  if (['suspended', 'deactivated'].includes(user.accountStatus)) throw new AppError(403, 'This account is currently unavailable. Contact support.', 'ACCOUNT_UNAVAILABLE');
  setSession(res, user);
  await createAudit({ actorId: user._id, action: 'account.login', resourceType: 'user', resourceId: user._id });
  return sendData(res, { user: safeUser(user) }, 200, 'Signed in successfully.');
}));

router.post('/logout', asyncHandler(async (req, res) => {
  // Revoke the presented token version as well as clearing the browser cookie.
  const token = req.cookies?.[config.cookieName] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (token) {
    try {
      const claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      await User.updateOne({ _id: claims.sub, tokenVersion: claims.ver }, { $inc: { tokenVersion: 1 } });
    } catch { /* Logout must still clear the cookie for expired or malformed sessions. */ }
  }
  res.clearCookie(config.cookieName, { httpOnly: true, secure: config.isProduction, sameSite: 'strict', path: '/' });
  return sendData(res, { loggedOut: true }, 200, 'Signed out; the presented session was revoked when valid.');
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  await req.user.populate('organizationId');
  return sendData(res, { user: safeUser(req.user), organization: req.user.organizationId || null });
}));

router.patch('/profile', authenticate, asyncHandler(async (req, res) => {
  const data = profileSchema.parse(req.body);
  req.user.name = data.name;
  req.user.phone = data.phone;
  await req.user.save();
  return sendData(res, { user: safeUser(req.user) }, 200, 'Profile updated.');
}));

router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) throw new AppError(400, 'Current password is incorrect.', 'CURRENT_PASSWORD_INVALID');
  req.user.passwordHash = await bcrypt.hash(newPassword, 12);
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  res.clearCookie(config.cookieName, { httpOnly: true, secure: config.isProduction, sameSite: 'strict', path: '/' });
  return sendData(res, { reauthenticationRequired: true }, 200, 'Password changed. Please sign in again.');
}));

export default router;
