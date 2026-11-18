// Development tables are derived from commerce_state inside the caller's transaction.
export async function rebuildProjections(client, commerce) {
  await client.query(`
    DELETE FROM inventory;
    DELETE FROM variants;
    DELETE FROM products;
    DELETE FROM locations;
    DELETE FROM staff_users;
    DELETE FROM staff_roles;
    DELETE FROM reservations;
    DELETE FROM orders;
    DELETE FROM pos_sales;
    DELETE FROM catalog_drafts;
    DELETE FROM approval_history;
    DELETE FROM stock_ledger;
    DELETE FROM audit_events;
    DELETE FROM idempotency_records;
  `);

  for (const product of commerce.products) {
    await client.query('INSERT INTO products VALUES($1,$2,$3)', [product.id, product.slug, product]);
    for (const variant of product.variants) {
      await client.query('INSERT INTO variants VALUES($1,$2,$3,$4,$5)',
        [variant.sku, product.id, variant.barcode, variant.price, variant]);
    }
  }
  for (const location of commerce.locations) {
    await client.query('INSERT INTO locations VALUES($1,$2)', [location.id, location]);
  }
  for (const [sku, balances] of Object.entries(commerce.stock)) {
    for (const [locationId, quantity] of Object.entries(balances)) {
      await client.query('INSERT INTO inventory VALUES($1,$2,$3)', [sku, locationId, quantity]);
    }
  }
  for (const [name, permissions] of Object.entries(commerce.roles)) {
    await client.query('INSERT INTO staff_roles VALUES($1,$2)', [name, JSON.stringify(permissions)]);
  }
  for (const user of commerce.users) {
    await client.query('INSERT INTO staff_users VALUES($1,$2,$3)', [user.id, user.role, user]);
  }

  const keyedProjections = [
    ['reservations', commerce.reservations],
    ['orders', commerce.orders],
    ['pos_sales', commerce.sales],
    ['idempotency_records', commerce.eventIds],
  ];
  for (const [table, entries] of keyedProjections) {
    for (const [id, document] of entries) {
      await client.query(`INSERT INTO ${table} VALUES($1,$2)`, [id, document]);
    }
  }
  for (const [id, draft] of Object.entries(commerce.drafts)) {
    await client.query('INSERT INTO catalog_drafts VALUES($1,$2,$3,$4)', [id, draft.revision, draft.status, draft]);
  }
  for (const item of commerce.ledger) {
    await client.query('INSERT INTO stock_ledger VALUES($1,$2)', [item.id, item]);
  }

  await rebuildWebsiteProjections(client, commerce.website);

  for (const [id, approval] of commerce.approvals.entries()) {
    await client.query('INSERT INTO approval_history VALUES($1,$2)', [id, approval]);
  }
  for (const [id, event] of commerce.audit.entries()) {
    await client.query('INSERT INTO audit_events VALUES($1,$2)', [id, event]);
  }
}

async function rebuildWebsiteProjections(client, website) {
  await client.query(`
    DELETE FROM website_settings;
    DELETE FROM website_coupons;
    DELETE FROM customer_profiles;
    DELETE FROM loyalty_ledger;
    DELETE FROM coupon_redemptions;
    DELETE FROM website_media;
  `);
  await client.query('INSERT INTO website_settings VALUES(1,$1)', [website]);
  for (const coupon of website.coupons) {
    await client.query('INSERT INTO website_coupons VALUES($1,$2)', [coupon.code, coupon]);
  }
  for (const customer of Object.values(website.customers)) {
    await client.query('INSERT INTO customer_profiles VALUES($1,$2,$3)', [customer.phone, customer.points, customer]);
  }
  for (const entry of website.rewardLedger) {
    await client.query('INSERT INTO loyalty_ledger VALUES($1,$2)', [entry.id, entry]);
  }
  for (const redemption of website.couponUses) {
    await client.query('INSERT INTO coupon_redemptions VALUES($1,$2)', [redemption.id, redemption]);
  }
  for (const [id, media] of Object.entries(website.media)) {
    await client.query('INSERT INTO website_media VALUES($1,$2)', [id, media]);
  }
}
