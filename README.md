# Aaharva

**Rescue Food. Reduce Waste. Nourish Lives.**

Aaharva is a responsive food rescue and redistribution web application for India. It connects food businesses, NGOs, rescue partners, government schools and buyers through donation, discounted surplus-food, delivery, school-support and safety-review workflows.

> **Implementation status:** This repository contains the React/Vite frontend, Express/Mongoose backend, MongoDB models, role-protected APIs, seed script, documentation and dependency-free unit tests. In the build environment used to create this repository, npm registry access failed with a DNS `EAI_AGAIN` error and no MongoDB server was available. Dependencies could not be installed, so the Vite production build, live API workflows, database persistence and browser rendering are **not verified here**. Read `docs/TEST_REPORT.md` before treating this as production-ready.

## Implemented areas

- Cookie-based JWT sessions, password hashing, registration, profile/password management, role and account-status checks.
- Pending verification workflows for restaurant, NGO, rescue partner and school organizations; public registration cannot create admins.
- Food donation drafts, submission for safety review, authorized review, NGO acceptance and rescue assignments.
- Discounted surplus listings, orders using `pay_on_pickup` / `pay_on_delivery`, idempotency keys, conditional stock reservation and compensating stock restoration.
- Supplementary school-food requests, capped allocations from multiple donations, and receipt confirmations.
- Delivery event timelines, recipient-isolated in-app notifications, complaints, safety incidents, admin oversight and append-only audit records.
- Database-backed admin analytics, paginated lists, safety gates and responsive React pages.

Online payments, continuous GPS tracking, WebSockets, external email/SMS/push delivery, and separate Android/iOS apps are intentionally out of scope. This version does **not** process online payments. Food-safety thresholds and policy details that require expert/regulatory review are not asserted as legal rules.

## Technology

- **Frontend:** React 18, Vite, React Router, Axios, Recharts and Leaflet dependencies; JavaScript and CSS.
- **Backend:** Node.js, Express 5, Mongoose, MongoDB, JWT, bcryptjs, Zod, Helmet, CORS, cookie-parser and express-rate-limit.
- **Tests:** Node's built-in test runner for dependency-free domain/format tests. API, browser, database integration and concurrency coverage remain to be run in an environment with dependencies and MongoDB.

## Prerequisites

- Node.js 20+ recommended (project was syntax-checked using Node.js 22).
- npm.
- MongoDB 7-compatible deployment, either a local server or an externally hosted MongoDB URI. The application does not require Docker.
- Network access to the npm registry for first-time dependency installation.

## Installation

From the project root:

```bash
npm install
npm --prefix server install
npm --prefix client install
```

The root package runs frontend/backend together with `concurrently`; install the root package to supply that runner. If registry access is blocked, resolve network/proxy/DNS access before installing dependencies.

## Configuration

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`.

Example `server/.env` development settings:

```dotenv
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/aaharva
MONGODB_DB_NAME=aaharva
JWT_SECRET=replace_with_a_long_random_secret_of_at_least_32_characters
JWT_EXPIRES_IN=1h
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=10
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=ChangeThis_Admin_Secret_123
SEED_DEMO_PASSWORD=ChangeThis_Demo_Secret_123
```

Use unique secrets. Do not commit `.env` files or reuse sample credentials in production. Production startup requires a `JWT_SECRET` with at least 32 characters. The app uses `HttpOnly`, `SameSite=Strict` cookies (and `Secure` in production); configure HTTPS and allowed origins before deployment. `EXTRA_ALLOWED_ORIGINS` can contain comma-separated additional allowed web origins.

Example `client/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
```

`VITE_*` values are public to browser code. Never put server credentials there.

## MongoDB setup

1. Install and start MongoDB Community Server locally, or create an external MongoDB deployment.
2. Set `MONGODB_URI` to the connection string and `MONGODB_DB_NAME` to the intended database.
3. Ensure the database user has access only to the application database.
4. Verify `GET http://localhost:5000/api/health` reports `data.database.connected: true` and HTTP 200 after starting the backend.

The API server can start after an initial connection failure so that health status remains observable; data-backed requests will fail while the database is unavailable and `/api/health` returns HTTP 503. The health endpoint does not fake a successful connection. Production disables automatic index creation, so run `npm run db:indexes` after configuring the database and before accepting traffic (use a database role permitted to create indexes).

## Seed demonstration data

Set the seed environment variables in `server/.env`, then run:

```bash
npm run db:indexes
npm run seed
```

The administrator email and password are supplied by environment variables. The administrator password must be at least 16 characters and contain lowercase, uppercase and a digit. The demo password must be at least 12 characters and contain lowercase, uppercase and a digit. Demo accounts use these predictable addresses:

- `restaurant@aaharva.example`
- `ngo@aaharva.example`
- `rescue@aaharva.example`
- `school@aaharva.example`
- `buyer@aaharva.example`

All demo accounts share `SEED_DEMO_PASSWORD`. The seed script marks sample records as demonstration data and upserts by stable identifying fields. `*.example` addresses are reserved demonstration addresses, not delivery-capable email addresses. Do not use seed data to report real platform impact.

## Run the application

Both services, from the root:

```bash
npm run dev
```

Backend only:

```bash
npm run dev:server
# or
npm --prefix server run dev
```

Frontend only:

```bash
npm run dev:client
# or
npm --prefix client run dev
```

Frontend address: `http://localhost:5173`  
Backend address: `http://localhost:5000`

Production frontend build:

```bash
npm run build
```

Backend production start:

```bash
npm start
```

## Tests

```bash
npm test
npm run test:server
npm run test:client
```

The repository's current Node-native tests cover state-machine rules, food eligibility checks, discount calculations, integer-safe quantity checks, status formatting, INR formatting and date inputs. They do not require the app dependencies. The API integration, MongoDB persistence, full concurrency, browser and Vite build checks need installed dependencies and a running test database; see `docs/TEST_REPORT.md`.

## Main routes

- `/` — landing page
- `/login`, `/register` — authentication
- `/browse` — public active surplus listings
- `/dashboard` — role-aware overview
- `/donations` — donation workflows
- `/marketplace`, `/orders` — listings and orders
- `/requests` — supplementary school requests
- `/deliveries` — rescue assignments and timelines
- `/notifications`, `/complaints`, `/profile` — account operations
- `/admin` — administrator operations

## Security and safety notes

- Registration does not allow an `admin` role.
- Cookies are `HttpOnly`; server checks authoritative account role/status on every authenticated request.
- Password changes and administrative account decisions increment token version to invalidate prior sessions.
- Server-side validation, safe error envelopes, rate limiting, Helmet, constrained CORS and resource access checks are applied.
- Order creation uses a database conditional stock decrement and an idempotency key. On later persistence failure, a guarded stock-compensation step is attempted. A replica set with transaction support is preferable for production; end-to-end failure/concurrency behavior has **not** been verified in this environment.
- Suspected food-safety incidents place related food listings/donations on hold where implemented; that is a precautionary review state, not a public finding that a person or organization did something wrong.
- The food eligibility checks are application guardrails, not a substitute for approved food-safety operating procedures or expert FSSAI regulatory review. Numeric time/temperature thresholds are not invented.
- A school request represents supplementary food support and is not a replacement for a government school meal program.
- No online payment gateway is enabled; the payment method is recorded for in-person collection/payment.

## Food-safety and regulatory reference

Donation and marketplace submissions capture food type. When `Packaged food` is selected, the form also requires manufacturer name, ingredient list, batch number, manufacturing date, and confirmation that the original label remains intact and readable. These guardrails are informed by the official [FSSAI Food Safety and Standards (Recovery and Distribution of Surplus Food) Regulations, 2019](https://www.fssai.gov.in/upload/uploadfiles/files/Gazette_Notification_Surplus_Food_06_08_2019.pdf), including label, handling and recordkeeping provisions. Aaharva is **not certified for regulatory compliance**. Operators must validate licensing, physical labels, packaging, hygiene, storage/transport controls and current procedures with qualified food-safety personnel. No universal safety time/temperature threshold is asserted as law.

## Known limitations

- Runtime dependency installation and Vite build were blocked during repository creation by npm registry DNS failure.
- No local MongoDB binaries/process or known working database URI were available; real database connectivity and persistence were not verified.
- Browser screenshots/responsive behavior, real API integration, database transaction behavior and concurrent purchase integration tests have not been run.
- Map and chart packages are declared, but all screens do not yet expose dedicated visualizations; location matching is currently text/filter based, and there is no live GPS or ETA.
- Some advanced workflows (such as partial portions of a single donation to a school request) are deliberately limited: current school contributions allocate a whole donation and use whole-number request quantities.

See `docs/` for architecture, API, state transitions, UI inventory, assumptions and test evidence.
