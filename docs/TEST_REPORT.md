# Test report

**Report date:** 2026-10-13

## Environment blockers

- `npm view express version` failed with `EAI_AGAIN registry.npmjs.org` (DNS/network failure). Frontend and backend dependencies were not installed.
- No local `mongod`/`mongosh` binary or running MongoDB process was present in the inspected environment. No working database URI was available to verify.
- `npm run build` was attempted and failed with `vite: not found`; `npm run dev` was attempted and failed with `concurrently: not found`; `npm --prefix server start` was attempted and failed because `express` is not installed. These follow from blocked dependency installation.
- No local `mongod`/`mongosh` binary or running MongoDB process was present, and no working database URI was available. Real MongoDB connection/persistence, API integration tests, concurrent database ordering, and browser workflows were therefore not run. This report does not claim those criteria pass.

## Commands executed and results

| Command/check | Result | Notes |
|---|---|---|
| `npm test` (root) | **PASS** | Ran `node --test` in server and client packages. |
| `npm --prefix server test` | **PASS — 6 tests** | State transitions, food eligibility including packaged-food label traceability, discount calculation, and bounded quantities/fulfillment helpers. |
| `npm --prefix client test` | **PASS — 4 tests** | Status formatting, invalid date handling, INR formatting and `datetime-local` conversion. |
| Node syntax parse (`node --check`) across backend JS files | **PASS** | All `server/src`, `server/scripts`, and backend test JavaScript files were syntax-checked during implementation. |
| TypeScript source parser across client JS/JSX/config files | **PASS at syntax/parser level** | 22 files parsed with zero syntax diagnostics and no unresolved relative imports. This is not equivalent to a Vite build or external dependency resolution. |
| npm registry access / dependency install | **BLOCKED** | Registry lookup failed with DNS `EAI_AGAIN`; dependencies could not be fetched. |
| `npm run build` | **BLOCKED** | `vite: not found` because client dependencies are not installed. |
| `npm run dev` | **BLOCKED** | `concurrently: not found` because root dependencies are not installed. |
| `npm --prefix server start` | **BLOCKED** | `ERR_MODULE_NOT_FOUND: express` because server dependencies are not installed. |
| MongoDB connection/persistence | **NOT RUN / BLOCKED** | No MongoDB server or known configured URI. |
| `/api/health` against live backend | **NOT RUN** | Server could not load without Express/Mongoose dependencies. Endpoint is written to return 503 when Mongoose is disconnected. |
| React browser flows and responsive widths | **NOT RUN** | No running Vite app/test dependencies/browser harness. |
| Database-backed order concurrency / duplicate-order test | **NOT RUN** | Only pure rule tests ran; they do not establish stock concurrency correctness. |

## Pure logic tests currently included

Backend `server/tests/rules.test.js`:

1. Declared donation state transitions and terminal states.
2. Assignment/order terminal state transitions.
3. Required food handling details and future safe-use deadline.
4. Discount validation and percentage rounding.
5. Positive/integer-safe order/request quantity bounds.

Frontend `client/tests/format.test.js`:

1. Readable labels from snake-case states.
2. Absent and invalid date display.
3. INR currency formatting.
4. Local `datetime-local` input generation including invalid input fallback.

## Next verification checklist

Run once package registry access and MongoDB are available:

1. `npm install && npm --prefix server install && npm --prefix client install`.
2. `npm run build` and resolve any Vite/import/build errors.
3. Start an isolated MongoDB test database (not a production or personal database), implement/run Supertest API integration tests, and verify `/api/health` reports connected.
4. Verify registration, invalid credentials, auth expiry, pending organization access, role/ownership denial, safety-review decisions, donation acceptance, delivery transitions and notifications.
5. Test concurrent purchases against limited inventory and simulate failure/compensation. Consider replica-set-backed transaction handling for production.
6. Test school request allocations from multiple donors and receipts under concurrency.
7. Seed a development database, rerun the seed command to check idempotence, restart the server and verify persistence.
8. Browser-test primary workflows at 360px, 768px and 1280px, inspect console/network failures and run accessibility checks.

## Summary

The available evidence supports passing pure domain/format tests and source-level syntax parsing. The repository is **not yet verified end-to-end**. Database connectivity, application build, integration/security workflows and production suitability must not be marked complete until the blocked checks are run.
