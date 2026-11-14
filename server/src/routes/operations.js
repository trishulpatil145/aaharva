import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { RescueAssignment, FoodDonation, DeliveryEvent, Notification, Complaint, SafetyIncident, User, FoodListing, Organization, Order, SchoolRequest, AuditLog } from '../models/index.js';
import { complaintSchema, incidentSchema, statusSchema, decisionSchema } from '../validators/schemas.js';
import { ASSIGNMENT_TRANSITIONS, DONATION_TRANSITIONS, validateFoodEligibility } from '../utils/rules.js';
import { AppError, asyncHandler, sendData, parsePagination, safeUser } from '../utils/http.js';
import { createAudit, notifyUser, notifyAdmins } from '../services/system.js';

const router = Router();
router.use(authenticate);
router.use((req, _res, next) => {
  if (req.user.role === 'admin' && req.user.accountStatus !== 'approved') return next(new AppError(403, 'This administrator account is not active.', 'ACCOUNT_NOT_APPROVED'));
  next();
});

async function holdDonationForSafety(donationId, actorId, reason) {
  await FoodDonation.updateOne({ _id: donationId }, { $set: { safetyStatus: 'flagged', safetyReviewReason: reason, status: 'flagged' } });
  const active = await RescueAssignment.find({ donationId, status: { $in: ['offered', 'accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 'delivered'] } }).select('_id').lean();
  if (!active.length) return;
  const ids = active.map(item => item._id);
  await RescueAssignment.updateMany({ _id: { $in: ids }, status: { $in: ['offered', 'accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 'delivered'] } }, { $set: { status: 'cancelled', notes: 'Cancelled automatically because the linked donation was held for a safety review.' } });
  await Promise.allSettled(active.map(item => DeliveryEvent.create({ resourceType: 'assignment', resourceId: donationId, relatedResourceId: item._id, actorId, status: 'cancelled', notes: reason })));
}


router.get('/assignments', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.accountStatus !== 'approved') throw new AppError(403, 'Your account must be approved before accessing assignments.', 'ACCOUNT_NOT_APPROVED');
  const { page, limit, skip } = parsePagination(req.query);
  let filter;
  if (req.user.role === 'admin') filter = {};
  else if (req.user.role === 'rescue_partner') {
    const declined = await DeliveryEvent.distinct('relatedResourceId', { actorId: req.user._id, resourceType: 'assignment', status: 'declined' });
    filter = { $or: [{ rescuePartnerId: req.user._id }, { status: 'offered', rescuePartnerId: null, _id: { $nin: declined } }] };
  }
  else if (req.user.role === 'restaurant') {
    const donations = await FoodDonation.find({ donorId: req.user._id }).distinct('_id');
    filter = { donationId: { $in: donations } };
  } else if (req.user.role === 'ngo' || req.user.role === 'school') {
    const donations = await FoodDonation.find({ recipientOrganizationId: req.user.organizationId }).distinct('_id');
    filter = { donationId: { $in: donations } };
  } else throw new AppError(403, 'Your account cannot access rescue assignments.', 'FORBIDDEN');
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([RescueAssignment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('donationId', 'name category quantity unit expiresAt status').populate('rescuePartnerId', 'name phone').lean(), RescueAssignment.countDocuments(filter)]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));

router.get('/assignments/:id/events', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.accountStatus !== 'approved') throw new AppError(403, 'Your account must be approved before accessing delivery timelines.', 'ACCOUNT_NOT_APPROVED');
  const assignment = await RescueAssignment.findById(req.params.id);
  if (!assignment) throw new AppError(404, 'Rescue assignment not found.', 'NOT_FOUND');
  const donation = await FoodDonation.findById(assignment.donationId).select('donorId recipientOrganizationId');
  const visible = req.user.role === 'admin' || (req.user.role === 'rescue_partner' && (String(assignment.rescuePartnerId || '') === String(req.user._id) || assignment.status === 'offered')) || String(donation?.donorId || '') === String(req.user._id) || (donation?.recipientOrganizationId && String(donation.recipientOrganizationId) === String(req.user.organizationId || ''));
  if (!visible) throw new AppError(403, 'You cannot view this delivery timeline.', 'FORBIDDEN');
  const events = await DeliveryEvent.find({ $or: [{ resourceType: 'donation', resourceId: assignment.donationId }, { resourceType: 'assignment', relatedResourceId: assignment._id }] }).sort({ createdAt: 1 }).populate('actorId', 'name role').lean();
  return sendData(res, { assignment, events });
}));

router.post('/assignments/:id/accept', requireRoles('rescue_partner'), asyncHandler(async (req, res) => {
  const assignment = await RescueAssignment.findOneAndUpdate({ _id: req.params.id, status: 'offered', rescuePartnerId: null }, { $set: { status: 'accepted', rescuePartnerId: req.user._id } }, { new: true });
  if (!assignment) throw new AppError(409, 'This assignment is no longer available.', 'ASSIGNMENT_UNAVAILABLE');
  const donation = await FoodDonation.findById(assignment.donationId);
  if (!donation || donation.safetyStatus !== 'cleared' || donation.expiresAt <= new Date() || !['accepted', 'pickup_scheduled'].includes(donation.status)) {
    await RescueAssignment.updateOne({ _id: assignment._id, rescuePartnerId: req.user._id }, { $set: { status: 'cancelled' } });
    throw new AppError(409, 'The donation is no longer eligible for collection.', 'DONATION_UNAVAILABLE');
  }
  await DeliveryEvent.create({ resourceType: 'assignment', resourceId: donation._id, relatedResourceId: assignment._id, actorId: req.user._id, status: 'accepted', notes: 'Rescue partner accepted assignment.' });
  await createAudit({ actorId: req.user._id, action: 'assignment.accepted', resourceType: 'assignment', resourceId: assignment._id });
  await notifyUser(donation.donorId, 'assignment.accepted', 'Rescue partner assigned', 'A rescue partner has accepted the collection.', 'assignment', assignment._id);
  if (donation.recipientOrganizationId) {
    const receiver = await User.findOne({ organizationId: donation.recipientOrganizationId }).select('_id');
    if (receiver) await notifyUser(receiver._id, 'assignment.accepted', 'Rescue partner assigned', 'A rescue partner has accepted your donation collection.', 'assignment', assignment._id);
  }
  return sendData(res, assignment, 200, 'Rescue assignment accepted.');
}));

router.post('/assignments/:id/decline', requireRoles('rescue_partner'), asyncHandler(async (req, res) => {
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 1000) : '';
  if (Object.keys(req.body || {}).some(key => key !== 'notes')) throw new AppError(422, 'Only an optional notes field is accepted.', 'VALIDATION_ERROR');
  const assignment = await RescueAssignment.findOne({ _id: req.params.id, status: 'offered', rescuePartnerId: null });
  if (!assignment) throw new AppError(409, 'This assignment is no longer available to decline.', 'ASSIGNMENT_UNAVAILABLE');
  const donation = await FoodDonation.findById(assignment.donationId).select('_id name');
  if (!donation) throw new AppError(404, 'Linked donation not found.', 'DONATION_MISSING');
  await DeliveryEvent.create({ resourceType: 'assignment', resourceId: donation._id, relatedResourceId: assignment._id, actorId: req.user._id, status: 'declined', notes: notes || 'Rescue partner declined this offer.' });
  await createAudit({ actorId: req.user._id, action: 'assignment.offer_declined', resourceType: 'assignment', resourceId: assignment._id, reason: notes });
  return sendData(res, assignment, 200, 'Offer declined for your account; it remains available to other rescue partners.');
}));

router.post('/assignments/:id/status', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.accountStatus !== 'approved') throw new AppError(403, 'Your account must be approved before updating a delivery.', 'ACCOUNT_NOT_APPROVED');
  const { status, notes } = statusSchema.parse(req.body);
  const assignment = await RescueAssignment.findById(req.params.id);
  if (!assignment) throw new AppError(404, 'Rescue assignment not found.', 'NOT_FOUND');
  if (req.user.role !== 'admin' && String(assignment.rescuePartnerId || '') !== String(req.user._id)) throw new AppError(403, 'Only the assigned rescue partner or an administrator may update this delivery.', 'FORBIDDEN');
  if (!ASSIGNMENT_TRANSITIONS[assignment.status]?.includes(status)) throw new AppError(409, `Cannot change assignment from ${assignment.status} to ${status}.`, 'INVALID_STATUS_TRANSITION');
  const donation = await FoodDonation.findById(assignment.donationId);
  if (!donation) throw new AppError(409, 'Linked donation no longer exists.', 'DONATION_MISSING');
  const donationStatusByAssignment = { pickup_scheduled: 'pickup_scheduled', picked_up: 'picked_up', in_transit: 'in_transit', delivered: 'delivered', failed: 'failed' };
  const newDonationStatus = donationStatusByAssignment[status];
  if (newDonationStatus && donation.status !== newDonationStatus && !DONATION_TRANSITIONS[donation.status]?.includes(newDonationStatus)) throw new AppError(409, `Donation status ${donation.status} cannot transition to ${newDonationStatus}.`, 'INVALID_STATUS_TRANSITION');
  assignment.status = status;
  if (notes) assignment.notes = [assignment.notes, notes].filter(Boolean).join('\n').slice(-1000);
  await assignment.save();
  if (newDonationStatus) {
    donation.status = newDonationStatus;
    await donation.save();
    await DeliveryEvent.create({ resourceType: 'donation', resourceId: donation._id, relatedResourceId: assignment._id, actorId: req.user._id, status: newDonationStatus, notes: notes || '' });
  }
  await DeliveryEvent.create({ resourceType: 'assignment', resourceId: donation._id, relatedResourceId: assignment._id, actorId: req.user._id, status, notes: notes || '' });
  await createAudit({ actorId: req.user._id, action: 'assignment.status_changed', resourceType: 'assignment', resourceId: assignment._id, metadata: { status } });
  await Promise.allSettled([
    notifyUser(donation.donorId, 'delivery.update', 'Rescue delivery updated', `Delivery for “${donation.name}” is now ${status.replaceAll('_', ' ')}.`, 'assignment', assignment._id),
    donation.recipientOrganizationId ? User.findOne({ organizationId: donation.recipientOrganizationId }).select('_id').then(user => user && notifyUser(user._id, 'delivery.update', 'Rescue delivery updated', `Delivery for “${donation.name}” is now ${status.replaceAll('_', ' ')}.`, 'assignment', assignment._id)) : Promise.resolve(null)
  ]);
  return sendData(res, assignment, 200, 'Delivery status updated.');
}));

router.get('/notifications', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { recipientId: req.user._id };
  if (req.query.unread === 'true') filter.readAt = { $exists: false };
  const [items, total, unread] = await Promise.all([Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Notification.countDocuments(filter), Notification.countDocuments({ recipientId: req.user._id, readAt: { $exists: false } })]);
  return sendData(res, { items, page, limit, total, unread, pages: Math.ceil(total / limit) });
}));
router.post('/notifications/:id/read', asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipientId: req.user._id, readAt: { $exists: false } }, { $set: { readAt: new Date() } }, { new: true });
  if (!notification) {
    const existing = await Notification.findOne({ _id: req.params.id, recipientId: req.user._id });
    if (!existing) throw new AppError(404, 'Notification not found.', 'NOT_FOUND');
    return sendData(res, existing, 200, 'Notification already read.');
  }
  return sendData(res, notification, 200, 'Notification marked as read.');
}));
router.post('/notifications/read-all', asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ recipientId: req.user._id, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  return sendData(res, { markedRead: result.modifiedCount }, 200, 'Unread notifications marked as read.');
}));

router.get('/complaints', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = req.user.role === 'admin' ? {} : { reporterId: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([Complaint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Complaint.countDocuments(filter)]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));
router.post('/complaints', asyncHandler(async (req, res) => {
  const data = complaintSchema.parse(req.body);
  const complaint = await Complaint.create({ ...data, reporterId: req.user._id });
  await notifyAdmins('complaint.opened', 'New platform complaint', 'A user submitted a complaint requiring review.', 'complaint', complaint._id);
  await createAudit({ actorId: req.user._id, action: 'complaint.created', resourceType: 'complaint', resourceId: complaint._id });
  return sendData(res, complaint, 201, 'Complaint submitted for review.');
}));
router.post('/complaints/:id/status', requireRoles('admin'), asyncHandler(async (req, res) => {
  const { status, notes } = statusSchema.parse(req.body);
  if (!['investigating', 'resolved', 'dismissed', 'open'].includes(status)) throw new AppError(422, 'Unsupported complaint status.', 'INVALID_STATUS');
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError(404, 'Complaint not found.', 'NOT_FOUND');
  complaint.status = status;
  if (['resolved', 'dismissed'].includes(status)) { complaint.resolvedAt = new Date(); complaint.resolutionNotes = notes || ''; }
  else if (notes) complaint.resolutionNotes = notes;
  complaint.assignedTo = req.user._id;
  await complaint.save();
  await createAudit({ actorId: req.user._id, action: 'complaint.status_changed', resourceType: 'complaint', resourceId: complaint._id, reason: notes || '', metadata: { status } });
  await notifyUser(complaint.reporterId, 'complaint.updated', 'Complaint updated', `Your complaint is now ${status}.`, 'complaint', complaint._id);
  return sendData(res, complaint, 200, 'Complaint updated.');
}));

router.get('/incidents', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = req.user.role === 'admin' ? {} : { reporterId: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([SafetyIncident.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), SafetyIncident.countDocuments(filter)]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));
router.post('/incidents', asyncHandler(async (req, res) => {
  const data = incidentSchema.parse(req.body);
  let relatedResource = null;
  if (data.relatedType === 'donation') relatedResource = await FoodDonation.findById(data.relatedId).select('_id donorId recipientOrganizationId').lean();
  else if (data.relatedType === 'listing') relatedResource = await FoodListing.findById(data.relatedId).select('_id sellerId status').lean();
  else if (data.relatedType === 'order') relatedResource = await Order.findById(data.relatedId).select('_id buyerId listingId').lean();
  else if (data.relatedType === 'organization') relatedResource = await Organization.findById(data.relatedId).select('_id ownerId').lean();
  else if (data.relatedType === 'delivery') relatedResource = await RescueAssignment.findById(data.relatedId).select('_id donationId rescuePartnerId').lean();
  if (!relatedResource) throw new AppError(404, 'The referenced safety resource was not found.', 'RELATED_RESOURCE_NOT_FOUND');
  const incident = await SafetyIncident.create({ ...data, reporterId: req.user._id });
  // Precautionary hold: this removes the food from circulation but does not publicly assert a finding of wrongdoing.
  if (data.relatedType === 'donation') await holdDonationForSafety(data.relatedId, req.user._id, 'Safety incident submitted; authorized review required.');
  if (data.relatedType === 'listing') await FoodListing.updateOne({ _id: data.relatedId }, { $set: { safetyStatus: 'flagged', safetyReviewReason: 'Safety incident submitted; authorized review required.', status: 'paused' } });
  if (data.relatedType === 'order' && relatedResource.listingId) await FoodListing.updateOne({ _id: relatedResource.listingId }, { $set: { safetyStatus: 'flagged', safetyReviewReason: 'Order-related safety incident submitted; authorized review required.', status: 'paused' } });
  if (data.relatedType === 'delivery' && relatedResource.donationId) await holdDonationForSafety(relatedResource.donationId, req.user._id, 'Delivery-related safety incident submitted; authorized review required.');
  await notifyAdmins('safety.incident', 'Safety incident needs investigation', `A ${data.severity} severity incident was submitted.`, 'incident', incident._id);
  await createAudit({ actorId: req.user._id, action: 'safety_incident.created', resourceType: 'incident', resourceId: incident._id, metadata: { severity: data.severity, relatedType: data.relatedType } });
  return sendData(res, incident, 201, 'Incident submitted. Related food has been held for authorized review where applicable.');
}));
router.post('/incidents/:id/status', requireRoles('admin'), asyncHandler(async (req, res) => {
  const { status, notes } = statusSchema.parse(req.body);
  if (!['reviewing', 'investigating', 'corrective_action', 'resolved', 'dismissed'].includes(status)) throw new AppError(422, 'Unsupported incident status.', 'INVALID_STATUS');
  const incident = await SafetyIncident.findById(req.params.id);
  if (!incident) throw new AppError(404, 'Safety incident not found.', 'NOT_FOUND');
  incident.status = status; incident.reviewNotes = notes || incident.reviewNotes; incident.reviewedBy = req.user._id; incident.reviewedAt = new Date();
  if (status === 'corrective_action') incident.correctiveAction = notes || incident.correctiveAction;
  await incident.save();
  await createAudit({ actorId: req.user._id, action: 'safety_incident.status_changed', resourceType: 'incident', resourceId: incident._id, reason: notes || '', metadata: { status } });
  await notifyUser(incident.reporterId, 'safety_incident.updated', 'Safety incident reviewed', `Your safety incident is now ${status}.`, 'incident', incident._id);
  return sendData(res, incident, 200, 'Safety incident updated. Any food held for review remains held until separately cleared.');
}));

// Administrator: database-backed overview and safety verification.
router.get('/admin/analytics', requireRoles('admin'), asyncHandler(async (_req, res) => {
  const [users, organizationsPending, donationsAvailable, donationsCompleted, listingsActive, ordersPlaced, schoolRequestsOpen, complaintsOpen, incidentsOpen, rescuedQuantity] = await Promise.all([
    User.countDocuments({}), Organization.countDocuments({ verificationStatus: 'pending' }), FoodDonation.countDocuments({ status: 'available', safetyStatus: 'cleared' }),
    FoodDonation.countDocuments({ status: 'completed' }), FoodListing.countDocuments({ status: 'active', safetyStatus: 'cleared', expiresAt: { $gt: new Date() } }),
    Order.countDocuments({ status: { $in: ['placed', 'confirmed', 'preparing', 'ready'] } }), SchoolRequest.countDocuments({ status: { $in: ['submitted', 'approved', 'partially_fulfilled', 'awaiting_receipt'] } }),
    Complaint.countDocuments({ status: { $in: ['open', 'investigating'] } }), SafetyIncident.countDocuments({ status: { $nin: ['resolved', 'dismissed'] } }),
    FoodDonation.aggregate([{ $match: { status: { $in: ['delivered', 'receipt_confirmed', 'completed'] }, isDemo: { $ne: true } } }, { $group: { _id: null, quantity: { $sum: '$quantity' } } }])
  ]);
  return sendData(res, { users, organizationsPending, donationsAvailable, donationsCompleted, listingsActive, ordersPlaced, schoolRequestsOpen, complaintsOpen, incidentsOpen, verifiedRescuedQuantity: rescuedQuantity[0]?.quantity || 0, currency: 'INR', generatedAt: new Date().toISOString() });
}));
router.get('/admin/safety-queue', requireRoles('admin'), asyncHandler(async (req, res) => {
  const [donations, listings] = await Promise.all([
    FoodDonation.find({ $or: [{ status: 'submitted' }, { safetyStatus: 'flagged' }] }).sort({ createdAt: -1 }).limit(100).populate('donorId', 'name email').lean(),
    FoodListing.find({ $or: [{ status: 'pending_review' }, { safetyStatus: 'flagged' }] }).sort({ createdAt: -1 }).limit(100).populate('sellerId', 'name email').lean()
  ]);
  return sendData(res, { donations, listings });
}));
router.post('/admin/safety/:type/:id/decision', requireRoles('admin'), asyncHandler(async (req, res) => {
  const { decision, reason } = decisionSchema.parse(req.body);
  if (!['donation', 'listing'].includes(req.params.type)) throw new AppError(404, 'Safety resource type not found.', 'NOT_FOUND');
  const isDonation = req.params.type === 'donation';
  const Model = isDonation ? FoodDonation : FoodListing;
  const item = await Model.findById(req.params.id);
  if (!item) throw new AppError(404, 'Safety review item not found.', 'NOT_FOUND');
  if (decision === 'approve') {
    const reviewCandidate = item.toObject(); reviewCandidate.safetyStatus = 'pending_review';
    const eligibility = validateFoodEligibility(reviewCandidate);
    if (!eligibility.eligible) throw new AppError(422, 'This food cannot be cleared until eligibility issues are corrected.', 'FOOD_NOT_ELIGIBLE', eligibility.problems);
    item.safetyStatus = 'cleared'; item.safetyReviewReason = reason || 'Approved by authorized administrator.'; item.safetyReviewedBy = req.user._id; item.safetyReviewedAt = new Date();
    item.status = isDonation ? 'available' : (item.availableQuantity > 0 ? 'active' : 'sold_out');
    if (isDonation) { item.recipientOrganizationId = undefined; item.acceptedBy = undefined; }
  } else {
    item.safetyStatus = 'flagged'; item.safetyReviewReason = reason || 'Not cleared by authorized review.'; item.safetyReviewedBy = req.user._id; item.safetyReviewedAt = new Date();
    item.status = isDonation ? 'flagged' : 'rejected';
  }
  await item.save();
  const ownerId = isDonation ? item.donorId : item.sellerId;
  await Promise.allSettled([
    notifyUser(ownerId, `safety.${decision}`, `Food safety review ${decision === 'approve' ? 'approved' : 'not cleared'}`, `${item.name}: ${reason || (decision === 'approve' ? 'Food is cleared for circulation.' : 'Food will remain unavailable.')}`, req.params.type, item._id),
    createAudit({ actorId: req.user._id, action: `safety.${decision}`, resourceType: req.params.type, resourceId: item._id, reason: reason || '' })
  ]);
  return sendData(res, item, 200, decision === 'approve' ? 'Food cleared by authorized review.' : 'Food remains unavailable.');
}));

router.get('/admin/users', requireRoles('admin'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.accountStatus = req.query.status;
  const [items, total] = await Promise.all([User.find(filter).select('-passwordHash -tokenVersion').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(filter)]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));
router.post('/admin/users/:id/status', requireRoles('admin'), asyncHandler(async (req, res) => {
  const status = req.body?.status;
  const reason = String(req.body?.reason || '').trim().slice(0, 1000);
  if (!['approved', 'rejected', 'suspended', 'deactivated'].includes(status) || Object.keys(req.body || {}).some(k => !['status', 'reason'].includes(k))) throw new AppError(422, 'Unsupported account status update.', 'VALIDATION_ERROR');
  if (String(req.params.id) === String(req.user._id)) throw new AppError(400, 'You cannot change your own administrator account status.', 'SELF_MODIFICATION_BLOCKED');
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'User not found.', 'NOT_FOUND');
  user.accountStatus = status; user.statusReason = reason; user.tokenVersion += 1;
  await user.save();
  if (user.organizationId && ['approved', 'rejected'].includes(status)) await Organization.updateOne({ _id: user.organizationId }, { $set: { verificationStatus: status } });
  await createAudit({ actorId: req.user._id, action: 'user.status_changed', resourceType: 'user', resourceId: user._id, reason, metadata: { status, role: user.role } });
  await notifyUser(user._id, 'account.status', 'Account status updated', `Your account status is now ${status}. ${reason}`, 'user', user._id);
  return sendData(res, safeUser(user), 200, 'User status updated; prior sessions have been invalidated.');
}));
router.get('/admin/audit-logs', requireRoles('admin'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([AuditLog.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actorId', 'name role').lean(), AuditLog.countDocuments({})]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));

export default router;
