# Warehouse picking

Placed orders are visible in the warehouse queue, newest first. The open warehouse screen refreshes every five seconds while visible. The queue and selected order detail are permission-checked read-only database requests.

The pick list shows the ordered colour, size, quantity, SKU, garment barcode, item price, pick locations and the matching catalogue photo when available. Delivery details, payment and any cash balance are above the list.

Print the sheet, then scan the **Code 128 order-line barcode** and the **barcode attached to the actual garment** for every unit. Configure a keyboard-wedge scanner with an Enter suffix to advance between fields. The printed sheet lists the garment barcode as text; it does not print a duplicate scannable garment label. Older pick codes remain accepted. Matching checks the SKU/variant barcode, not a unique garment serial number.

Mock dispatch still requires complete verification and the end of the cancellation window. No courier calls are made. Verify print scale and scanner support with actual warehouse equipment before rollout.

## Products and inventory

Switch to **Products & inventory** for the complete published catalogue, including zero-stock, inactive and hidden-online variants. Search by product, SKU or barcode; filter by location, category or availability. On-hand balances are the shared inventory system's balances, and available stock subtracts unexpired checkout reservations. The view is read-only and shows a location breakdown. Stock adjustments remain in Admin.
