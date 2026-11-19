# Customer email/password and Google sign-in

Updated: 19 November 2026

## Current configuration

TRENDISE uses Supabase Auth project `trendise-uat-mumbai` (`lddnaqffzszqvhxgxjje`). The local ignored `.env` now contains its project URL and publishable key. No service-role key is required. Email signup and email confirmation are enabled in the project. The approved redirect `http://localhost:3000/account` was added and verified in the dashboard. Google remains disabled pending its credentials.

Commerce data still uses the existing DATABASE_URL. Configuring Supabase Auth does not change that database connection or copy customer/order data elsewhere. Local checkout payments remain simulated.

## Google setup — owner steps

1. Open [Google Cloud Console](https://console.cloud.google.com/), select or create your TRENDISE project, and open Google Auth Platform.
2. Complete Branding with TRENDISE, your support email, and required contact details. Set Audience to External; add your test Google accounts while the app is in Testing.
3. Under Clients create an OAuth client: type **Web application**, name **TRENDISE Web**.
4. Authorized JavaScript origin: `http://localhost:3000`.
5. Authorized redirect URI: `https://lddnaqffzszqvhxgxjje.supabase.co/auth/v1/callback`.
6. In Supabase → Authentication → Sign In / Providers → Google, enter the generated Client ID and Client Secret, enable Google, and save. Keep the secret in that dashboard.
7. Set `CUSTOMER_GOOGLE_ENABLED=true` in the local `.env`, restart the API, and reload the website.
8. Open `/account`, choose Continue with Google, approve your account, and complete the name/phone fields if requested. Verify My Orders and checkout.

Reference: [Supabase Google provider guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## Email delivery before public signup

Configure a custom SMTP provider under Supabase Authentication → Emails before testing arbitrary customer addresses or launching. Supabase's default sender is limited to project team addresses and low-volume testing. Configure your verified sending domain and the provider's SMTP host, port, username, and password privately in Supabase. Keep email confirmation enabled. Test signup → confirmation → email/password login with an address you control.

Reference: [Supabase custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

## Application implementation

- `apps/web/src/components/CustomerAuth.jsx`: shared account/checkout sign-in, registration, Google callback, profile completion, legacy-history verification.
- `apps/web/src/lib/customer-auth.js`: Supabase browser client, PKCE, persisted provider session and local sign-out.
- `apps/api/src/customer-auth.mjs`: verifies bearer identity directly with Supabase `/auth/v1/user`, then issues a 24-hour TRENDISE application session. Passwords go directly to Supabase, never to the commerce API.
- `apps/api/src/customer-identity.mjs`: stable verified-ID ownership for orders, checkout holds, coupon usage and loyalty.
- `apps/api/src/server.mjs`: public email configuration, verified-session exchange, application logout routes.
- `shared/split-payment.mjs`: common PIN-distance eligibility consumed by checkout and API.

The application session stays in sessionStorage. The Supabase SDK uses localStorage so PKCE email confirmation can complete in a new tab of the same browser. Signing out clears the application session and signs out the local provider session. Cross-browser email confirmation may need a fresh email/password sign-in.

Phone is contact information, not proof of identity. One customer profile per phone is retained for compatibility with the existing customer projection. An existing SMS customer's historical orders/rewards are linked only after real verification of that original phone. Entering another person's phone cannot expose their history. Existing verified phone sessions are migrated; unverified legacy sessions are revoked. Staff login is unchanged.

No schema migration is required: identity fields persist inside the existing commerce JSON and customer profile payload. The phone primary key in the reporting projection remains unchanged.

## COD rule

Full COD is enabled only for a recognised PIN with a calculated distance at most 1,000 km from the existing 501505 origin. Unknown PINs cannot use full COD. Checkout disables the option and the API independently rejects it before reserving stock, then rechecks before converting a reservation. Existing 30% upfront / 70% delivery payment remains available at least 1,000 km away.

Distance uses the existing PIN directory coordinates and great-circle calculation, not courier road distance. Do not present it as a courier route measurement.

## Verification and release limits

Automated coverage includes verified identity ownership, old-history linking, rewards preservation, persistence restoration, logout, forged tokens, unconfirmed email, and near/far COD rejection. Full API regression and production web build must pass before committing.

Real email delivery and Google consent require owner/provider setup and a live end-to-end test. A successful build or mocked provider test does not establish those external flows work. This change is not a declaration that the wider development application is production-ready.

For deployment replace localhost origins/redirects with the exact HTTPS website domain in Supabase and Google, configure the API's allowed website origin, and supply the corresponding environment values privately. Keep secrets out of GitHub.
