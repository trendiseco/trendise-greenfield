-- Additive: keep all M02 products, orders, staff and stock unchanged.
CREATE TABLE website_settings (id integer PRIMARY KEY CHECK(id=1), document jsonb NOT NULL);
CREATE TABLE website_coupons (code text PRIMARY KEY, document jsonb NOT NULL);
CREATE TABLE customer_profiles (phone text PRIMARY KEY, points bigint NOT NULL CHECK(points>=0), document jsonb NOT NULL);
CREATE TABLE loyalty_ledger (id uuid PRIMARY KEY, document jsonb NOT NULL);
CREATE TABLE coupon_redemptions (id uuid PRIMARY KEY, document jsonb NOT NULL);
CREATE TABLE website_media (id uuid PRIMARY KEY, document jsonb NOT NULL);
-- Grant these new website-only abilities to the default Admin role once.
UPDATE commerce_state SET payload=jsonb_set(payload,'{roles,admin}',COALESCE(payload#>'{roles,admin}','[]'::jsonb)||'["website.manage","offers.manage","rewards.manage"]'::jsonb) WHERE id=1;
