# M02 verification — 8 November 2026

## Completed

- `npm test`: 17 tests passed. The additional PostgreSQL test is skipped in this command unless TEST_DATABASE_URL is set.
- `npm run test:db` with a separate local PostgreSQL 17 test database: passed. Creates and removes its own temporary schema. Migrations and seed reruns are safe. Two independently instantiated durable cores on separate database connections compete for the final store unit; only one completes. A negative inventory write fails the database constraint and rolls back. A fresh core reads committed quantities, sessions, approval, receipt and orders.
- PostgreSQL HTTP flow: mock OTP → accepted T&C → reserve → payment → warehouse barcode verification → simulated dispatch. Product create → submit → independent publish → receipt → fresh-instance persistence also passed.
- M01 HTTP regression: customer order, mock payment, warehouse scan/dispatch, POS and shared available quantities passed.
- Catalog tests: draft privacy, rejection, independent approval, stale revision, required/duplicate barcode, permanent published SKU/barcode, image MIME/signature/alt checks passed.
- Access tests: unauthorized staff management, restricted custom role, disabled active session, no self-deactivation and no wildcard grant passed.
- Inventory tests: concurrent final-unit sale, held stock protection, idempotent payment/POS/transfer/receipt and total-preserving transfer passed.
- `npm run build`: successful production compilation of all original routes and updated admin screen with Next.js 16.4.5. API remains development-only even though web build is compiled for validation.
- Interactive browser check on localhost:3001 against PostgreSQL API on localhost:4101: Admin sign-in loaded all eight seeded products and multi-location balances. Product editor displayed all original variant fields. Preview rendered name, description, fabric, fit, prices and barcodes. Clearing one barcode then saving displayed the required validation popup; failed submission did not persist changes. Screenshot supplied alongside bundle.

## Scope of verification

No real external service was called. No live credentials were entered. Image rendering with a real photographic catalog, hardware scanners, printers, large datasets and production-scale throughput remain outside this local development test. Dedicated end-to-end browser automation was not added; backend flows are automated and admin interactions were checked manually. Custom roles are permission-controlled via API; current management screen targets Admin/Super Admin roles.

## Website Admin & Rewards update — 10 November 2026

28 standard tests pass; PostgreSQL integration passes separately. New tests cover private site drafts/publication/revision conflicts, URL validation, coupon percentage/fixed limits and dates, concurrent last-use holds, birthday month/year eligibility and India timezone, DOB lock, points earn/redeem/holds/caps/idempotency, Admin adjustment audit and permissions, media validation and old-state upgrade. PostgreSQL tests now also verify website/coupon/customer balance durability and authoritative reward pricing. Full Next.js build includes /account and all prior routes.

Browser verified Admin announcement edit → save → authenticated preview → publish and STYLE15 coupon creation. A fictional customer saved a November birthday, completed mock birthday order TRD-10002 at ₹1,274.15 (₹224.85 discount) and received exactly 12 points in account history. No real payment, SMS, shipping or external reward integration was used. The pre-update development database was backed up before applying additive migration 002_website. Existing product edits and original mock order remained intact.

Browser redemption verification: mock order TRD-10003 combined STYLE15 (₹224.85 off) and 10 points (₹10 off), final ₹1,264.15. The customer account ledger showed −10 redeemed and +12 earned, balance 14. Mobile account layout was checked at 390 px with no horizontal document overflow.
