import { z } from 'zod';

const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const password = z.string().min(10).max(128).refine(v => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), 'Use at least 10 characters with lowercase, uppercase, and a number.');
const trimmed = (max = 200) => z.string().trim().min(1).max(max);
const optionalText = (max = 500) => z.string().trim().max(max).optional().default('');
const dateString = z.coerce.date();

export const registerSchema = z.object({
  name: trimmed(100), email, password, role: z.enum(['restaurant', 'ngo', 'rescue_partner', 'school', 'buyer']), phone: optionalText(30),
  organization: z.object({
    name: trimmed(180), registrationNumber: optionalText(100), address: trimmed(400), city: trimmed(100), state: trimmed(100), postalCode: optionalText(12)
  }).optional()
}).superRefine((data, ctx) => {
  const orgRoles = ['restaurant', 'ngo', 'rescue_partner', 'school'];
  if (orgRoles.includes(data.role) && !data.organization) ctx.addIssue({ code: 'custom', path: ['organization'], message: 'Organization details are required for this account type.' });
  if (data.role === 'buyer' && data.organization) ctx.addIssue({ code: 'custom', path: ['organization'], message: 'Buyer accounts do not register an organization.' });
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const profileSchema = z.object({ name: trimmed(100), phone: optionalText(30) }).strict();
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).strict();
const foodBaseSchema = z.object({
  name: trimmed(160), category: trimmed(80), foodType: z.enum(['vegetarian', 'non_vegetarian', 'not_applicable']), description: optionalText(2000), quantity: z.coerce.number().positive().finite(), unit: trimmed(30),
  manufacturerName: optionalText(200), ingredients: optionalText(2000), batchNumber: optionalText(100),
  manufacturedAt: z.preprocess(value => value === '' || value == null ? undefined : value, z.coerce.date().optional()),
  originalLabelConfirmed: z.boolean().optional().default(false),
  preparedAt: dateString, expiresAt: dateString, storageRequirements: trimmed(500), allergens: trimmed(500), pickupAddress: trimmed(400), pickupDeadline: dateString
}).strict();
function refineFoodDates(data, ctx) {
  if (data.expiresAt <= new Date()) ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'The safe-use deadline must be in the future.' });
  if (data.pickupDeadline <= new Date()) ctx.addIssue({ code: 'custom', path: ['pickupDeadline'], message: 'The collection deadline must be in the future.' });
  if (data.pickupDeadline > data.expiresAt) ctx.addIssue({ code: 'custom', path: ['pickupDeadline'], message: 'Collection must be scheduled no later than the safe-use deadline.' });
  if (data.preparedAt > new Date()) ctx.addIssue({ code: 'custom', path: ['preparedAt'], message: 'Preparation time cannot be in the future.' });
  if (String(data.category).toLowerCase() === 'prepared meals' && !['vegetarian', 'non_vegetarian'].includes(data.foodType)) ctx.addIssue({ code: 'custom', path: ['foodType'], message: 'Prepared meals must be labelled vegetarian or non-vegetarian.' });
  if (String(data.category).toLowerCase() === 'packaged food') {
    for (const key of ['manufacturerName', 'ingredients', 'batchNumber']) {
      if (!data[key]?.trim()) ctx.addIssue({ code: 'custom', path: [key], message: 'Original package label details are required for packaged food.' });
    }
    if (!data.manufacturedAt || Number.isNaN(new Date(data.manufacturedAt).getTime())) ctx.addIssue({ code: 'custom', path: ['manufacturedAt'], message: 'Manufacturing date is required for packaged food.' });
    else if (data.manufacturedAt > new Date()) ctx.addIssue({ code: 'custom', path: ['manufacturedAt'], message: 'Manufacturing date cannot be in the future.' });
    if (!data.originalLabelConfirmed) ctx.addIssue({ code: 'custom', path: ['originalLabelConfirmed'], message: 'Confirm the original package label remains intact and readable.' });
  }
  if (data.manufacturedAt && data.manufacturedAt > data.expiresAt) ctx.addIssue({ code: 'custom', path: ['manufacturedAt'], message: 'Manufacturing date cannot be after the safe-use deadline.' });
}
export const foodSchema = foodBaseSchema.superRefine(refineFoodDates);
export const listingCreateSchema = foodBaseSchema.extend({
  originalPrice: z.coerce.number().positive().finite(), discountedPrice: z.coerce.number().nonnegative().finite(), quantity: z.coerce.number().int().positive(),
  fulfillmentOptions: z.array(z.enum(['pickup', 'delivery'])).min(1).default(['pickup'])
}).strict().superRefine((data, ctx) => {
  refineFoodDates(data, ctx);
  if (data.discountedPrice > data.originalPrice) ctx.addIssue({ code: 'custom', path: ['discountedPrice'], message: 'Discounted price cannot exceed original price.' });
});
export const orderCreateSchema = z.object({ listingId: z.string().regex(/^[a-f\d]{24}$/i), quantity: z.coerce.number().int().min(1).max(1000), paymentMethod: z.enum(['pay_on_pickup', 'pay_on_delivery']), idempotencyKey: z.string().min(12).max(120) }).strict();
export const schoolRequestSchema = z.object({
  title: trimmed(160), description: optionalText(2000), categories: z.array(trimmed(80)).min(1).max(12),
  requestedQuantity: z.coerce.number().int().positive().max(100000), unit: trimmed(30), beneficiaryCount: z.coerce.number().int().nonnegative().optional(),
  dietaryRequirements: optionalText(1000), requestedFor: dateString, collectionWindow: optionalText(250)
}).strict().superRefine((data, ctx) => { if (data.requestedFor < new Date()) ctx.addIssue({ code: 'custom', path: ['requestedFor'], message: 'Requested date must not be in the past.' }); });
export const complaintSchema = z.object({ category: z.enum(['food_quality', 'delivery', 'order', 'organization', 'platform', 'other']), description: z.string().trim().min(10).max(3000), resourceType: z.enum(['donation', 'listing', 'order', 'school_request', 'delivery', 'organization', 'other']).default('other'), resourceId: z.string().regex(/^[a-f\d]{24}$/i).optional() }).strict();
export const incidentSchema = z.object({ relatedType: z.enum(['donation', 'listing', 'order', 'organization', 'delivery']), relatedId: z.string().regex(/^[a-f\d]{24}$/i), severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'), description: z.string().trim().min(10).max(3000) }).strict();
export const decisionSchema = z.object({ decision: z.enum(['approve', 'reject']), reason: optionalText(1000) }).strict();
export const statusSchema = z.object({ status: trimmed(80), notes: optionalText(1000) }).strict();
export const assignmentCreateSchema = z.object({ notes: optionalText(1000) }).strict();
