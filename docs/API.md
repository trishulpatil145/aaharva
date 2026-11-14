# API reference

Base path: `/api`. Success responses use `{ "success": true, "message"?: string, "data": ... }`. Error responses use `{ "success": false, "error": { "code": string, "message": string, "details"?: unknown } }`. Authenticated browser requests use the `HttpOnly` session cookie; a bearer token is also accepted. Lists generally accept `page` (default 1) and `limit` (default 12, max 100), with optional endpoint-specific filters.

**Important:** This reference documents routes currently present in `server/src/routes`. It does not imply that live API/database behavior was verified; see `TEST_REPORT.md`.

## Health and root

| Method | Path | Access | Behavior |
|---|---|---|---|
| GET | `/api/health` | Public | Actual API and Mongoose connection state; returns 200 when connected, 503 otherwise. |
| GET | `/api` | Public | API name/version and docs pointer. |

## Authentication — `/api/auth`

| Method | Path | Access | Payload / result |
|---|---|---|---|
| POST | `/register` | Public; roles restaurant, ngo, rescue_partner, school, buyer only | `{name,email,password,role,phone?,organization?}`. Organization fields: `name`, `address`, `city`, `state`, optional `registrationNumber`, `postalCode`. Sets session cookie. Organization accounts are pending; buyers are approved. |
| POST | `/login` | Public, rate-limited | `{email,password}`; sets session cookie. Invalid credentials return 401. |
| POST | `/logout` | Public | Clears session cookie. |
| GET | `/me` | Authenticated | Current safe user and organization. |
| PATCH | `/profile` | Authenticated | `{name,phone}`. |
| POST | `/change-password` | Authenticated | `{currentPassword,newPassword}`. Invalidates old sessions and clears current cookie. |

Public registration cannot create an admin. Password schema requires 10+ characters, lowercase, uppercase and a digit.

## Organizations — `/api/organizations`

| Method | Path | Access | Behavior |
|---|---|---|---|
| GET | `/me` | Authenticated | Current owner's organization and latest verification. |
| GET | `/` | Admin | Paginated organization listing; optional `status=pending\|approved\|rejected`. |
| POST | `/:id/decision` | Admin | `{decision:"approve"|"reject",reason?}`; updates organization and owner status, records verification and audit decision, notifies owner. |

## Donations — `/api/donations`

| Method | Path | Access | Behavior |
|---|---|---|---|
| GET | `/` | Authenticated | Role-scoped, paginated donation list. Optional `status`, `category`, `search`. |
| POST | `/` | Approved restaurant | Creates a draft from food fields including name/category/foodType/description/quantity/unit/preparedAt/expiresAt/storageRequirements/allergens/pickupAddress/pickupDeadline. For `Packaged food`, `manufacturerName`, `ingredients`, `batchNumber`, `manufacturedAt`, and `originalLabelConfirmed: true` are required. |
| GET | `/:id` | Authenticated with resource visibility | Donation detail and delivery events. |
| PATCH | `/:id` | Owning restaurant; draft/flagged only | Replaces editable food details and returns it to draft/pending review. |
| POST | `/:id/submit` | Approved restaurant owner | Validates safety information and submits for admin review. |
| POST | `/:id/accept` | Approved NGO | Accepts an eligible, safety-cleared available donation. |
| POST | `/:id/status` | Authorized donor/recipient/admin according to route rules | `{status,notes?}`; applies valid donation transitions and records history. |
| POST | `/:id/assignments` | Authorized user according to route rules | Creates a rescue assignment for an eligible accepted donation, including destination information. |

Food deadlines and required storage/allergen data are validated server-side. Admin safety decisions are under `/api/admin/safety/:type/:id/decision`.

## Marketplace and orders — `/api`

| Method | Path | Access | Behavior |
|---|---|---|---|
| GET | `/listings` | Public | Paginated eligible active listings; optional category, search, maximum-price and city/state/address location filters. |
| GET | `/my-listings` | Restaurant/admin | Seller's listings. |
| GET | `/listings/:id` | Public plus optional session | Public can see active safe listings; owner/admin can view their unpublished listing. |
| POST | `/listings` | Approved restaurant | Creates listing with food fields (including `foodType`), `originalPrice`, `discountedPrice`, `fulfillmentOptions`. For `Packaged food`, original-label traceability fields are required. Listing enters safety review; discount is calculated server-side. |
| GET | `/orders` | Authenticated | Buyer sees own orders; restaurant sees incoming orders; admin sees all, with pagination. |
| POST | `/orders` | Buyer | `{listingId,quantity,paymentMethod,idempotencyKey}`. Methods: `pay_on_pickup`, `pay_on_delivery`. Reserves available inventory and creates order. |
| POST | `/orders/:id/cancel` | Buyer who owns order | Cancels only eligible statuses and restores reserved stock with a guard. |
| POST | `/orders/:id/status` | Listing's owning restaurant | `{status,notes?}`; validates order status transition, notifies buyer and writes event/audit. |

No online payment processor is present. A listing must be cleared, active and within its safe-use deadline to be ordered.

## School support — `/api/school-requests`

| Method | Path | Access | Behavior |
|---|---|---|---|
| GET | `/` | Authenticated | Role-scoped request list with pagination/status filters. |
| POST | `/` | Approved school | Creates a supplementary food-support request. Fields: title/description/categories/requestedQuantity/unit/beneficiaryCount?/dietaryRequirements?/requestedFor/collectionWindow?. |
| GET | `/:id` | Authorized user | Request details and contributions/receipts where permitted. |
| POST | `/:id/decision` | Admin | `{decision:"approve"|"reject",reason?}`; records decision and notifies school. |
| POST | `/:id/fulfill` | Approved restaurant/NGO or admin | `{quantity,donationId,note?}`; allocates an entire eligible donation. Conditional update prevents allocation beyond the request amount. |
| POST | `/:id/receipt` | School owning request | `{quantity,notes?}`; quantity cannot exceed allocated or requested quantity. Full fulfillment occurs only when the requested quantity has been received. |

Current implementation requires integer quantities and whole-donation allocations. Contributions from multiple donors are supported; a single donation cannot be split across requests/partial amounts.

## Rescue, notifications, complaints, incidents and administration — `/api`

| Method | Path | Access | Behavior |
|---|---|---|---|
| GET | `/assignments` | Admin, assigned/eligible rescue partner, related restaurant/recipient organization | Paginated assignment list; optional status. |
| GET | `/assignments/:id/events` | Admin or related user/partner | Persistent delivery timeline. |
| POST | `/assignments/:id/accept` | Approved rescue partner | Atomically claims an offered unassigned job. |
| POST | `/assignments/:id/decline` | Approved rescue partner | Optional `{notes}`; records this partner's decline without closing the offer for other partners. The declined offer is hidden from that partner's assignment list. |
| POST | `/assignments/:id/status` | Assigned rescue partner/admin | `{status,notes?}`; enforces valid assignment and linked donation transitions and creates delivery/audit events. |
| GET | `/notifications` | Authenticated | Recipient-only, paginated list; optional `unread=true`; includes unread count. |
| POST | `/notifications/:id/read` | Notification recipient | Marks one notification read. |
| POST | `/notifications/read-all` | Authenticated | Marks current user's unread notifications read. |
| GET | `/complaints` | Authenticated | Users see their own complaints; admin sees all. Optional status. |
| POST | `/complaints` | Authenticated | `{category,description,resourceType?,resourceId?}`; notifies admins and writes audit event. |
| POST | `/complaints/:id/status` | Admin | `{status,notes?}`; status `open`, `investigating`, `resolved`, `dismissed`. |
| GET | `/incidents` | Authenticated | Users see their own safety incidents; admin sees all. Optional status. |
| POST | `/incidents` | Authenticated | `{relatedType,relatedId,severity?,description}`; validates referenced resource and raises an admin alert; related donation/listing is held for review where applicable. |
| POST | `/incidents/:id/status` | Admin | `{status,notes?}`; status `reviewing`, `investigating`, `corrective_action`, `resolved`, `dismissed`. |
| GET | `/admin/analytics` | Admin | Counts/aggregations from the database; verified rescued quantity excludes demo donations. |
| GET | `/admin/safety-queue` | Admin | Pending/flagged donations and listings. |
| POST | `/admin/safety/:type/:id/decision` | Admin | `type` donation/listing; `{decision:"approve"|"reject",reason?}`. |
| GET | `/admin/users` | Admin | Paginated users; optional role/status filter; omits password hash/token version. |
| POST | `/admin/users/:id/status` | Admin | `{status,reason?}`; status approved/rejected/suspended/deactivated; invalidates the user's existing sessions. |
| GET | `/admin/audit-logs` | Admin | Paginated read-only audit events. |

## Common status codes

- `200`: successful read/update.
- `201`: created.
- `400`: malformed operation or invalid current state.
- `401`: missing/expired/invalid session.
- `403`: role, approval or ownership restriction.
- `404`: missing resource.
- `409`: conflicting state, unavailable inventory or invalid transition.
- `422`: validated payload or food/request eligibility issue.
- `429`: rate limit exceeded.
- `500`: unexpected server failure; response avoids stack traces and secrets.
- `503`: health endpoint when MongoDB is not connected.

Zod validation failures currently return a safe validation error through centralized error middleware, with field details where available. This document should be amended when new routes are implemented.
