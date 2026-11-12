# Admin portal — order management

Open /admin and sign in with an existing Admin or Super Admin account. Orders & returns supports search by order number, customer name or phone, filters by order status or pending review, and opens full details only when an order is selected. POS and Warehouse accounts cannot access these management endpoints.

Return requests and delivery issues can be approved for follow-up or declined with a customer-facing reason. The decision and timestamp appear in My Orders. Staff identity and decision are recorded in the audit log. Existing product, storefront, offer, loyalty and inventory controls remain available through the portal.

Decisions persist with existing order records in PostgreSQL. No migration is needed. A review does not issue a refund, arrange pickup, authorise an exchange, or restock merchandise. Payment and shipping remain mock-only.

## Return inspection and mock settlement

Warehouse → Returns → open a received return → Record final inspection. Select Pass or Fail and enter a customer-facing reason. The inspection covers the full received SKU line.

- Pass restores the quantity to sellable stock at Hyderabad Warehouse and records a mock refund of the original line's share of net merchandise paid, after coupons and points. Original included GST is part of that amount. Shipping and consumed coupon usage are retained.
- Fail records the returned quantity as quarantined at the warehouse. It stays outside sellable stock and no refund is due. The inspection record and dashboard report quarantined quantities.
- On a pass, the line's share of redeemed points is restored and its earned points are reversed up to the available balance, protecting checkout holds. Any unrecovered points are recorded for staff. The inspection and settlement are recorded together. Identical retries return the recorded outcome. A conflicting second inspection is rejected.
- My Orders and Admin show the decision, reason and refund outcome. Staff also see stock disposition and the mock refund reference. No real provider is called.

Existing received returns can be inspected without a migration or reseed.
