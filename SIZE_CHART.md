# Product fit and size measurements

Open Admin → Products → Edit / preview → Fit & size measurements.

Enter measurements for each variant size, in centimetres or inches. Unit changes convert entered values. Tops show body length, flat chest width, shoulder width and sleeve length. Bottoms show outer length, flat waist width, flat hip width, inseam, thigh width and leg opening. Width means across a garment laid flat, not body circumference.

Use Sync rows with product sizes after changing variant sizes. Add measurement notes and tolerance as needed. Save the draft, preview the chart, submit it and have a separate Super Admin publish the revision. Until approval, the public chart stays unchanged.

Initial charts on the eight seeded products contain explicitly labelled fictional sample measurements. Replace these with actual measured garments before setting the status to verified. Verified charts require complete positive measurements for every variant size. A missing chart shows an honest unavailable message. Removing a chart persists across restarts.

Customers open Fit & size guide on the product page, switch cm/inches, view their selected size highlighted and read the illustrated measuring instructions.

## Setup

No new migration or reseed is required. Charts are stored with existing PostgreSQL product/draft documents. Existing seeded products without a chart receive sample data on load; custom values and explicitly removed charts are preserved. Restart the existing development server if hot reload has not refreshed it. Do not reset the database.

## Validation

Standard automated tests cover chart validation, conversion, approval privacy and restart persistence. The PostgreSQL integration test also verifies an approved chart survives a fresh database-backed instance. All integrations remain development mock-only.
