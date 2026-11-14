export const ROLES = Object.freeze(['restaurant', 'ngo', 'rescue_partner', 'school', 'buyer', 'admin']);

export const DONATION_TRANSITIONS = Object.freeze({
  draft: ['submitted', 'cancelled'],
  submitted: ['available', 'flagged', 'cancelled'],
  available: ['accepted', 'flagged', 'cancelled'],
  accepted: ['pickup_scheduled', 'flagged', 'cancelled'],
  pickup_scheduled: ['picked_up', 'failed', 'flagged', 'cancelled'],
  picked_up: ['in_transit', 'flagged'],
  in_transit: ['delivered', 'failed', 'flagged'],
  delivered: ['receipt_confirmed', 'failed', 'flagged'],
  receipt_confirmed: ['completed', 'flagged'],
  completed: [], cancelled: [], failed: [], flagged: ['submitted', 'cancelled']
});

export const ORDER_TRANSITIONS = Object.freeze({
  placed: ['confirmed', 'rejected', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['completed'], completed: [], cancelled: [], rejected: []
});

export const ASSIGNMENT_TRANSITIONS = Object.freeze({
  offered: ['accepted', 'declined', 'cancelled'],
  accepted: ['pickup_scheduled', 'cancelled'],
  pickup_scheduled: ['picked_up', 'failed'],
  picked_up: ['in_transit', 'failed'],
  in_transit: ['delivered', 'failed'],
  delivered: ['completed'], declined: [], cancelled: [], failed: [], completed: []
});

export function canTransition(map, from, to) {
  return Boolean(map[from]?.includes(to));
}

export function validateFoodEligibility(food, now = new Date()) {
  const problems = [];
  if (!food?.name?.trim()) problems.push('Food name is required.');
  if (!food?.category?.trim()) problems.push('Food category is required.');
  if (!['vegetarian', 'non_vegetarian', 'not_applicable'].includes(food?.foodType)) problems.push('Food type (vegetarian, non-vegetarian, or not applicable) must be recorded.');
  if (String(food?.category || '').toLowerCase() === 'prepared meals' && !['vegetarian', 'non_vegetarian'].includes(food?.foodType)) problems.push('Prepared meals must be labelled vegetarian or non-vegetarian.');
  if (String(food?.category || '').toLowerCase() === 'packaged food') {
    for (const [key, label] of [['manufacturerName', 'Manufacturer name'], ['ingredients', 'Ingredient list'], ['batchNumber', 'Batch number']]) {
      if (!food?.[key]?.trim()) problems.push(`${label} is required for packaged food.`);
    }
    if (!food?.manufacturedAt || Number.isNaN(new Date(food.manufacturedAt).getTime())) problems.push('A valid manufacturing date is required for packaged food.');
    else if (new Date(food.manufacturedAt) > now) problems.push('Manufacturing date cannot be in the future.');
    if (food?.originalLabelConfirmed !== true) problems.push('Confirm the original package label remains intact and readable.');
  }
  if (food?.manufacturedAt && food?.expiresAt && !Number.isNaN(new Date(food.manufacturedAt).getTime()) && !Number.isNaN(new Date(food.expiresAt).getTime()) && new Date(food.manufacturedAt) > new Date(food.expiresAt)) problems.push('Manufacturing date cannot be after the safe-use deadline.');
  if (!Number.isFinite(Number(food?.quantity)) || Number(food.quantity) <= 0) problems.push('Quantity must be greater than zero.');
  if (!food?.unit?.trim()) problems.push('Quantity unit is required.');
  if (!food?.preparedAt || Number.isNaN(new Date(food.preparedAt).getTime())) problems.push('A valid preparation or packing time is required.');
  else if (new Date(food.preparedAt) > now) problems.push('Preparation or packing time cannot be in the future.');
  if (!food?.expiresAt || Number.isNaN(new Date(food.expiresAt).getTime())) problems.push('A valid applicable safe-use deadline is required.');
  else if (new Date(food.expiresAt) <= now) problems.push('The food deadline has passed.');
  if (!food?.pickupDeadline || Number.isNaN(new Date(food.pickupDeadline).getTime())) problems.push('A valid collection deadline is required.');
  else if (new Date(food.pickupDeadline) <= now) problems.push('The collection deadline has passed.');
  else if (food?.expiresAt && !Number.isNaN(new Date(food.expiresAt).getTime()) && new Date(food.pickupDeadline) > new Date(food.expiresAt)) problems.push('Collection must be no later than the safe-use deadline.');
  if (!food?.storageRequirements?.trim()) problems.push('Storage requirements must be specified.');
  if (!food?.allergens?.trim()) problems.push('Allergen information must be specified; use “none declared” where appropriate.');
  if (!food?.pickupAddress?.trim()) problems.push('Pickup address is required.');
  if (food?.safetyStatus === 'flagged') problems.push('Food flagged for safety review cannot be circulated.');
  return { eligible: problems.length === 0, problems };
}

export function calculateDiscountPercent(originalPrice, discountedPrice) {
  const original = Number(originalPrice);
  const discounted = Number(discountedPrice);
  if (!Number.isFinite(original) || !Number.isFinite(discounted) || original <= 0 || discounted < 0 || discounted > original) return null;
  return Math.round(((original - discounted) / original) * 100);
}

export function isPositiveQuantity(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

export function validRequestFulfillment({ requestedQuantity, allocatedQuantity, incomingQuantity }) {
  const requested = Number(requestedQuantity);
  const allocated = Number(allocatedQuantity);
  const incoming = Number(incomingQuantity);
  return Number.isSafeInteger(requested) && Number.isSafeInteger(allocated) && Number.isSafeInteger(incoming)
    && requested > 0 && allocated >= 0 && incoming > 0 && allocated + incoming <= requested;
}
