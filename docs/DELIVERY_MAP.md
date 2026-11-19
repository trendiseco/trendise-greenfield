# Delivery address map

Checkout now offers manual entry and Choose on map. Mock Live Location and the old three sample map buttons were removed.

The map loads only when opened. Enter a PIN to centre on its bundled reference point, zoom/pan, tap the map or drag the pin, then choose Find address for this pin. Keyboard users can pan with arrow keys and place the pin at the map centre. Use this address fills the editable delivery form after preview. Names and phone numbers are retained; stale geographic fields are replaced. Missing city, district, street or PIN fields are not invented. Customers must review the nearest mapped address and add their house/flat details.

Implementation:
- `apps/web/src/components/DeliveryMap.jsx`: lazy Leaflet map, draggable marker, preview and address selection.
- `apps/web/src/components/delivery-map.css`: responsive map dialog styling.
- `apps/api/src/delivery-map.mjs`: Photon adapter, India validation, nearby-result check, cached lookups and request throttling.
- `POST /api/delivery/map-address`: accepts numeric lat/lon, returns address fields and mapPin. Runs outside commerce database transactions and changes no stock or orders.
- `apps/api/tests/delivery-map.test.mjs`: validation, missing fields, provider failures, cache/throttle and HTTP regression.

Tiles use OpenStreetMap with visible attribution. The provider's [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) requires normal browser caching/referrers and prohibits bulk downloading or prefetching. Only visible map tiles are loaded. Photon receives selected coordinates only when the customer explicitly requests an address; customer name and phone are not sent. Lookup credits OpenStreetMap and Photon. The optional server-only DELIVERY_GEOCODER_URL can point to a compatible HTTPS Photon deployment. Never supply an arbitrary URL from a customer request.

The [Photon public service](https://photon.komoot.io/) allows fair use, throttles extensive usage and offers no availability guarantee. Current single API instance allows at most one uncached lookup per 1.1 seconds; repeated coordinates are cached in bounded process memory for an hour. For a larger or replicated production deployment, use a contracted or self-hosted service with shared rate limiting. Manual entry remains available when maps or lookup fail. No Google Maps credentials or browser geolocation permission are required.

Verified: production web build; 84 API regression tests including isolated PostgreSQL checks; live Hyderabad reverse lookup; browser map rendering, pin placement, lookup preview, application to checkout and COD re-evaluation. No real order was placed during this check. Internet and mapped address coverage are required; reverse lookup does not verify a house number or courier serviceability.
