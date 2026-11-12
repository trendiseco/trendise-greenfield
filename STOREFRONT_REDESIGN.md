> Historical cinematic redesign notes. The later website Admin/rewards update adds persistent content editing and benefits; see WEBSITE_ADMIN_REWARDS.md for current behavior and migration instructions.

# TRENDISE — The Modern Indian Man, in Motion

Customer website redesign, 10 November 2026. This is an authorized customer presentation revision of the greenfield M02 project, not a later backend milestone.

## Run and review

Use the same project and M02 setup. No new npm dependencies, database migrations or reseeding are needed. The existing development server normally refreshes automatically. If needed, stop it with Ctrl+C, then run `npm run dev` from this project folder. Open http://localhost:3000/ and refresh the browser.

Routes: `/` cinematic homepage; `/shop` searchable/filterable collection; `/product/[slug]` photographic product detail; `/cart`, `/checkout`, `/orders` preserved customer journeys. `/pos`, `/warehouse` and `/admin` retain their M02 screens and APIs.

## Design

Ivory, charcoal, stone and muted olive; editorial typography; a muted campaign film with a poster and pause/play button; seven photographic category stories; Work / Weekend / After Hours edits; fabric detail section; product-card perspective tilt; layered fabric photograph; progressive scroll depth and reveal. Reduced-motion users receive the static poster by default and animations are disabled. Video playback can still be requested explicitly. Save-data preference also suppresses automatic playback.

The collection supports combined search, category, size, color, fit, maximum price, availability and price ordering. A color-filtered product card uses that color's photography. Quick-add size buttons are separate from product links. Product detail shows five views per seeded color, an enlargement dialog, color/size selection, actual central stock, mobile purchase bar, related outfit pieces, fit guidance and the explicitly inactive try-on preview. Product-specific size measurements and approved care instructions have not been invented.

Photos are development AI imagery, identified on the home, collection, product pages, image descriptions and footer. These are not real photographed production SKUs. True 3D and 360° are not claimed; the site uses perspective interactions and multi-angle photographs. Production-grade measured garment meshes or captured image sequences would be needed for a true product viewer.

## Media provenance and saved assets

- User-supplied Google Flow film: `Man_modeling_menswear_brand_film_49063543_1080p.mp4`; original retained in `design-assets/source/user-campaign-original.mp4`.
- Runtime film: `apps/web/public/media/trendise-film-web.mp4`, muted H.264, 1600px wide, fast-start MP4. No third-party video host.
- Poster: `apps/web/public/media/film-poster.jpg`, extracted from that film at 1.5 seconds.
- Catalog: `apps/web/public/media/catalog/`, 80 optimized WebP assets (eight product sets, two color rows, five views; denim has the same Indigo color in both source rows and uses one row).
- Generation method: built-in image-generation tool. No API key or AI integration was added to the application. Each image was generated for this task, then split into the five specified views. The app itself never invokes an image provider.
- Contact sheets and exact generation briefs: `design-assets/`. Original generated image locations are recorded for traceability, but runtime assets are entirely inside this project.

The local photo resolver is explicitly keyed to the seeded greenfield product slugs and known colors. It does not invent imagery for an unknown product/color. Published Admin-uploaded photos take precedence for the product's first color; additional colors without matched photos show the seeded gallery if applicable or an honest photography-unavailable state. Backend photo metadata has not been modified. Original staff mock visuals remain unchanged.

## Verification

- Existing M02 API regression suite: 17 passing tests. PostgreSQL test remains opt-in and was not rerun because backend source and schema are unchanged.
- Full Next.js build: passed for all customer and staff routes.
- Verified byte-for-byte preservation against the M02 bundle: API core, server, database adapter, seed, Admin/POS/warehouse screens and original staff ProductVisual.
- Browser: campaign film playback and pause; customer navigation; category, White color and M size filtering; color-specific product gallery; back and side views; enlargement controls; Escape dismissal and focus return; White / L added to bag; increment/decrement totals; mock OTP login; manual address; WELCOME10; readable T&C popup; required consent; successful mock order and order history.
- Browser checkout created fictional QA order TRD-10001 for one White / L Oxford shirt, total ₹1,349.10. It is retained as mock data; no real money or courier was involved.
- Responsive checks at 390×844: homepage, mobile menu, collection, product and purchase bar; no document horizontal overflow. Normal horizontal scrolling is used intentionally within category tracks. Desktop also checked at 1440×1000 and the normal preview width.

## Scope

No changes to API, PostgreSQL, stock rules, approval logic, staff screens or barcode validation. No live Razorpay, Shiprocket, OTP delivery, GPS/maps or AI. No legacy Trendise source imported. Backend M02 approval/publish continues to control the public product listing. New real commercial photography, measured sizing and final legal/care policies should replace the clearly labeled development content before live use.
