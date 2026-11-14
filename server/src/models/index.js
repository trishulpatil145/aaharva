import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);
const { Schema, model, models } = mongoose;
const options = { timestamps: true, versionKey: false, strict: 'throw' };
const ref = (name, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required });
const modelOf = (name, schema) => models[name] || model(name, schema);

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, maxlength: 254, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: ['restaurant', 'ngo', 'rescue_partner', 'school', 'buyer', 'admin'], index: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  organizationId: ref('Organization', false),
  accountStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended', 'deactivated'], default: 'pending', index: true },
  statusReason: { type: String, maxlength: 1000, default: '' },
  tokenVersion: { type: Number, default: 0, min: 0 },
  isDemo: { type: Boolean, default: false }
}, options);
userSchema.index({ role: 1, accountStatus: 1 });
export const User = modelOf('User', userSchema);

const organizationSchema = new Schema({
  ownerId: ref('User'),
  name: { type: String, required: true, trim: true, maxlength: 180 },
  type: { type: String, required: true, enum: ['restaurant', 'ngo', 'rescue_partner', 'school'] },
  registrationNumber: { type: String, trim: true, maxlength: 100, default: '' },
  address: { type: String, required: true, trim: true, maxlength: 400 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  postalCode: { type: String, trim: true, maxlength: 12, default: '' },
  coordinates: { lat: { type: Number, min: -90, max: 90 }, lng: { type: Number, min: -180, max: 180 } },
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  isDemo: { type: Boolean, default: false }
}, options);
organizationSchema.index({ type: 1, verificationStatus: 1 });
export const Organization = modelOf('Organization', organizationSchema);

const verificationSchema = new Schema({
  userId: ref('User'), organizationId: ref('Organization'),
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  submittedAt: { type: Date, default: Date.now }, reviewedAt: Date,
  reviewedBy: ref('User', false), reason: { type: String, maxlength: 1000, default: '' },
  isDemo: { type: Boolean, default: false }
}, options);
verificationSchema.index({ organizationId: 1, submittedAt: -1 });
export const Verification = modelOf('Verification', verificationSchema);

const foodFields = {
  name: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  foodType: { type: String, required: true, enum: ['vegetarian', 'non_vegetarian', 'not_applicable'] },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  manufacturerName: { type: String, trim: true, maxlength: 200, default: '' },
  ingredients: { type: String, trim: true, maxlength: 2000, default: '' },
  batchNumber: { type: String, trim: true, maxlength: 100, default: '' },
  manufacturedAt: { type: Date },
  originalLabelConfirmed: { type: Boolean, default: false },
  quantity: { type: Number, required: true, min: 0.001 },
  unit: { type: String, required: true, trim: true, maxlength: 30 },
  preparedAt: { type: Date, required: true }, expiresAt: { type: Date, required: true, index: true },
  storageRequirements: { type: String, required: true, trim: true, maxlength: 500 },
  allergens: { type: String, required: true, trim: true, maxlength: 500 },
  pickupAddress: { type: String, required: true, trim: true, maxlength: 400 },
  pickupDeadline: { type: Date, required: true },
  safetyStatus: { type: String, enum: ['pending_review', 'cleared', 'flagged'], default: 'pending_review', index: true },
  safetyReviewReason: { type: String, maxlength: 1000, default: '' },
  safetyReviewedBy: ref('User', false), safetyReviewedAt: Date,
  isDemo: { type: Boolean, default: false }
};

const donationSchema = new Schema({
  ...foodFields,
  donorId: ref('User'), donorOrganizationId: ref('Organization', false),
  recipientOrganizationId: ref('Organization', false), acceptedBy: ref('User', false),
  status: { type: String, enum: ['draft', 'submitted', 'available', 'accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 'delivered', 'receipt_confirmed', 'completed', 'cancelled', 'failed', 'flagged'], default: 'draft', index: true }
}, options);
donationSchema.index({ status: 1, safetyStatus: 1, expiresAt: 1, category: 1 });
donationSchema.index({ donorId: 1, createdAt: -1 });
export const FoodDonation = modelOf('FoodDonation', donationSchema);

const listingSchema = new Schema({
  ...foodFields,
  sellerId: ref('User'), sellerOrganizationId: ref('Organization', false),
  originalPrice: { type: Number, required: true, min: 0.01 }, discountedPrice: { type: Number, required: true, min: 0 },
  discountPercent: { type: Number, required: true, min: 0, max: 100 },
  totalQuantity: { type: Number, required: true, min: 1 }, availableQuantity: { type: Number, required: true, min: 0 },
  fulfillmentOptions: { type: [String], enum: ['pickup', 'delivery'], default: ['pickup'] },
  status: { type: String, enum: ['draft', 'pending_review', 'active', 'sold_out', 'paused', 'expired', 'rejected'], default: 'draft', index: true },
  isDemo: { type: Boolean, default: false }
}, options);
listingSchema.index({ status: 1, safetyStatus: 1, category: 1, discountedPrice: 1, expiresAt: 1 });
listingSchema.index({ sellerId: 1, createdAt: -1 });
export const FoodListing = modelOf('FoodListing', listingSchema);

const orderSchema = new Schema({
  buyerId: ref('User'), listingId: ref('FoodListing'), sellerId: ref('User'),
  quantity: { type: Number, required: true, min: 1 }, unitPrice: { type: Number, required: true, min: 0 }, totalAmount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['pay_on_pickup', 'pay_on_delivery'], required: true },
  status: { type: String, enum: ['placed', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled', 'rejected'], default: 'placed', index: true },
  idempotencyKey: { type: String, maxlength: 120, default: undefined },
  isDemo: { type: Boolean, default: false }
}, options);
orderSchema.index({ buyerId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
orderSchema.index({ sellerId: 1, createdAt: -1 });
export const Order = modelOf('Order', orderSchema);

const contributionSchema = new Schema({
  contributorId: ref('User'), donationId: ref('FoodDonation', false),
  quantity: { type: Number, required: true, min: 1 }, receivedQuantity: { type: Number, default: 0, min: 0 },
  note: { type: String, maxlength: 600, default: '' }, createdAt: { type: Date, default: Date.now }
}, { _id: true, strict: 'throw' });
const receiptSchema = new Schema({ actorId: ref('User'), quantity: { type: Number, required: true, min: 1 }, notes: { type: String, maxlength: 600, default: '' }, createdAt: { type: Date, default: Date.now } }, { _id: true });
const schoolRequestSchema = new Schema({
  schoolOrganizationId: ref('Organization'), createdBy: ref('User'),
  title: { type: String, required: true, trim: true, maxlength: 160 }, description: { type: String, trim: true, maxlength: 2000, default: '' },
  categories: { type: [String], validate: v => v.length > 0 },
  requestedQuantity: { type: Number, required: true, min: 1 }, allocatedQuantity: { type: Number, default: 0, min: 0 }, receivedQuantity: { type: Number, default: 0, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 30 }, beneficiaryCount: { type: Number, min: 0 },
  dietaryRequirements: { type: String, maxlength: 1000, default: '' }, requestedFor: { type: Date, required: true },
  collectionWindow: { type: String, maxlength: 250, default: '' }, status: { type: String, enum: ['submitted', 'approved', 'rejected', 'partially_fulfilled', 'awaiting_receipt', 'fulfilled', 'cancelled'], default: 'submitted', index: true },
  decisionReason: { type: String, maxlength: 1000, default: '' }, decidedBy: ref('User', false),
  contributions: { type: [contributionSchema], default: [] }, receiptEvents: { type: [receiptSchema], default: [] },
  isDemo: { type: Boolean, default: false }
}, options);
schoolRequestSchema.index({ schoolOrganizationId: 1, createdAt: -1 });
export const SchoolRequest = modelOf('SchoolRequest', schoolRequestSchema);

const assignmentSchema = new Schema({
  donationId: ref('FoodDonation'), assignedBy: ref('User'), rescuePartnerId: ref('User', false),
  pickupAddress: { type: String, required: true, maxlength: 400 }, destinationAddress: { type: String, required: true, maxlength: 400 },
  status: { type: String, enum: ['offered', 'accepted', 'declined', 'pickup_scheduled', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled', 'failed'], default: 'offered', index: true },
  notes: { type: String, maxlength: 1000, default: '' }, lastKnownCoordinates: { lat: { type: Number, min: -90, max: 90 }, lng: { type: Number, min: -180, max: 180 } },
  isDemo: { type: Boolean, default: false }
}, options);
assignmentSchema.index({ rescuePartnerId: 1, status: 1, createdAt: -1 });
assignmentSchema.index({ donationId: 1, status: 1 });
assignmentSchema.index({ donationId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['offered', 'accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 'delivered'] } } });
export const RescueAssignment = modelOf('RescueAssignment', assignmentSchema);

const deliveryEventSchema = new Schema({
  resourceType: { type: String, enum: ['donation', 'assignment', 'order', 'school_request'], required: true },
  resourceId: ref('FoodDonation', false), relatedResourceId: { type: Schema.Types.ObjectId },
  actorId: ref('User'), status: { type: String, required: true, maxlength: 80 },
  notes: { type: String, maxlength: 1000, default: '' },
  coordinates: { lat: { type: Number, min: -90, max: 90 }, lng: { type: Number, min: -180, max: 180 } },
  proofImageUrl: { type: String, maxlength: 1000, default: '' }, isDemo: { type: Boolean, default: false }
}, options);
deliveryEventSchema.index({ resourceType: 1, resourceId: 1, createdAt: 1 });
export const DeliveryEvent = modelOf('DeliveryEvent', deliveryEventSchema);

const notificationSchema = new Schema({
  recipientId: ref('User'), type: { type: String, required: true, maxlength: 80 }, title: { type: String, required: true, maxlength: 180 },
  message: { type: String, required: true, maxlength: 1000 }, resourceType: { type: String, maxlength: 80, default: '' },
  resourceId: { type: Schema.Types.ObjectId }, readAt: Date, isDemo: { type: Boolean, default: false }
}, options);
notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
export const Notification = modelOf('Notification', notificationSchema);

const complaintSchema = new Schema({
  reporterId: ref('User'), category: { type: String, required: true, enum: ['food_quality', 'delivery', 'order', 'organization', 'platform', 'other'] },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
  resourceType: { type: String, enum: ['donation', 'listing', 'order', 'school_request', 'delivery', 'organization', 'other'], default: 'other' },
  resourceId: { type: Schema.Types.ObjectId }, status: { type: String, enum: ['open', 'investigating', 'resolved', 'dismissed'], default: 'open', index: true },
  assignedTo: ref('User', false), resolutionNotes: { type: String, maxlength: 1500, default: '' }, resolvedAt: Date, isDemo: { type: Boolean, default: false }
}, options);
complaintSchema.index({ reporterId: 1, createdAt: -1 });
export const Complaint = modelOf('Complaint', complaintSchema);

const incidentSchema = new Schema({
  reporterId: ref('User'), relatedType: { type: String, enum: ['donation', 'listing', 'order', 'organization', 'delivery'], required: true },
  relatedId: { type: Schema.Types.ObjectId, required: true }, severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true },
  description: { type: String, required: true, minlength: 10, maxlength: 3000 },
  status: { type: String, enum: ['submitted', 'reviewing', 'investigating', 'corrective_action', 'resolved', 'dismissed'], default: 'submitted', index: true },
  reviewNotes: { type: String, maxlength: 2000, default: '' }, reviewedBy: ref('User', false), reviewedAt: Date, correctiveAction: { type: String, maxlength: 1500, default: '' }, isDemo: { type: Boolean, default: false }
}, options);
incidentSchema.index({ createdAt: -1, status: 1 });
export const SafetyIncident = modelOf('SafetyIncident', incidentSchema);

const auditLogSchema = new Schema({
  actorId: ref('User', false), action: { type: String, required: true, maxlength: 100 },
  resourceType: { type: String, required: true, maxlength: 100 }, resourceId: { type: Schema.Types.ObjectId },
  reason: { type: String, maxlength: 1500, default: '' }, metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, immutable: true }, isDemo: { type: Boolean, default: false }
}, { versionKey: false, strict: 'throw', timestamps: false });
auditLogSchema.index({ createdAt: -1, actorId: 1 });
export const AuditLog = modelOf('AuditLog', auditLogSchema);
