# State machines

These are the states and transitions encoded in the current route/business-rule implementation. Transitions are validated server-side; changes to the lists should be accompanied by tests and migration/operational review.

## Donations

Allowed transitions in `DONATION_TRANSITIONS`:

- `draft` → `submitted`, `cancelled`
- `submitted` → `available`, `flagged`, `cancelled`
- `available` → `accepted`, `flagged`, `cancelled`
- `accepted` → `pickup_scheduled`, `flagged`, `cancelled`
- `pickup_scheduled` → `picked_up`, `flagged`, `cancelled`
- `picked_up` → `in_transit`, `flagged`
- `in_transit` → `delivered`, `failed`, `flagged`
- `delivered` → `receipt_confirmed`, `failed`, `flagged`
- `receipt_confirmed` → `completed`, `flagged`
- `flagged` → `submitted`, `cancelled`
- `completed`, `cancelled`, `failed` are terminal.

Operational notes: restaurants create drafts and submit them for review. Admin safety clearance moves submitted donations to available. An approved NGO may accept an eligible donation. A rescue partner can accept an offered assignment; assignment status updates also update the linked donation for pickup/in-transit/delivery steps where a valid linked donation transition exists. Safety-flagged or expired donations cannot be accepted.

## Marketplace orders

Allowed transitions in `ORDER_TRANSITIONS`:

- `placed` → `confirmed`, `rejected`, `cancelled`
- `confirmed` → `preparing`, `cancelled`
- `preparing` → `ready`, `cancelled`
- `ready` → `completed`
- `completed`, `cancelled`, `rejected` are terminal.

Order creation conditionally reserves inventory first. Cancellation/rejection restores inventory only through a guarded update; restoration cannot increase inventory above listing `totalQuantity`. Idempotency key uniqueness is scoped to buyer. Live concurrency/failure-window behavior remains to be integration-tested with MongoDB.

## Rescue assignments

Allowed transitions in `ASSIGNMENT_TRANSITIONS`:

- `offered` → `accepted`, `declined`, `cancelled`
- `accepted` → `pickup_scheduled`, `cancelled`
- `pickup_scheduled` → `picked_up`, `failed`
- `picked_up` → `in_transit`, `failed`
- `in_transit` → `delivered`, `failed`
- `delivered` → `completed`
- `declined`, `cancelled`, `failed`, `completed` are terminal.

Only the assigned rescue partner or admin can update assignment status. An assignment acceptance is an atomic conditional claim of an offered unassigned job. A partner declining an offer writes a decline event for that actor while keeping the offer open for other partners. Each status update attempts to write persistent `DeliveryEvent` and audit records.

## School requests

School request statuses represented by the model include `submitted`, `approved`, `rejected`, `partially_fulfilled`, `awaiting_receipt`, `fulfilled`, and `cancelled`.

- School submits → `submitted`.
- Admin decision → `approved` or `rejected`.
- Donation contribution increments `allocatedQuantity` only if the new total stays at or below `requestedQuantity`.
- If all requested units have been allocated but not yet received, status becomes `awaiting_receipt`.
- Partial allocation/receipt stays open as `partially_fulfilled` or `approved`, depending on the current quantities.
- Receipt updates are bounded by both `allocatedQuantity` and `requestedQuantity`.
- Only when `receivedQuantity >= requestedQuantity` does the route set `fulfilled`.

Current request contributions allocate whole donation quantities, and the form/API expects whole-number requested amounts. Advanced partial splitting of a single donation is not implemented.

## Food safety review

Safety status uses `pending_review`, `cleared`, `flagged`. A donation/listing is not available to customers/recipients until authorized admin clearance and other eligibility conditions pass. Reporting an incident puts associated donations on `flagged` and listings on `paused` where implemented. Admin approval resets the safety status only if the required food information and future deadline validate; rejection keeps the item unavailable. Incident resolution does **not** automatically clear the linked food item: separate authorized review is required.

## Complaints and safety incidents

Complaints use `open`, `investigating`, `resolved`, `dismissed`; admin sets status and resolution notes. Safety incidents use `submitted`, `reviewing`, `investigating`, `corrective_action`, `resolved`, `dismissed`; admin sets review notes, actor and time. Incident status alone does not imply the food item is cleared.

## Notifications and audit logs

Notifications are per-user, with unread defined as missing `readAt`. The API only permits recipients to mark their own notifications read. Audit logs are written by backend services with actor/action/resource/reason/metadata and immutable creation time; no user-facing edit/delete API is exposed.
