# Manual virtual try-on (no AI at runtime)

Product → Virtual try-on → choose a front-facing JPG, PNG or WebP under 10 MB / 24 MP. The selected color's transparent garment is drawn over the photo locally. Use Align to my body and mark left/right shoulder edges and center hem for tops; waist edges and center ankle hem for bottoms. Narrower, balanced, broader and oversized visual starting points adjust the width. Drag to move; sliders change width, length, waist/hip, hem, rotation, position and opacity. Show original toggles the overlay. Save preview downloads a labelled PNG only to the customer device. Remove photo or close the dialog to release it. No customer photo upload, storage, network processing, live AI, camera access or body inference occurs.

This is manual 2D image compositing, not realistic cloth simulation or automatic body detection. Existing clothes, hands and hair may overlap incorrectly. Side-facing, seated or bent poses need manual placement and will not produce an accurate fitting result. Size selection does not simulate physical garment dimensions. Consult verified measurements for sizing.

## Product photos and cutouts

All eight seeded products and their fifteen colors include an additional transparent, garment-only development image alongside existing photography. Images were generated offline from catalog references and are clearly marked illustrative AI development assets. They are not verified photographs of real merchandise. Runtime photo processing uses no AI.

Admin → Products → Edit / preview → Product photographs. Upload a tightly cropped transparent PNG or WebP up to 500 KB, select its matching variant color and choose Transparent garment-only try-on cutout as the image purpose. Keep ordinary photographs as Product photograph. Mark generated development images appropriately. One cutout per color. Add cutouts for every color of a new product. The preview supports all products with a matching cutout; missing assets show an honest unavailable message, with no unrelated fallback garment. Try the draft overlay in Preview garment overlay before approval. Save, preview, submit, then publish as Super Admin. Draft cutouts remain private until approved and persist in the existing PostgreSQL product document.

Use complete front-view garments with no model, accessories or background, minimal transparent padding, and natural straight sleeves or legs. Alpha transparency and precise garment boundaries must be checked before approving actual product cutouts. Replace the illustrative seeded assets with verified garment-only photography for real merchandise.

## Setup and verification

No migration, reseed, live credentials or new dependencies. Restart development services if hot reload is unavailable. Existing inventory, payments, POS and warehouse remain unchanged. Geometry tests cover photo aspect ratios, manual landmark alignment and width deformation. API tests verify color/purpose validation, duplicate cutout rejection, approval privacy and restart persistence. PostgreSQL integration checks image purpose persistence.
