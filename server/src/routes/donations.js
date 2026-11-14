import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { FoodDonation, Organization, RescueAssignment, DeliveryEvent, User } from '../models/index.js';
import { foodSchema, statusSchema, assignmentCreateSchema } from '../validators/schemas.js';
import { AppError, asyncHandler, sendData, parsePagination } from '../utils/http.js';
import { DONATION_TRANSITIONS, validateFoodEligibility } from '../utils/rules.js';
import { createAudit, notifyUser, notifyAdmins } from '../services/system.js';

const router = Router();
router.use(authenticate);
router.use((req, _res, next) => {
  if (req.user.role !== 'admin' && req.user.accountStatus !== 'approved') return next(new AppError(403, 'Your organization must be approved before accessing donation operations.', 'ORGANIZATION_NOT_APPROVED'));
  next();
});

function donationFilterFor(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'restaurant') return { donorId: user._id };
  if (user.role === 'ngo') return { $or: [{ status: 'available', safetyStatus: 'cleared', expiresAt: { $gt: new Date() }, pickupDeadline: { $gt: new Date() } }, { recipientOrganizationId: user.organizationId }] };
  if (user.role === 'rescue_partner') return { _id: { $in: [] } };
  return { _id: { $in: [] } };
}
function canViewDonation(donation, user) {
  return user.role === 'admin' || String(donation.donorId) === String(user._id) || String(donation.recipientOrganizationId || '') === String(user.organizationId || '') || (user.role === 'ngo' && donation.status === 'available' && donation.safetyStatus === 'cleared');
}

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = donationFilterFor(req.user);
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = new RegExp(escapeRegex(String(req.query.category).slice(0, 80)), 'i');
  if (req.query.search) filter.name = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i');
  const [items, total] = await Promise.all([FoodDonation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('donorId', 'name').lean(), FoodDonation.countDocuments(filter)]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));

router.post('/', requireRoles('restaurant'), asyncHandler(async (req, res) => {
  const data = foodSchema.parse(req.body);
  const org = await Organization.findById(req.user.organizationId);
  const donation = await FoodDonation.create({ ...data, donorId: req.user._id, donorOrganizationId: org?._id, status: 'draft', safetyStatus: 'pending_review' });
  await createAudit({ actorId: req.user._id, action: 'donation.created', resourceType: 'donation', resourceId: donation._id });
  return sendData(res, donation, 201, 'Donation saved as a draft. Submit it when ready for safety review.');
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const donation = await FoodDonation.findById(req.params.id).populate('donorId', 'name').populate('recipientOrganizationId', 'name city state');
  if (!donation) throw new AppError(404, 'Donation not found.', 'NOT_FOUND');
  if (!canViewDonation(donation, req.user)) throw new AppError(403, 'You cannot view this donation.', 'FORBIDDEN');
  const events = await DeliveryEvent.find({ resourceType: 'donation', resourceId: donation._id }).sort({ createdAt: 1 }).lean();
  return sendData(res, { donation, events });
}));

router.patch('/:id', requireRoles('restaurant'), asyncHandler(async (req, res) => {
  const data = foodSchema.parse(req.body);
  const donation = await FoodDonation.findOne({ _id: req.params.id, donorId: req.user._id, status: { $in: ['draft', 'flagged'] } });
  if (!donation) throw new AppError(404, 'Editable donation not found. Only drafts or returned items can be edited.', 'NOT_FOUND');
  Object.assign(donation, data, { status: 'draft', safetyStatus: 'pending_review', safetyReviewReason: '' });
  await donation.save();
  return sendData(res, donation, 200, 'Donation updated. Submit it again for review.');
}));

router.post('/:id/submit', requireRoles('restaurant'), asyncHandler(async (req, res) => {
  const donation = await FoodDonation.findOne({ _id: req.params.id, donorId: req.user._id, status: { $in: ['draft', 'flagged'] } });
  if (!donation) throw new AppError(404, 'Submittable donation not found.', 'NOT_FOUND');
  const eligibility = validateFoodEligibility(donation);
  if (!eligibility.eligible) throw new AppError(422, 'Donation needs safety information before review.', 'FOOD_NOT_ELIGIBLE', eligibility.problems);
  donation.status = 'submitted'; donation.safetyStatus = 'pending_review';
  await donation.save();
  await notifyAdmins('safety.review_required', 'Donation needs safety review', `${donation.name} has been submitted for review.`, 'donation', donation._id);
  await createAudit({ actorId: req.user._id, action: 'donation.submitted', resourceType: 'donation', resourceId: donation._id });
  return sendData(res, donation, 200, 'Donation submitted for safety review.');
}));

router.post('/:id/accept', requireRoles('ngo'), asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.user.organizationId);
  if (!org || org.verificationStatus !== 'approved') throw new AppError(403, 'An approved NGO organization is required.', 'ORGANIZATION_NOT_APPROVED');
  const donation = await FoodDonation.findOneAndUpdate(
    { _id: req.params.id, status: 'available', safetyStatus: 'cleared', expiresAt: { $gt: new Date() }, pickupDeadline: { $gt: new Date() } },
    { $set: { status: 'accepted', recipientOrganizationId: org._id, acceptedBy: req.user._id } }, { new: true, runValidators: true }
  );
  if (!donation) throw new AppError(409, 'This donation is no longer eligible to accept.', 'DONATION_UNAVAILABLE');
  await DeliveryEvent.create({ resourceType: 'donation', resourceId: donation._id, actorId: req.user._id, status: 'accepted', notes: 'Accepted by receiving organization.' });
  await notifyUser(donation.donorId, 'donation.accepted', 'Donation accepted', `Your donation “${donation.name}” has been accepted.`, 'donation', donation._id);
  await createAudit({ actorId: req.user._id, action: 'donation.accepted', resourceType: 'donation', resourceId: donation._id });
  return sendData(res, donation, 200, 'Donation accepted. Coordinate collection next.');
}));

router.post('/:id/status', asyncHandler(async (req, res) => {
  const { status, notes } = statusSchema.parse(req.body);
  const donation = await FoodDonation.findById(req.params.id);
  if (!donation) throw new AppError(404, 'Donation not found.', 'NOT_FOUND');
  const isDonor = String(donation.donorId) === String(req.user._id);
  const isRecipient = String(donation.recipientOrganizationId || '') === String(req.user.organizationId || '') && req.user.role === 'ngo';
  const allowedActor = req.user.role === 'admin' || ((isDonor || isRecipient) && ['pickup_scheduled', 'receipt_confirmed', 'completed', 'cancelled'].includes(status));
  if (!allowedActor) throw new AppError(403, 'You cannot change this donation status.', 'FORBIDDEN');
  if (!DONATION_TRANSITIONS[donation.status]?.includes(status)) throw new AppError(409, `Cannot change donation status from ${donation.status} to ${status}.`, 'INVALID_STATUS_TRANSITION');
  if (['completed', 'receipt_confirmed'].includes(status) && donation.expiresAt <= new Date()) throw new AppError(409, 'Expired food cannot be marked as completed.', 'FOOD_EXPIRED');
  donation.status = status;
  await donation.save();
  await DeliveryEvent.create({ resourceType: 'donation', resourceId: donation._id, actorId: req.user._id, status, notes: notes || '' });
  await createAudit({ actorId: req.user._id, action: 'donation.status_changed', resourceType: 'donation', resourceId: donation._id, metadata: { status } });
  await notifyUser(isDonor ? donation.recipientOrganizationId && (await User.findOne({ organizationId: donation.recipientOrganizationId }).select('_id'))?._id : donation.donorId, 'donation.status', 'Donation status updated', `Donation “${donation.name}” is now ${status.replaceAll('_', ' ')}.`, 'donation', donation._id);
  return sendData(res, donation, 200, 'Donation status updated.');
}));

router.post('/:id/assignments', asyncHandler(async (req, res) => {
  const { notes } = assignmentCreateSchema.parse(req.body || {});
  const donation = await FoodDonation.findById(req.params.id);
  if (!donation) throw new AppError(404, 'Donation not found.', 'NOT_FOUND');
  if (req.user.role !== 'admin' && String(donation.donorId) !== String(req.user._id) && String(donation.recipientOrganizationId || '') !== String(req.user.organizationId || '')) throw new AppError(403, 'Only the donor, recipient, or an administrator can create an assignment.', 'FORBIDDEN');
  if (!['accepted', 'pickup_scheduled'].includes(donation.status) || donation.safetyStatus !== 'cleared' || donation.expiresAt <= new Date()) throw new AppError(409, 'Donation is not ready for rescue assignment.', 'DONATION_NOT_ASSIGNABLE');
  const destination = await Organization.findById(donation.recipientOrganizationId);
  const existingAssignment = await RescueAssignment.findOne({ donationId: donation._id, status: { $in: ['offered', 'accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 'delivered'] } });
  if (existingAssignment) throw new AppError(409, 'An active rescue assignment already exists for this donation.', 'ASSIGNMENT_ALREADY_EXISTS');
  const assignment = await RescueAssignment.create({ donationId: donation._id, assignedBy: req.user._id, pickupAddress: donation.pickupAddress, destinationAddress: destination?.address || donation.pickupAddress, status: 'offered', notes });
  await createAudit({ actorId: req.user._id, action: 'rescue_assignment.created', resourceType: 'assignment', resourceId: assignment._id });
  const partners = await User.find({ role: 'rescue_partner', accountStatus: 'approved' }).select('_id').lean();
  if (partners.length) await Promise.all(partners.map(p => notifyUser(p._id, 'assignment.offered', 'New rescue assignment', `A collection is available for “${donation.name}”.`, 'assignment', assignment._id)));
  return sendData(res, assignment, 201, 'Rescue assignment offered to eligible partners.');
}));

function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export default router;
