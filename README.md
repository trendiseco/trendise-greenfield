> Website content editing, birthday benefits, coupons and loyalty are now implemented. Start with [WEBSITE_ADMIN_REWARDS.md](WEBSITE_ADMIN_REWARDS.md) for current Admin controls, defaults and the additive migration.

# TRENDISE Greenfield — Website Admin & Rewards Update

> Customer website redesigned on 10 November 2026 with the supplied campaign film and AI development photography. See [STOREFRONT_REDESIGN.md](STOREFRONT_REDESIGN.md) for the visual revision, media provenance and verification. M02 backend and staff functionality are preserved.

Independent continuation of the inspected Milestone 01 greenfield source. No legacy TRENDISE code, schema or data was used. Razorpay, Shiprocket, OTP, maps and AI remain mock-only. Milestones after M02 are outside this delivery.

## Run on your Mac

Requirements: Node.js 22+, npm, Docker Desktop running. PostgreSQL 17 can alternatively be installed locally. The supplied database password is fictional local development configuration.

```sh
cd trendise-greenfield
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Website: http://localhost:3000 · POS: http://localhost:3000/pos · Warehouse: http://localhost:3000/warehouse · Admin: http://localhost:3000/admin · API: http://localhost:4100/api/health

If Docker is still initializing, wait for `docker compose ps` to show healthy before migrating. PostgreSQL is bound to localhost port 5434; change DATABASE_URL for your own local development PostgreSQL. Do not point this application at a live database.

Existing Milestone 01 processes may already occupy ports 3000 and 4100. Stop those processes in their original Terminal with Ctrl+C before launching this copy. Original source is preserved separately. Milestone 01 in-memory data cannot be migrated because it was never durable; M02 starts with the same fictional catalog and quantities.

## What M02 adds

- Versioned PostgreSQL migration, idempotent seed, durable products, variant identities, multi-location stock, reservations, orders, POS sales, sessions, ledger, approvals and idempotency records.
- Admin product create/edit, local JPEG/PNG/WebP image attachment with alt text and removal, draft preview and revision conflict detection. Up to four images, 500 KB each, stored in PostgreSQL as data URLs for this development milestone.
- Every size/color requires a unique SKU and barcode. Missing, malformed or duplicate values produce an error. Keyboard barcode scanners can populate the barcode field. Published identities are immutable to preserve warehouse scans and historical stock references.
- Draft → pending → independent Super Admin publish or reject. Draft edits stay private until approved; unchanged live products remain purchasable. Self-approval and stale approvals are blocked. New products start with zero stock.
- Super Admin user activation/deactivation, assigned locations, role creation and permission editing; approval history and audit events. Disabled users and role changes affect existing sessions on the next request. Super Admin authority is fixed and cannot be delegated via custom role permissions.
- Super Admin mock stock receipts and transfers, with reasons, audit, stock ledger, reservation protection and idempotency. Website/POS/warehouse use the same central quantities.
- Automated domain, HTTP and actual PostgreSQL integration tests, including two independent API instances competing for the final unit and rollback on constraint failure.

## Mock credentials and roles

Customer: request OTP with a fictional Indian mobile, enter `123456`. Default staff users `admin`, `superadmin`, `pos`, `warehouse` use their matching role and PIN `1234`. Admin screen supports Admin and Super Admin management accounts; optionally enter a newly created user ID with that role. POS and warehouse retain their dedicated login pages. Custom roles are usable through the staff API and restricted by their permissions; the dedicated management screens target the default management roles.

Admin may edit and submit catalog and inspect inventory; Super Admin approves a different user's submission, manages access and receives/transfers mock stock. Admin retains M01 POS and warehouse permissions unless removed in the role editor. Customers cannot edit catalog, staff or inventory.

Mock coupons remain `WELCOME10` online and `STORE10` / `STORE20` at POS. Payment simulation never charges money; warehouse dispatch never contacts a courier. Maps and AI remain unconnected.

## Review the flows

1. Sign in as Admin, create a product, add variants with unique barcodes and attach a small local mock photo. Save, inspect preview and submit. A missing barcode fails validation.
2. Confirm the new draft does not appear in `/shop`. Sign out; sign in as Super Admin, inspect the pending product and publish. It now appears in `/shop`.
3. Receive mock stock for the new SKU at warehouse/store using Super Admin inventory controls. POS sales and online reservations now share those balances. A transfer cannot move reserved units.
4. Place a mock website order using the current T&C, confirm mock payment, then open warehouse. Print pick list and scan matching order line and garment barcode before mock dispatch.
5. Restart the API. Catalog, staff, stock, reservations, orders and sale idempotency survive. Browser session tokens also remain valid until access is revoked.

## Checks

```sh
npm test
npm run build
# Once only: create a separate test database, never use the development database here
# This command creates an empty DB; if already created, do not recreate it.
docker compose exec -T postgres createdb -U trendise trendise_test
TEST_DATABASE_URL=postgresql://trendise:trendise_dev_only@127.0.0.1:5434/trendise_test npm run test:db
```

The PostgreSQL tests create a temporary schema inside TEST_DATABASE_URL and drop only that schema on completion. Without TEST_DATABASE_URL that integration test is explicitly skipped. The standard HTTP test covers customer → payment → warehouse scan → dispatch → POS stock sharing. See TEST_PLAN.md for recorded verification.

## Persistence, migration and backup

`db:migrate` records version `001_m02` in schema_migrations inside a transaction protected by an advisory lock. Reruns are safe. `db:seed` inserts fictional starting state only when absent, so rerunning never resets edits or sales. Docker's named volume survives normal stop/start. Use `docker compose stop` to stop without deleting data.

A database transaction locks the central commerce_state row with SELECT FOR UPDATE, reloads current state, executes a request, validates and writes normalized domain projections plus state, then commits before sending success. Failures roll back. This intentionally coarse database lock protects multiple API instances and all affected locations for M02's small development dataset. The normalized projections have foreign keys, unique SKU/barcode and nonnegative stock constraints. The state document is the source of truth; do not edit projection tables manually. Per-row repositories, object storage and high-throughput scaling are later work.

Backup before a future migration:

```sh
docker compose exec -T postgres pg_dump -U trendise trendise_dev > trendise-dev-backup.sql
```

Restore only into an empty local development database using psql. No destructive down migration is supplied. To recover from a future failed upgrade, retain the old source bundle and restore the complete backup into a separate database, then change DATABASE_URL. `.env`, database dumps and uploaded images should stay out of source control.

## Development limits

This remains a local mock development application. Fixed demo PINs/OTPs and session tokens are not production authentication. No real customer data or photographs should be entered. Images are stored inline with the state and increase request/database size. Coarse locking and full projection rebuilding favor understandable correctness over throughput. API defaults to requiring PostgreSQL and fails closed if unavailable. Explicit `ALLOW_MEMORY=true` with DATABASE_URL unset is available only for isolated demonstrations/tests and is not durable. The server refuses production mode, non-development TRENDISE_ENV and MOCK_ONLY=false. Live integrations require separate UAT authorization.

## Sync completed changes to GitHub

The local Git hook pushes each completed commit on `main` to the private
`trendiseco/trendise-greenfield` GitHub repository. On a new clone, install it
once with `git config --local core.hooksPath .githooks` and authenticate Git
for that repository. Working files sync when committed. A failed push leaves
the commit locally, and `git push origin main` retries it.

## Shiprocket courier lookup for private UAT

Create a dedicated Shiprocket API user in Shiprocket → Settings → API.
Set `SHIPROCKET_RATE_LOOKUP=true`, `SHIPROCKET_API_EMAIL`,
`SHIPROCKET_API_PASSWORD`, and your confirmed `SHIPROCKET_PICKUP_PIN` in the
local ignored `.env` or the API process environment. Restart the API, then
open Admin → Shipping and enter a sample destination PIN, parcel weight, and
payment type. This uses only authentication and the courier serviceability
endpoint. Checkout charges, order booking, AWBs, pickup, returns, and Razorpay
remain mocked. API credentials belong on the server only.
