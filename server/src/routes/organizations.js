import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { Organization, Verification, User } from '../models/index.js';
import { asyncHandler, AppError, sendData, safeUser, parsePagination } from '../utils/http.js';
import { decisionSchema } from '../validators/schemas.js';
import { createAudit, notifyUser } from '../services/system.js';

const router = Router();
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const organization = await Organization.findOne({ ownerId: req.user._id }).lean();
  const verification = organization ? await Verification.findOne({ organizationId: organization._id }).sort({ submittedAt: -1 }).lean() : null;
  return sendData(res, { organization, verification });
}));

router.get('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (['pending', 'approved', 'rejected'].includes(req.query.status)) filter.verificationStatus = req.query.status;
  const [items, total] = await Promise.all([Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('ownerId', 'name email role accountStatus').lean(), Organization.countDocuments(filter)]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));

router.post('/:id/decision', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { decision, reason } = decisionSchema.parse(req.body);
  const organization = await Organization.findById(req.params.id);
  if (!organization) throw new AppError(404, 'Organization not found.', 'NOT_FOUND');
  const owner = await User.findById(organization.ownerId);
  if (!owner) throw new AppError(404, 'Organization owner not found.', 'NOT_FOUND');
  const approved = decision === 'approve';
  organization.verificationStatus = approved ? 'approved' : 'rejected';
  await organization.save();
  owner.accountStatus = approved ? 'approved' : 'rejected';
  owner.statusReason = reason || '';
  owner.tokenVersion += 1;
  await owner.save();
  await Verification.findOneAndUpdate({ organizationId: organization._id, status: 'pending' }, { status: approved ? 'approved' : 'rejected', reviewedAt: new Date(), reviewedBy: req.user._id, reason: reason || '' }, { new: true, sort: { submittedAt: -1 } });
  await createAudit({ actorId: req.user._id, action: approved ? 'organization.approved' : 'organization.rejected', resourceType: 'organization', resourceId: organization._id, reason, metadata: { role: owner.role } });
  await notifyUser(owner._id, approved ? 'organization.approved' : 'organization.rejected', `Organization ${approved ? 'approved' : 'not approved'}`, approved ? 'Your organization has been approved. Operational features are now available.' : `Your organization application was not approved. ${reason || 'Contact support for details.'}`, 'organization', organization._id);
  return sendData(res, { organization, user: safeUser(owner) }, 200, `Organization ${approved ? 'approved' : 'rejected'}.`);
}));

export default router;
