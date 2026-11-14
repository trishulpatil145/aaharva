import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition, DONATION_TRANSITIONS, ASSIGNMENT_TRANSITIONS, ORDER_TRANSITIONS,
  validateFoodEligibility, calculateDiscountPercent, isPositiveQuantity, validRequestFulfillment
} from '../src/utils/rules.js';

test('donation state machine permits only declared forward transitions', () => {
  assert.equal(canTransition(DONATION_TRANSITIONS, 'draft', 'submitted'), true);
  assert.equal(canTransition(DONATION_TRANSITIONS, 'delivered', 'completed'), false);
  assert.equal(canTransition(DONATION_TRANSITIONS, 'completed', 'available'), false);
});

test('assignment and order state machines reject terminal-state edits', () => {
  assert.equal(canTransition(ASSIGNMENT_TRANSITIONS, 'offered', 'accepted'), true);
  assert.equal(canTransition(ASSIGNMENT_TRANSITIONS, 'completed', 'in_transit'), false);
  assert.equal(canTransition(ORDER_TRANSITIONS, 'placed', 'confirmed'), true);
  assert.equal(canTransition(ORDER_TRANSITIONS, 'completed', 'cancelled'), false);
  assert.equal(canTransition(DONATION_TRANSITIONS, 'pickup_scheduled', 'failed'), true);
});

test('food eligibility requires traceable handling details and a future deadline', () => {
  const now = new Date('2026-10-13T10:00:00Z');
  const food = { name: 'Rice bowls', category: 'Prepared meals', foodType: 'vegetarian', quantity: 12, unit: 'portions', preparedAt: '2026-10-13T08:00:00Z', expiresAt: '2026-10-13T16:00:00Z', pickupDeadline: '2026-10-13T15:00:00Z', storageRequirements: 'Keep covered', allergens: 'Contains lentils', pickupAddress: 'Local kitchen', safetyStatus: 'pending_review' };
  assert.deepEqual(validateFoodEligibility(food, now), { eligible: true, problems: [] });
  const unlabeledMeal = validateFoodEligibility({ ...food, foodType: 'not_applicable' }, now);
  assert.ok(unlabeledMeal.problems.includes('Prepared meals must be labelled vegetarian or non-vegetarian.'));
  const expired = validateFoodEligibility({ ...food, expiresAt: '2026-10-13T09:00:00Z' }, now);
  assert.equal(expired.eligible, false);
  assert.ok(expired.problems.includes('The food deadline has passed.'));
  assert.equal(validateFoodEligibility({ ...food, safetyStatus: 'flagged' }, now).eligible, false);
  assert.equal(validateFoodEligibility({ ...food, pickupDeadline: '2026-10-13T09:00:00Z' }, now).eligible, false);
  assert.equal(validateFoodEligibility({ ...food, preparedAt: '2026-10-13T11:00:00Z' }, now).eligible, false);
});

test('packaged food needs original label traceability details', () => {
  const now = new Date('2026-10-13T10:00:00Z');
  const food = { name: 'Packaged snack', category: 'Packaged food', foodType: 'not_applicable', quantity: 10, unit: 'packs', preparedAt: '2026-10-13T08:00:00Z', expiresAt: '2026-10-20T16:00:00Z', pickupDeadline: '2026-10-13T15:00:00Z', storageRequirements: 'Keep sealed', allergens: 'See package', pickupAddress: 'Local kitchen', safetyStatus: 'pending_review' };
  const missing = validateFoodEligibility(food, now);
  assert.equal(missing.eligible, false);
  assert.ok(missing.problems.some(problem => problem.includes('Manufacturer name')));
  const complete = validateFoodEligibility({ ...food, manufacturerName: 'Example Foods', ingredients: 'Rice, salt', batchNumber: 'B-101', manufacturedAt: '2026-10-01T00:00:00Z', originalLabelConfirmed: true }, now);
  assert.deepEqual(complete, { eligible: true, problems: [] });
});

test('discount calculation rejects invalid pricing and rounds the percentage', () => {
  assert.equal(calculateDiscountPercent(140, 70), 50);
  assert.equal(calculateDiscountPercent(140, 75), 46);
  assert.equal(calculateDiscountPercent(0, 0), null);
  assert.equal(calculateDiscountPercent(100, 101), null);
  assert.equal(calculateDiscountPercent(100, -1), null);
});

test('purchase and school-request quantities are bounded and integer-safe', () => {
  assert.equal(isPositiveQuantity(1), true);
  assert.equal(isPositiveQuantity(0), false);
  assert.equal(isPositiveQuantity(1.5), false);
  assert.equal(validRequestFulfillment({ requestedQuantity: 100, allocatedQuantity: 70, incomingQuantity: 30 }), true);
  assert.equal(validRequestFulfillment({ requestedQuantity: 100, allocatedQuantity: 70, incomingQuantity: 31 }), false);
  assert.equal(validRequestFulfillment({ requestedQuantity: 100, allocatedQuantity: 0, incomingQuantity: 0 }), false);
});
