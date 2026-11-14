# Assumptions and implementation decisions

## Environment findings

- New project created at `/mnt/data/aaharva`; no Aaharva repository was present in the inspected workspace. Existing unrelated work was not overwritten.
- Node.js 22 and npm were present.
- npm registry access failed with DNS `EAI_AGAIN registry.npmjs.org`; dependencies could not be downloaded.
- No local `mongod`/`mongosh` binary or running MongoDB process was found. No working database URI was supplied in the environment.
- No Docker, containers or Docker commands are required by the implementation.

## Technical decisions

- Cookie JWT session is the browser authentication strategy. HttpOnly and SameSite=Strict reduce script access and cross-site request exposure. Production uses Secure cookies and requires a strong JWT secret. Allowed origins are configured through environment variables.
- The React app uses a centralized Axios API client. No localStorage is used for authentication/session tokens.
- MongoDB is the intended persistent source of truth; no in-memory record store or mock API fallback has been added. Production has automatic Mongoose index builds disabled; `npm run db:indexes` must run with a suitably privileged database account before traffic is accepted.
- The API server can start after a failed initial MongoDB connection so `/api/health` can accurately return `503` and report database status. Data-backed requests are not expected to work until MongoDB connects.
- Marketplace orders use `Idempotency-Key`/request `idempotencyKey` and atomic conditional inventory decrement, with guarded compensation if order persistence fails. Multi-document transaction support is deployment-dependent.
- School contributions currently allocate whole donations and request quantities are whole numbers. Partial school fulfillment is supported through multiple donations, but partial splitting of one donor's donation is not implemented.
- Demo accounts and sample records use reserved `aaharva.example` email addresses and are marked as demonstration data. Seed credentials come only from environment variables.
- Payment methods describe in-person settlement only: `pay_on_pickup` and `pay_on_delivery`. No online gateway is integrated.
- Delivery is a persisted timeline, not real-time location tracking; coordinates only exist when explicitly provided.

## Food safety and regulations

- Required handling data, food type (vegetarian/non-vegetarian/not applicable), expiry deadline, storage and allergen declarations are enforced as software guardrails. For packaged food, the submission also records manufacturer, ingredients, batch number, manufacture date, and confirmation that the original label is readable.
- These fields were informed by FSSAI's Food Safety and Standards (Recovery and Distribution of Surplus Food) Regulations, 2019. The regulation distinguishes safe unused surplus food; requires timely handover before spoilage/expiry; specifies label details for donated prepared food and pre-packed food; and describes handling and records. Official Gazette PDF: https://www.fssai.gov.in/upload/uploadfiles/files/Gazette_Notification_Surplus_Food_06_08_2019.pdf (relevant clauses include regulations 4–7 and Schedules I–II).
- The implementation is not a compliance certification and does not replace required food-business licenses, physical labels, safe packaging, hygienic transport/storage, temperature controls, distribution records, or professional regulatory review. Do not treat entering data in Aaharva as proof that food is safe.
- No universal temperature/time thresholds are asserted as law. Specific operational limits, category-wise eligibility, food transport process, and final compliance must be reviewed against current FSSAI requirements by qualified personnel.
- A submitted incident is a precautionary trigger for review. It does not constitute a finding that an organization or individual is unsafe.

## Known gaps / unverified assumptions

- Dependency compatibility and the Vite production build could not be executed without registry access.
- MongoDB model behavior, indexes, the full server process, API authorization and persistence have not been integration-tested here.
- Race conditions, order creation compensation and school allocation concurrency need integration tests against isolated MongoDB; pure rule tests do not prove database-level behavior.
- Browser-based testing at 360px, 768px and 1280px is not yet performed.
- Leaflet and Recharts are declared dependencies; a dedicated interactive mapping or complete analytics visualization experience is not verified/fully surfaced in all role dashboards.
- Full auditing of every failure path, proof-image uploads, live ETA, external communications, and advanced organization-document upload are outside this implementation scope.
