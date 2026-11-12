// Demo-only charges. Catalog prices already include tax.
export const websiteGstRate=5;
export const websiteShippingCharge=0;

export function websiteCharges(subtotal,discount=0){
 const subtotalPaise=Math.round(subtotal*100);
 const merchandisePaise=Math.max(0,subtotalPaise-Math.round(discount*100));
 const shippingPaise=subtotalPaise>0?Math.round(websiteShippingCharge*100):0;
 return {
  gstRate:websiteGstRate,
  gstAmount:Math.round(merchandisePaise*websiteGstRate/(100+websiteGstRate))/100,
  shipping:shippingPaise/100,
  total:(merchandisePaise+shippingPaise)/100,
 };
}
