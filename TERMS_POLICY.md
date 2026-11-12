# TRENDISE terms coverage and launch handoff

The Terms page and checkout dialog use the same policy. The 98-point supplied list is consolidated by topic:

- 1–4: acceptance, purchase eligibility, OTP and customer information.
- 5–15: product details, colour, sizing, stock, order review and confirmation.
- 16–27 and 75: pricing, MRP, tax, shipping charges, invoices and promotions.
- 28–38: loyalty, payment processing, payment security and fraud.
- 39–52: address, serviceability, fulfilment, tracking, failed delivery and cancellation.
- 53–74: 72-hour change-of-mind returns, condition checklist, exceptions, inspection, exchanges and refunds.
- 76–87: communications, privacy, location, providers, site access, IP and misuse.
- 88–98: liability, indemnity review, force majeure, policy versions, acceptance, consumer rights and grievance contacts.

The policy distinguishes existing demo capabilities from proposed live terms. Do not present this as a production policy. Before launch, supply verified legal/business details and grievance contacts; publish reviewed privacy, shipping and return policies; confirm refund timing and fees, exchange terms, loyalty expiry and delivery credit rules; and have liability, indemnity and jurisdiction reviewed. Do not use the discretionary return window to limit statutory remedies.

New orders save a consent record with acceptance status, policy version, customer identifier, order ID and timestamp. Existing order records are preserved. The version upgrade archives the policy present in saved state; it cannot reconstruct historical versions that were overwritten before archiving existed. Future website policy publications archive the full terms and date. No schema migration is required.
