import bcrypt from 'bcryptjs';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { User, Organization, Verification, FoodDonation, FoodListing, SchoolRequest, RescueAssignment, Notification, Order } from '../src/models/index.js';

function requiredPassword(name, value, min = 12) {
  if (!value || value.length < min || !/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    throw new Error(`${name} must be at least ${min} characters and include lowercase, uppercase, and a number.`);
  }
  return value;
}

async function upsertUser({ name, email, passwordHash, role, isDemo = false }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (existing && existing.role !== role) throw new Error(`Seed refused to change existing account role for ${normalizedEmail}. Verify that SEED_ADMIN_EMAIL is not already registered to another role.`);
  const user = await User.findOneAndUpdate({ email: normalizedEmail }, { $set: { name, passwordHash, role, accountStatus: 'approved', statusReason: '', isDemo }, $setOnInsert: { tokenVersion: 0 } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  return user;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = requiredPassword('SEED_ADMIN_PASSWORD', process.env.SEED_ADMIN_PASSWORD, 16);
  const demoPassword = requiredPassword('SEED_DEMO_PASSWORD', process.env.SEED_DEMO_PASSWORD, 12);
  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error('Set SEED_ADMIN_EMAIL to a valid email address before seeding.');
  await connectDatabase();
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const demoHash = await bcrypt.hash(demoPassword, 12);
  const admin = await upsertUser({ name: 'Aaharva Administrator', email: adminEmail, passwordHash: adminHash, role: 'admin' });
  const demos = {};
  for (const [role, name, email] of [
    ['restaurant', 'Green Bowl Kitchen', 'restaurant@aaharva.example'],
    ['ngo', 'Community Nourish Collective', 'ngo@aaharva.example'],
    ['rescue_partner', 'Aaharva Rescue Partner', 'rescue@aaharva.example'],
    ['school', 'Government School Food Desk', 'school@aaharva.example'],
    ['buyer', 'Aaharva Buyer', 'buyer@aaharva.example']
  ]) demos[role] = await upsertUser({ name, email, passwordHash: demoHash, role, isDemo: true });

  const orgValues = {
    restaurant: { name: 'Green Bowl Kitchen', registrationNumber: 'DEMO-REST-001', address: '12 Residency Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560025' },
    ngo: { name: 'Community Nourish Collective', registrationNumber: 'DEMO-NGO-001', address: '8 Jayanagar 4th Block', city: 'Bengaluru', state: 'Karnataka', postalCode: '560011' },
    rescue_partner: { name: 'Aaharva Rescue Partner Network', registrationNumber: 'DEMO-RESCUE-001', address: '5 Indiranagar Main Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038' },
    school: { name: 'Government School Food Desk (Demo)', registrationNumber: 'DEMO-SCHOOL-001', address: '24 Basavanagudi', city: 'Bengaluru', state: 'Karnataka', postalCode: '560004' }
  };
  const orgs = {};
  for (const role of Object.keys(orgValues)) {
    orgs[role] = await Organization.findOneAndUpdate({ ownerId: demos[role]._id }, { $set: { ...orgValues[role], type: role, verificationStatus: 'approved', isDemo: true }, $setOnInsert: { ownerId: demos[role]._id } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    await User.updateOne({ _id: demos[role]._id }, { $set: { organizationId: orgs[role]._id, accountStatus: 'approved' } });
    await Verification.findOneAndUpdate({ organizationId: orgs[role]._id }, { $set: { userId: demos[role]._id, status: 'approved', reviewedBy: admin._id, reviewedAt: new Date(), reason: 'Demonstration account — seeded development data.', isDemo: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }

  const now = new Date();
  const preparedAt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const expiresAt = new Date(now.getTime() + 18 * 60 * 60 * 1000);
  const pickupDeadline = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const acceptedDonation = await FoodDonation.findOneAndUpdate(
    { donorId: demos.restaurant._id, name: 'Rice and lentil lunch packs — demo' },
    { $set: { name: 'Rice and lentil lunch packs — demo', category: 'Prepared meals', foodType: 'vegetarian', description: 'Demonstration donation. Confirm handling details before collection.', quantity: 40, unit: 'meals', preparedAt, expiresAt, storageRequirements: 'Keep covered; follow the stated safe handling requirements.', allergens: 'Contains lentils; review ingredient details at handover.', pickupAddress: orgValues.restaurant.address + ', Bengaluru', pickupDeadline, donorId: demos.restaurant._id, donorOrganizationId: orgs.restaurant._id, recipientOrganizationId: orgs.ngo._id, acceptedBy: demos.ngo._id, status: 'accepted', safetyStatus: 'cleared', safetyReviewReason: 'Seeded demonstration item; review is illustrative only.', safetyReviewedBy: admin._id, safetyReviewedAt: now, isDemo: true } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await FoodDonation.findOneAndUpdate(
    { donorId: demos.restaurant._id, name: 'Vegetable khichdi trays — demo' },
    { $set: { name: 'Vegetable khichdi trays — demo', category: 'Prepared meals', foodType: 'vegetarian', description: 'Seeded sample donation for exploring the workflow.', quantity: 24, unit: 'portions', preparedAt, expiresAt, storageRequirements: 'Transport in suitable food-safe containers.', allergens: 'Allergen declaration requires handover confirmation.', pickupAddress: orgValues.restaurant.address + ', Bengaluru', pickupDeadline, donorId: demos.restaurant._id, donorOrganizationId: orgs.restaurant._id, status: 'available', safetyStatus: 'cleared', safetyReviewReason: 'Seeded demonstration item; review is illustrative only.', safetyReviewedBy: admin._id, safetyReviewedAt: now, isDemo: true } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  const listing = await FoodListing.findOneAndUpdate(
    { sellerId: demos.restaurant._id, name: 'Seasonal vegetable bowl — demo' },
    { $set: { name: 'Seasonal vegetable bowl — demo', category: 'Prepared meals', foodType: 'vegetarian', description: 'Demonstration listing only. Payment is collected on pickup or delivery.', quantity: 30, unit: 'bowls', preparedAt, expiresAt, storageRequirements: 'Transport covered; follow the food-specific handling instructions.', allergens: 'Check garnish and dressing ingredients before serving.', pickupAddress: orgValues.restaurant.address + ', Bengaluru', pickupDeadline, originalPrice: 140, discountedPrice: 75, discountPercent: 46, totalQuantity: 30, availableQuantity: 28, fulfillmentOptions: ['pickup', 'delivery'], sellerId: demos.restaurant._id, sellerOrganizationId: orgs.restaurant._id, status: 'active', safetyStatus: 'cleared', safetyReviewReason: 'Seeded demonstration item; review is illustrative only.', safetyReviewedBy: admin._id, safetyReviewedAt: now, isDemo: true } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await Order.findOneAndUpdate(
    { buyerId: demos.buyer._id, idempotencyKey: 'aaharva-demo-order-0001' },
    { $set: { buyerId: demos.buyer._id, listingId: listing._id, sellerId: demos.restaurant._id, quantity: 2, unitPrice: 75, totalAmount: 150, paymentMethod: 'pay_on_pickup', status: 'confirmed', idempotencyKey: 'aaharva-demo-order-0001', isDemo: true } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  const schoolRequest = await SchoolRequest.findOneAndUpdate(
    { schoolOrganizationId: orgs.school._id, title: 'Supplementary breakfast support — demo' },
    { $set: { schoolOrganizationId: orgs.school._id, createdBy: demos.school._id, title: 'Supplementary breakfast support — demo', description: 'Example request for demonstrating supplementary food assistance coordination.', categories: ['Prepared meals', 'Fruit'], requestedQuantity: 80, allocatedQuantity: 0, receivedQuantity: 0, unit: 'portions', beneficiaryCount: 75, dietaryRequirements: 'Confirm allergies and dietary suitability with the school contact before delivery.', requestedFor: new Date(now.getTime() + 48 * 60 * 60 * 1000), collectionWindow: '10:00–12:00 (confirm before dispatch)', status: 'approved', decidedBy: admin._id, decisionReason: 'Seeded demonstration request.', isDemo: true } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await RescueAssignment.findOneAndUpdate(
    { donationId: acceptedDonation._id, status: { $in: ['offered', 'accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 'delivered'] } },
    { $set: { donationId: acceptedDonation._id, assignedBy: demos.restaurant._id, rescuePartnerId: null, pickupAddress: acceptedDonation.pickupAddress, destinationAddress: orgValues.ngo.address + ', Bengaluru', status: 'offered', notes: 'Seeded demonstration assignment.', isDemo: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await Notification.findOneAndUpdate(
    { recipientId: demos.restaurant._id, title: 'Welcome to Aaharva — demo' },
    { $set: { recipientId: demos.restaurant._id, type: 'welcome', title: 'Welcome to Aaharva — demo', message: 'This notification is seeded demonstration data. You can explore donation and marketplace workflows.', isDemo: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.info('[aaharva] Seed data is ready.');
  console.info('[aaharva] Development demo accounts use the configured SEED_DEMO_PASSWORD; see README for email addresses.');
  console.info(`[aaharva] Administrator email configured: ${admin.email}`);
  console.info('[aaharva] All demonstration organizations, food, orders, and requests are marked as demo data.');
}

main().catch(err => {
  console.error(`[aaharva] Seed failed: ${err.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await closeDatabase().catch(() => {});
});
