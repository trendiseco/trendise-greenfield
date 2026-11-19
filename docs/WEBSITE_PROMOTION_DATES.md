# Website promotion dates

Admin and Super Admin → Website & offers → Website promotions now provide Start date and End date. Select a percentage or flat-price promotion to enable the date controls. Both dates are required for a newly saved promotion in this form. Clear promotion removes it immediately.

Dates are inclusive India Standard Time: the start date begins at 00:00 IST and the end date ends at 23:59:59.999 IST. The API evaluates dates whenever it calculates a catalog/checkout price. A future or expired rule stays saved but the regular price applies. Saved bills/orders retain their recorded prices. Existing undated rules remain active without date limits.

Bulk pricing in Excel has optional Bulk start date and Bulk end date defaults. The Website workbook includes Start date and End date columns; use YYYY-MM-DD text or Excel date cells. Row dates override defaults. Blank row dates use the entered defaults; if both are blank there is no date limit. Download a fresh workbook to obtain the new headings. Each row exports the configured offer price, including future or expired offers, and its saved dates. Entering the regular price clears the offer. Invalid dates, inverted ranges, duplicate SKUs and invalid prices reject the full import before any updates.

The shared pricing screen now correctly reads website rules/prices for website offers rather than POS rules/prices. Excel imports read the actual price column (column 11), followed by website start/end dates in columns 12 and 13. POS workbooks retain their existing columns and base-price behavior.

Implementation: shared/promotion-schedule.mjs validates dates and evaluates IST boundaries; apps/api/src/pos.mjs applies schedules to pricing and import/save; apps/web/src/components/PosPromotions.jsx handles forms and workbook dates. Schedule fields persist in the existing promotion JSON; no database migration is required.

Verification: 87 regression tests passed including isolated PostgreSQL checks; focused tests cover exact IST boundaries, website/POS separation, checkout prices, restored schedules, date-only edits, unchanged imports and atomic rejection. Production web build passed.
