import { Router } from 'express';
import { authenticate, optionalAuthenticate, requireRoles } from '../middleware/auth.js';
import { FoodListing, Order, Organization, DeliveryEvent, User } from '../models/index.js';
import { listingCreateSchema, orderCreateSchema, statusSchema } from '../validators/schemas.js';
import { AppError, asyncHandler, sendData, parsePagination } from '../utils/http.js';
import { calculateDiscountPercent, ORDER_TRANSITIONS } from '../utils/rules.js';
import { createAudit, notifyUser, notifyAdmins } from '../services/system.js';

const router = Router();

router.get('/listings', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { status: 'active', safetyStatus: 'cleared', expiresAt: { $gt: new Date() }, pickupDeadline: { $gt: new Date() }, availableQuantity: { $gt: 0 } };
  if (req.query.category) filter.category = new RegExp(escapeRegex(String(req.query.category).slice(0, 80)), 'i');
  if (req.query.search) {
    const q = escapeRegex(String(req.query.search).slice(0, 80));
    filter.$or = [{ name: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }, { category: new RegExp(q, 'i') }];
  }
  if (req.query.maxPrice && Number.isFinite(Number(req.query.maxPrice))) filter.discountedPrice = { $lte: Math.max(0, Number(req.query.maxPrice)) };
  if (req.query.location) {
    const place = escapeRegex(String(req.query.location).slice(0, 100));
    const organizationIds = await Organization.find({ $or: [{ city: new RegExp(place, 'i') }, { state: new RegExp(place, 'i') }, { address: new RegExp(place, 'i') }] }).distinct('_id');
    filter.sellerOrganizationId = { $in: organizationIds };
  }
  const [items, total] = await Promise.all([FoodListing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('sellerId', 'name').lean(), FoodListing.countDocuments(filter)]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));

router.get('/my-listings', authenticate, requireRoles('restaurant', 'admin'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = req.user.role === 'admin' ? {} : { sellerId: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([FoodListing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), FoodListing.countDocuments(filter)]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));

router.get('/listings/:id', optionalAuthenticate, asyncHandler(async (req, res) => {
  const listing = await FoodListing.findById(req.params.id).populate('sellerId', 'name');
  if (!listing) throw new AppError(404, 'Food listing not found.', 'NOT_FOUND');
  const maySeeUnpublished = Boolean(req.user && ((req.user.role === 'admin' && req.user.accountStatus === 'approved') || String(listing.sellerId?._id || listing.sellerId) === String(req.user._id)));
  if (!(listing.status === 'active' && listing.safetyStatus === 'cleared' && listing.expiresAt > new Date() && listing.pickupDeadline > new Date()) && !maySeeUnpublished) throw new AppError(404, 'Food listing not found.', 'NOT_FOUND');
  return sendData(res, listing);
}));

router.post('/listings', authenticate, requireRoles('restaurant'), asyncHandler(async (req, res) => {
  const data = listingCreateSchema.parse(req.body);
  const discountPercent = calculateDiscountPercent(data.originalPrice, data.discountedPrice);
  if (discountPercent === null) throw new AppError(422, 'Prices are invalid.', 'INVALID_PRICING');
  const organization = await Organization.findById(req.user.organizationId);
  const listing = await FoodListing.create({
    ...data, sellerId: req.user._id, sellerOrganizationId: organization?._id,
    totalQuantity: data.quantity, availableQuantity: data.quantity, discountPercent,
    status: 'pending_review', safetyStatus: 'pending_review'
  });
  await notifyAdmins('safety.review_required', 'Food listing needs safety review', `${listing.name} was submitted for marketplace review.`, 'listing', listing._id);
  await createAudit({ actorId: req.user._id, action: 'listing.created', resourceType: 'listing', resourceId: listing._id });
  return sendData(res, listing, 201, 'Listing created and queued for safety review.');
}));

router.get('/orders', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.accountStatus !== 'approved') throw new AppError(403, 'Your account must be approved before viewing order operations.', 'ACCOUNT_NOT_APPROVED');
  const { page, limit, skip } = parsePagination(req.query);
  const filter = req.user.role === 'admin' ? {} : req.user.role === 'restaurant' ? { sellerId: req.user._id } : { buyerId: req.user._id };
  const [items, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('listingId', 'name category unit pickupAddress expiresAt').populate('buyerId', 'name').populate('sellerId', 'name').lean(), Order.countDocuments(filter)]);
  return sendData(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
}));

router.post('/orders', authenticate, requireRoles('buyer'), asyncHandler(async (req, res) => {
  const data = orderCreateSchema.parse(req.body);
  const existing = await Order.findOne({ buyerId: req.user._id, idempotencyKey: data.idempotencyKey });
  if (existing) return sendData(res, existing, 200, 'Returning the existing order for this request key.');

  const reservation = await FoodListing.findOneAndUpdate(
    { _id: data.listingId, status: 'active', safetyStatus: 'cleared', expiresAt: { $gt: new Date() }, pickupDeadline: { $gt: new Date() }, availableQuantity: { $gte: data.quantity } },
    { $inc: { availableQuantity: -data.quantity } }, { new: true, runValidators: true }
  );
  if (!reservation) throw new AppError(409, 'This listing is unavailable, expired, unsafe, or has insufficient quantity.', 'STOCK_UNAVAILABLE');
  if (data.paymentMethod === 'pay_on_delivery' && !reservation.fulfillmentOptions.includes('delivery')) {
    await restoreReservedStock(reservation._id, data.quantity);
    throw new AppError(422, 'Delivery is not offered for this listing.', 'DELIVERY_UNAVAILABLE');
  }

  let order;
  try {
    order = await Order.create({ buyerId: req.user._id, listingId: reservation._id, sellerId: reservation.sellerId, quantity: data.quantity, unitPrice: reservation.discountedPrice, totalAmount: roundMoney(reservation.discountedPrice * data.quantity), paymentMethod: data.paymentMethod, idempotencyKey: data.idempotencyKey });
  } catch (err) {
    await restoreReservedStock(reservation._id, data.quantity);
    if (err?.code === 11000) {
      const concurrentExisting = await Order.findOne({ buyerId: req.user._id, idempotencyKey: data.idempotencyKey });
      if (concurrentExisting) return sendData(res, concurrentExisting, 200, 'Returning the existing order for this request key.');
    }
    throw err;
  }

  if (reservation.availableQuantity === 0) await FoodListing.updateOne({ _id: reservation._id, availableQuantity: 0 }, { $set: { status: 'sold_out' } });
  await DeliveryEvent.create({ resourceType: 'order', relatedResourceId: order._id, actorId: req.user._id, status: 'placed', notes: 'Order placed; payment is due on collection or delivery.' }).catch(() => {});
  await Promise.allSettled([
    notifyUser(order.sellerId, 'order.created', 'New surplus food order', `An order for ${order.quantity} × ${reservation.name} was placed.`, 'order', order._id),
    createAudit({ actorId: req.user._id, action: 'order.created', resourceType: 'order', resourceId: order._id, metadata: { quantity: order.quantity } })
  ]);
  return sendData(res, order, 201, 'Order placed. Aaharva does not process online payments; pay on pickup or delivery.');
}));

router.post('/orders/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  if (req.user.accountStatus !== 'approved') throw new AppError(403, 'Your account must be approved before modifying an order.', 'ACCOUNT_NOT_APPROVED');
  const order = await Order.findOneAndUpdate({ _id: req.params.id, buyerId: req.user._id, status: { $in: ['placed', 'confirmed'] } }, { $set: { status: 'cancelled' } }, { new: true });
  if (!order) throw new AppError(409, 'This order cannot be cancelled. Only placed or confirmed orders can be cancelled by the buyer.', 'ORDER_NOT_CANCELLABLE');
  await restoreReservedStock(order.listingId, order.quantity);
  await DeliveryEvent.create({ resourceType: 'order', relatedResourceId: order._id, actorId: req.user._id, status: 'cancelled', notes: 'Cancelled by buyer.' });
  await Promise.allSettled([
    notifyUser(order.sellerId, 'order.cancelled', 'Order cancelled', 'A buyer cancelled an order.', 'order', order._id),
    createAudit({ actorId: req.user._id, action: 'order.cancelled', resourceType: 'order', resourceId: order._id })
  ]);
  return sendData(res, order, 200, 'Order cancelled and reserved quantity returned.');
}));

router.post('/orders/:id/status', authenticate, requireRoles('restaurant'), asyncHandler(async (req, res) => {
  const { status, notes } = statusSchema.parse(req.body);
  if (!['confirmed', 'preparing', 'ready', 'completed', 'rejected', 'cancelled'].includes(status)) throw new AppError(422, 'Unsupported order status.', 'INVALID_STATUS');
  const current = await Order.findOne({ _id: req.params.id, sellerId: req.user._id });
  if (!current) throw new AppError(404, 'Order not found for this seller.', 'NOT_FOUND');
  if (!ORDER_TRANSITIONS[current.status]?.includes(status)) throw new AppError(409, `Cannot change order from ${current.status} to ${status}.`, 'INVALID_STATUS_TRANSITION');
  if (['confirmed', 'preparing', 'ready', 'completed'].includes(status)) {
    const listing = await FoodListing.findById(current.listingId).select('safetyStatus expiresAt');
    if (!listing || listing.safetyStatus !== 'cleared' || listing.expiresAt <= new Date()) throw new AppError(409, 'This order cannot progress because the related food is expired or held for safety review.', 'FOOD_UNAVAILABLE');
  }
  const order = await Order.findOneAndUpdate({ _id: current._id, sellerId: req.user._id, status: current.status }, { $set: { status } }, { new: true, runValidators: true });
  if (!order) throw new AppError(409, 'Order status changed concurrently. Refresh and try again.', 'ORDER_STATUS_CONFLICT');
  if (['rejected', 'cancelled'].includes(status)) await restoreReservedStock(order.listingId, order.quantity);
  await DeliveryEvent.create({ resourceType: 'order', relatedResourceId: order._id, actorId: req.user._id, status, notes: notes || '' });
  await Promise.allSettled([
    notifyUser(order.buyerId, 'order.status', 'Order updated', `Your order status is now ${status}.`, 'order', order._id),
    createAudit({ actorId: req.user._id, action: 'order.status_changed', resourceType: 'order', resourceId: order._id, metadata: { status } })
  ]);
  return sendData(res, order, 200, 'Order status updated.');
}));

async function restoreReservedStock(listingId, quantity) {
  const listing = await FoodListing.findById(listingId).select('totalQuantity expiresAt safetyStatus');
  if (!listing) return;
  const canSell = listing.expiresAt > new Date() && listing.safetyStatus === 'cleared';
  const newStatus = canSell ? 'active' : (listing.expiresAt <= new Date() ? 'expired' : 'paused');
  // The $expr guard makes compensation atomic and prevents restoring more than the original stock.
  await FoodListing.updateOne({
    _id: listingId,
    $expr: { $lte: [{ $add: ['$availableQuantity', quantity] }, '$totalQuantity'] }
  }, { $inc: { availableQuantity: quantity }, $set: { status: newStatus } });
}
function roundMoney(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export default router;
