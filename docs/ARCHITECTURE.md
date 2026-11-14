# Architecture

## High-level structure

```text
React/Vite browser client
  ├── React Router pages and protected layouts
  ├── AuthContext (current-user state; no browser token persistence)
  └── Central Axios API client (`VITE_API_BASE_URL`, credentials included)
              │ HTTP/JSON + HttpOnly session cookie
              ▼
Express REST API (`/api`)
  ├── Helmet, constrained CORS, parsers, origin guard, NoSQL sanitization
  ├── login/registration rate limiting
  ├── JWT authentication and role/account-status authorization
  ├── Zod request validation and centralized errors
  ├── route/business rules, notifications and audit services
  ▼
Mongoose models and MongoDB
```

## Repository layout

- `client/src/api/`: centralized HTTP client.
- `client/src/contexts/`: current authenticated user.
- `client/src/components/`, `layouts/`, `pages/`, `styles/`: shared UI, navigation, role-aware pages and styles.
- `server/src/config/`: environment and database management.
- `server/src/middleware/`: authentication, security and error responses.
- `server/src/models/`: persistent MongoDB models and indexes.
- `server/src/routes/`: REST endpoint implementations.
- `server/src/services/system.js`: persistent in-app notifications and append-only audit writes.
- `server/src/utils/rules.js`: pure eligibility, pricing and allowed-status transition rules.
- `server/src/validators/`: server-side Zod schemas.
- `server/scripts/seed.js`: idempotent demonstration-data upserts.

## Data entities

- `User`: email, password hash, role, account status, optional organization, token version.
- `Organization`: owner, type, registration/address fields, verification state.
- `Verification`: submitted/reviewed organization verification record.
- `FoodDonation`: donor, optional recipient, quantity/unit, preparation/deadline/storage/allergens, safety and workflow states.
- `FoodListing`: seller, food/safety fields, original and discounted INR prices, total/available quantities and listing state.
- `Order`: buyer, listing, seller, quantity, selected in-person payment method, status, idempotency key.
- `SchoolRequest`: school, requested/allocated/received quantities, contribution and receipt-event arrays, status/decision.
- `RescueAssignment`: donation, assigning user, rescue partner, pickup/destination, status and optional last-known coordinates.
- `DeliveryEvent`: append-style timeline events for a donation/assignment/order/request.
- `Notification`: recipient, message, resource reference and read timestamp.
- `Complaint`: reporter, category, resource reference, review status and resolution.
- `SafetyIncident`: reporter, related resource, severity, investigation/corrective-action fields.
- `AuditLog`: actor, action, resource, reason, metadata and immutable creation time. The API exposes read-only audit access; there is no audit edit/delete endpoint.

## Authentication and permissions

The server creates signed JWTs and sends them as `HttpOnly; SameSite=Strict` cookies; cookies are `Secure` in production. Bearer tokens are accepted for API clients, but the browser app relies on cookies. The JWT stores a subject and token version. Each protected request reloads the user record and checks account status and token version. The database role is authoritative, not a client-provided role claim.

Roles: `restaurant`, `ngo`, `rescue_partner`, `school`, `buyer`, `admin`. Public sign-up excludes `admin`. Organization-backed roles begin pending. A buyer may be approved immediately; protected operational middleware blocks unapproved organization roles. Admin account changes/password changes increment a token version to invalidate earlier sessions.

## Main business safeguards

- **Donations:** owner-only edit before operational acceptance, eligible food submission, authorized safety review, atomic NGO acceptance, rescue assignment and server-enforced state transitions.
- **Safety:** required handling/deadline/allergen fields, expired-food rejection, flag/hold state, admin decision history and incident escalation. Application checks are not legal certification.
- **Marketplace:** public reads limited to available, cleared, non-expired stock; seller-owned creation and processing; order idempotency; conditional stock decrement; guarded compensating restoration after failure/cancellation/rejection.
- **School assistance:** request and allocation quantities are checked against requested quantity using conditional updates; school receipt cannot exceed either allocation or request; full fulfillment requires receipt of the full requested quantity.
- **Operations:** every delivery status change adds an event and audit record; notifications are scoped to the recipient.
- **Admin:** analytics use MongoDB queries/aggregations. Rescued quantity excludes demo records. Seeded accounts/records are marked demo where supported.

## Stock consistency note

Order placement first performs an atomic conditional decrement on `availableQuantity`, then creates an order. On creation failure, compensation is attempted with a conditional increment that will not exceed `totalQuantity`. This avoids overselling under ordinary concurrent decrements, but without multi-document transactions a process failure between steps may require reconciliation. Use a replica-set MongoDB deployment and add transaction-backed integration verification before production use.

## External services and omitted capabilities

No payment processor, email/SMS gateway, push-notification service, live GPS, WebSocket server or separate native app is integrated. Notifications use authenticated bounded polling. Map/chart dependencies are available but location coordinates/routes are not fabricated.

## Current verification state

Source syntax and pure utility/business-rule tests were checked. Dependency install was blocked by the npm registry DNS failure. MongoDB availability was not found, so full server startup, live persistence, API integration, browser behavior and transaction/concurrency testing remain unverified. See `TEST_REPORT.md`.
