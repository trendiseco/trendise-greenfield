# Website Admin, Birthday, Coupons & Loyalty

Authorized website-focused update to the current greenfield project. All business providers remain MOCK-ONLY. POS and warehouse screens are unchanged; their existing stock and coupon flows remain supported.

## Open the new controls

- Admin: http://localhost:3000/admin — default Admin / PIN `1234`.
- Customer account and rewards: http://localhost:3000/account — fictional mobile + demo OTP `123456`.
- Website: http://localhost:3000/.

Admin now has Website content, Discount coupons, Birthday & loyalty and Customer rewards sections above the product catalog. Super Admin retains those abilities as well. Staff security management remains Super Admin-only. Product publication retains the existing separate Super Admin approval; website content publication is available to Admin.

## Edit the website

Open Website content and expand a section. You can edit brand text/colors, navigation, announcement text/link, campaign video/poster, hero copy/button, collection ribbon, featured products by name and display order, category stories, editorial edits and their categories, fabric story, brand statement, collection heading, footer links/copy and development terms. Visible flags hide sections. Lists can be added to, removed from and reordered.

Save website draft → Preview saved draft → Return to Admin → Publish website. Drafts are private until published. Preview uses the same browser tab and Admin session. Concurrent edits are revision checked. Published content is reloaded on navigation or window focus; refresh an already-open page to see changes immediately.

The mock/development disclosures remain fixed. This editor changes supported storefront content and presentation; it does not expose application code, provider credentials or authorization rules. Product pages continue to derive name, description, price, colors, sizes and photographs from the approved catalog.

Media fields accept existing local asset paths or uploads. Website images support JPG/PNG/WebP up to 2 MB each; films support MP4 up to 24 MB. Uploads are validated and stored in PostgreSQL for this local development version. Local website links begin with `/`; remote scripts and arbitrary HTML are not accepted. Large media increases the size and cost of the aggregate development transaction. Dedicated object storage remains UAT work.

## Manage products

The product editor additionally exposes care text, collection label, swatch, featured/website visibility, variant activation, additional variants and up to 20 product photographs. Photographs can be associated with a color and view label. The existing 500 KB per product-photo limit remains.

Published SKU/barcode identities stay permanent. Add a new variant instead of changing a historical identity. Deactivate a variant to stop selling it; historical orders/warehouse scans are preserved. Hide a product from the website using Website visible. POS still has its separate catalog view. New variants start with zero stock after approval and can receive mock inventory using the existing inventory controls.

## Discount coupons

Create percentage or fixed-INR coupons, minimum subtotal, optional maximum discount (`0` means no cap), start/end dates, global maximum uses, per-customer maximum uses, Active and Show in customer offers. Coupon codes are case insensitive and permanent once created; disable an old code rather than deleting its history. `BIRTHDAY` is reserved for birthday rules. One coupon is accepted per order. Dates are inclusive, using Asia/Kolkata.

Limits count completed orders and unexpired pending checkout reservations. Changing/pausing a coupon affects new checkouts; a valid reservation honors its saved quote for its 10-minute lifetime. Offer eligibility and totals are calculated by the server, including at final reservation. The customer account advertises only enabled public coupons within their date window; usage/minimum eligibility is checked at checkout.

The current review database includes editable sample coupon STYLE15: 15%, minimum ₹1,000, maximum discount ₹500, 100 total uses, 1 per customer. Fresh installs seed WELCOME10; STYLE15 was created through Admin during verification. Store coupons STORE10/STORE20 remain unchanged and website coupons do not apply to POS.

## Birthday default

Enabled: 15% birthday-month coupon, capped at ₹500, minimum subtotal ₹0. Admin can edit the percentage, cap, minimum or pause it. Customer enters an optional birthday in Account. It is saved once; Admin may correct it with a required reason. Use fictional personal details during development.

Use code BIRTHDAY during the customer's saved birthday month. One use per calendar year, counting active reservations as holds. Eligibility uses India time. Changing a birthday never resets an already-used annual claim. There is no birthday SMS, email, external automation or live provider connection.

## Loyalty default

Earn 1 point per ₹100 of the final paid mock website order value, rounded down. Each point redeems ₹1. Minimum redemption 10 points; maximum points discount is 20% of the remaining amount after a coupon. Admin can edit these values or pause earning/redemption.

Points are earned only on successful mock payment, never on a cart or reservation. Existing pre-update orders do not earn retroactive points. Redemption places a hold during checkout. Payment commits point deduction and earning together with stock/order updates; idempotency prevents duplicate rewards. Expired holds are released automatically after 10 minutes when availability is checked. Coupon and points may combine within the configured cap.

Customers see available and held points plus their own ledger. Admin can make a positive/negative adjustment or birthday correction with a required reason; adjustments cannot take held points or make balances negative. Each adjustment is audited and idempotent. No points expiry, tiers, transfer, real-money redemption or refund/return automation is introduced. If a future returns milestone is added, its points reversal must be designed with that workflow.

## Migration and data

Migration `002_website` is additive. It creates website settings, coupons, customer profiles, loyalty ledger, coupon redemptions and media tables; it grants the default Admin the new website-only permissions once. It does not reseed or replace M02 products, orders, sessions or inventory.

On this Mac the migration is already applied, with a pre-update local backup at `/private/tmp/trendise-before-website-rewards.sql`. For another checkout using an existing M02 database:

```sh
# From the project folder, with the existing .env and Docker running:
npm run db:migrate
npm run dev
```

A fresh installation uses the existing README setup: npm install, copy .env.example, start Docker, db:migrate, db:seed, dev. Migration and seed reruns are safe. Do not run destructive resets. The whole aggregate, including website drafts, policy version, media, rewards, coupon uses and checkout holds, persists in the locked PostgreSQL transaction with its constrained projections. Older aggregate snapshots without website fields receive defaults without replacing their existing commerce state.

## Verification

`npm test`: 28 passing tests, plus the separately opt-in PostgreSQL test. Includes original commerce regression and new draft publication, revision conflict, unsafe link rejection, coupon dates/caps/minimum/limits, POS isolation, last-use concurrency, birthday eligibility/annual limit, immutable birthday, India timezone boundary, point holds and limits, earn/redeem idempotency, negative balance prevention, permissions, media validation and backward snapshot upgrade.

`npm run test:db` with TEST_DATABASE_URL: passing. Uses a temporary isolated schema and verifies original commerce, transactional rollback/concurrency, website publication, coupons, reward balance persistence and server-side pricing after restart.

`npm run build`: all customer and staff routes compile, including the new /account page.

Browser verification: Admin edited/saved/previewed/published the announcement and created STYLE15. Fictional customer 9876543299 saved a November birthday; a ₹1,499 birthday order quoted ₹224.85 coupon discount, final ₹1,274.15, earning 12 points. Further verification notes are recorded in TEST_PLAN.md. All orders are mock data; no money, SMS or courier requests were sent.

Browser redemption verification: mock order TRD-10003 combined STYLE15 (₹224.85 off) and 10 points (₹10 off), final ₹1,264.15. The customer account ledger showed −10 redeemed and +12 earned, balance 14. Mobile account layout was checked at 390 px with no horizontal document overflow.
