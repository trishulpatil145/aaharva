# UI inventory

The pages below exist in `client/src/pages` and are wired into React Router. Because React packages could not be installed in the build environment, rendering, navigation in a browser, and interactive end-to-end actions are **not browser-verified**. Route/API mappings describe intended/current wiring, not a claim that live requests succeeded.

| UI route | Page/component | Primary role(s) | Main actions and API connections |
|---|---|---|---|
| `/` | `LandingPage.jsx` | Public | Aaharva value proposition and navigation to browse/register/login. |
| `/login`, `/register` | `AuthPage.jsx` | Public | Login/register through `POST /auth/login`, `POST /auth/register`; session state from `AuthContext`. |
| `/browse` | `MarketplacePage.jsx` public mode | Public | Browse eligible listings via `GET /listings` and view details. |
| `/dashboard` | `DashboardPage.jsx` | Authenticated roles | Role-specific overview, lists/metrics based on application/API data. Admin metrics use `/admin/analytics`. |
| `/donations` | `DonationsPage.jsx` | Restaurant, NGO, admin | Create/edit/submit, discover/accept eligible donations, status workflow via `/donations`. |
| `/marketplace` | `MarketplacePage.jsx` | Restaurant, buyer, admin | Create seller listings and browse eligible surplus food using `/listings` and `/my-listings`. |
| `/orders` | `OrdersPage.jsx` | Buyer, restaurant, admin | Order history and seller order processing using `/orders` endpoints. |
| `/requests` | `RequestsPage.jsx` | School, restaurant, NGO, admin | School food-support requests, admin decisions, whole-donation contributions and school receipt confirmations via `/school-requests`. |
| `/deliveries` | `DeliveriesPage.jsx` | Rescue partner and related roles | Assignment list, accept/decline offered assignments, status updates, timeline events through `/assignments`. |
| `/notifications` | `NotificationsPage.jsx` | Authenticated | Recipient-only notification list/read operations through `/notifications`. |
| `/complaints` | `ComplaintsPage.jsx` | Authenticated, admin | Submit and review complaints; report safety incident and admin review using `/complaints` and `/incidents`. |
| `/admin` | `AdminPage.jsx` (admin route guard) | Admin | Verification, users, safety queue, incidents/complaints, audit logs and analytics using admin endpoints. |
| `/profile` | `ProfilePage.jsx` | Authenticated | Update profile/password; `/auth/profile`, `/auth/change-password`. |

## Shared UI behavior

- `AppLayout.jsx` contains authenticated application navigation and bounded notification polling with effect cleanup.
- `RequireAuth.jsx` redirects unauthenticated users; admin view is guarded by role on the client as a usability measure. The server remains authoritative.
- `Ui.jsx` includes shared forms/buttons/status UI.
- `styles/index.css` contains the responsive visual system and smaller-screen layout rules.
- `utils/format.js` formats INR, dates, status labels and local datetime inputs.
- `api/client.js` centralizes API requests, JSON/error normalization and credentials.

## Responsive/accessibility status

CSS includes responsive breakpoints and semantic form components, labels/status messaging, keyboard focus styling and mobile-friendly layouts. Actual rendered widths of 360px, 768px and 1280px, automated accessibility checks, browser console and failed network requests were not examined because frontend packages/browser test harness could not be installed/run. Mark these as pending verification.


## Food traceability fields

Donation and marketplace forms ask for food type. Selecting Packaged food reveals required manufacturer, ingredient list, batch number, manufacturing date, and confirmation that the original package label remains intact and readable. Server-side validation enforces these details; the UI input is not proof that the food is safe or legally compliant.
