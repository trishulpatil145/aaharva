import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { SchoolRequest, Organization, FoodDonation, User } from '../models/index.js';
import { schoolRequestSchema, statusSchema } from '../validators/schemas.js';
import { AppError, asyncHandler, sendData, parsePagination } from '../utils/http.js';
import { createAudit, notifyUser, notifyAdmins } from '../services/system.js';

const router = Router();
router.use(authenticate);
router.use((req, _res, next) => {
  if (req.user.role !== 'admin' && req.user.accountStatus !== 'approved') return next(new AppError(403, 'Your organization must be approved before accessing school-support operations.', 'ORGANIZATION_NOT_APPROVED'));
  next();
});

function requestFilter(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'school') return { schoolOrganizationId: user.organizationId };
  return { status: { $in: ['approved', 'partially_fulfilled', 'awaiting_receipt'] } };
}
function canView(request, user) {
  if (user.role === 'admin') return true;
  if (user.role === 'school') return String(request.schoolOrganizationId) === String(user.organizationId || '');
  return ['restaurant', 'ngo'].includes(user.role) && ['approved', 'partially_fulfilled', 'awaiting_receipt'].includes(request.status);
}

router.get('/', asyncHandler(async (req, res) => {
  if (!['admin', 'school', 'restaurant', 'ngo'].includes(req.user.role)) throw new AppError(403, 'Your account cannot access school assistance requests.', 'FORBIDDEN');
  const { page, limit, skip } = parsePagination(req.query);
  const filter = requestFilter(req.user);
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([SchoolRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('schoolOrganizationId', 'name city state').lean(), SchoolRequest.countDocuments(filter)]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));

router.post('/', requireRoles('school'), asyncHandler(async (req, res) => {
  const data = schoolRequestSchema.parse(req.body);
  const org = await Organization.findById(req.user.organizationId);
  if (!org || org.type !== 'school') throw new AppError(403, 'A verified school organization is required.', 'SCHOOL_ORGANIZATION_REQUIRED');
  const request = await SchoolRequest.create({ ...data, schoolOrganizationId: org._id, createdBy: req.user._id, status: 'submitted' });
  await notifyAdmins('school_request.submitted', 'New school food support request', `${request.title} needs review.`, 'school_request', request._id);
  await createAudit({ actorId: req.user._id, action: 'school_request.created', resourceType: 'school_request', resourceId: request._id });
  return sendData(res, request, 201, 'Supplementary food support request submitted for review.');
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const request = await SchoolRequest.findById(req.params.id).populate('schoolOrganizationId', 'name city state').populate('contributions.contributorId', 'name role').lean();
  if (!request) throw new AppError(404, 'School request not found.', 'NOT_FOUND');
  if (!canView(request, req.user)) throw new AppError(403, 'You cannot view this school request.', 'FORBIDDEN');
  return sendData(res, request);
}));

router.post('/:id/decision', requireRoles('admin'), asyncHandler(async (req, res) => {
  const { status, notes } = statusSchema.parse(req.body);
  if (!['approved', 'rejected'].includes(status)) throw new AppError(422, 'Decision must be approved or rejected.', 'INVALID_DECISION');
  const request = await SchoolRequest.findOne({ _id: req.params.id, status: 'submitted' });
  if (!request) throw new AppError(404, 'Request awaiting review not found.', 'NOT_FOUND');
  request.status = status;
  request.decisionReason = notes || '';
  request.decidedBy = req.user._id;
  await request.save();
  await createAudit({ actorId: req.user._id, action: `school_request.${status}`, resourceType: 'school_request', resourceId: request._id, reason: notes || '' });
  await notifyUser(request.createdBy, `school_request.${status}`, `School request ${status}`, `${request.title}: ${notes || (status === 'approved' ? 'Approved for contributions.' : 'Request not approved.')}`, 'school_request', request._id);
  return sendData(res, request, 200, `School request ${status}.`);
}));

router.post('/:id/fulfill', requireRoles('restaurant', 'ngo', 'admin'), asyncHandler(async (req, res) => {
  const quantity = Number(req.body?.quantity);
  const donationId = String(req.body?.donationId || '');
  const note = String(req.body?.note || '').trim().slice(0, 600);
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !/^[a-f\d]{24}$/i.test(donationId)) throw new AppError(422, 'A valid donation ID and positive whole-number quantity are required.', 'VALIDATION_ERROR');
  if (Object.keys(req.body || {}).some(k => !['quantity', 'donationId', 'note'].includes(k))) throw new AppError(422, 'Unsupported request fields.', 'VALIDATION_ERROR');
  const request = await SchoolRequest.findById(req.params.id);
  if (!request || !['approved', 'partially_fulfilled', 'awaiting_receipt'].includes(request.status)) throw new AppError(409, 'This school request is not accepting contributions.', 'REQUEST_UNAVAILABLE');
  const schoolOrg = await Organization.findById(request.schoolOrganizationId);
  if (!schoolOrg) throw new AppError(409, 'School organization record is unavailable.', 'SCHOOL_UNAVAILABLE');
  const donation = await FoodDonation.findOne({ _id: donationId, status: 'available', safetyStatus: 'cleared', expiresAt: { $gt: new Date() }, pickupDeadline: { $gt: new Date() }, donorId: req.user.role === 'admin' ? { $exists: true } : req.user._id });
  if (!donation) throw new AppError(409, 'Only your available, safety-cleared donation can be contributed.', 'DONATION_UNAVAILABLE');
  if (quantity !== donation.quantity) throw new AppError(422, 'This workflow allocates a whole donation; the quantity must match the donation quantity.', 'DONATION_QUANTITY_MISMATCH');

  const claimed = await FoodDonation.findOneAndUpdate({ _id: donation._id, status: 'available', safetyStatus: 'cleared', expiresAt: { $gt: new Date() } }, { $set: { status: 'accepted', recipientOrganizationId: schoolOrg._id, acceptedBy: req.user._id } }, { new: true });
  if (!claimed) throw new AppError(409, 'This donation has just been claimed by another workflow.', 'DONATION_UNAVAILABLE');

  const updated = await SchoolRequest.findOneAndUpdate({
    _id: request._id, status: { $in: ['approved', 'partially_fulfilled', 'awaiting_receipt'] },
    $expr: { $lte: [{ $add: ['$allocatedQuantity', quantity] }, '$requestedQuantity'] }
  }, {
    $inc: { allocatedQuantity: quantity },
    $push: { contributions: { contributorId: req.user._id, donationId: donation._id, quantity, note } }
  }, { new: true, runValidators: true });
  if (!updated) {
    await FoodDonation.updateOne({ _id: claimed._id, status: 'accepted', acceptedBy: req.user._id }, { $set: { status: 'available' }, $unset: { recipientOrganizationId: 1, acceptedBy: 1 } });
    throw new AppError(409, 'Contribution would exceed the request quantity. The donation was released.', 'REQUEST_QUANTITY_EXCEEDED');
  }
  if (updated.allocatedQuantity >= updated.requestedQuantity && updated.receivedQuantity < updated.requestedQuantity) updated.status = 'awaiting_receipt';
  else if (updated.allocatedQuantity > 0 && updated.receivedQuantity < updated.requestedQuantity) updated.status = 'partially_fulfilled';
  await updated.save();
  await createAudit({ actorId: req.user._id, action: 'school_request.contribution_added', resourceType: 'school_request', resourceId: updated._id, metadata: { quantity } });
  await notifyUser(updated.createdBy, 'school_request.contribution', 'Food contribution recorded', `${quantity} ${updated.unit} allocated to “${updated.title}”.`, 'school_request', updated._id);
  return sendData(res, updated, 200, 'Contribution recorded. The school must confirm receipt before quantities count as fulfilled.');
}));

router.post('/:id/receipt', requireRoles('school'), asyncHandler(async (req, res) => {
  const quantity = Number(req.body?.quantity);
  const notes = String(req.body?.notes || '').trim().slice(0, 600);
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || Object.keys(req.body || {}).some(k => !['quantity', 'notes'].includes(k))) throw new AppError(422, 'A positive whole-number quantity is required.', 'VALIDATION_ERROR');
  const request = await SchoolRequest.findOne({ _id: req.params.id, schoolOrganizationId: req.user.organizationId, status: { $in: ['approved', 'partially_fulfilled', 'awaiting_receipt'] } });
  if (!request) throw new AppError(404, 'School request not found or not ready for receipt confirmation.', 'NOT_FOUND');
  const updated = await SchoolRequest.findOneAndUpdate({
    _id: request._id,
    $expr: { $and: [
      { $lte: [{ $add: ['$receivedQuantity', quantity] }, '$requestedQuantity'] },
      { $lte: [{ $add: ['$receivedQuantity', quantity] }, '$allocatedQuantity'] }
    ] }
  }, { $inc: { receivedQuantity: quantity }, $push: { receiptEvents: { actorId: req.user._id, quantity, notes } } }, { new: true, runValidators: true });
  if (!updated) throw new AppError(409, 'Receipt quantity cannot exceed allocated or requested quantity.', 'RECEIPT_QUANTITY_EXCEEDED');
  if (updated.receivedQuantity >= updated.requestedQuantity) updated.status = 'fulfilled';
  else if (updated.allocatedQuantity >= updated.requestedQuantity) updated.status = 'awaiting_receipt';
  else if (updated.receivedQuantity > 0) updated.status = 'partially_fulfilled';
  await updated.save();
  await createAudit({ actorId: req.user._id, action: 'school_request.receipt_confirmed', resourceType: 'school_request', resourceId: updated._id, metadata: { quantity } });
  await notifyAdmins('school_request.receipt', 'School receipt confirmed', `${quantity} ${updated.unit} received for “${updated.title}”.`, 'school_request', updated._id);
  return sendData(res, updated, 200, updated.status === 'fulfilled' ? 'The request is fully received and marked fulfilled.' : 'Receipt recorded; the request remains open for remaining quantities.');
}));

export default router;
