import {policyRulesVersion,policyEffectiveDate} from '../../../shared/order-policy.mjs';
// Entirely fictional DEMO catalog; no previous TRENDISE data is used.
const variants = (prefix, colors, sizes, price) => colors.flatMap(([color,shade]) => sizes.map(size => ({
  id: `${prefix}-${shade}-${size}`,
  sku: `${prefix}-${shade}-${size}`,
  barcode: `T${prefix.replaceAll('-', '')}${shade}${size}`.replace(/[^A-Z0-9]/g, ''),
  color, shade, size, price
})));
export const initialProducts = [
  { id:'p1',slug:'oxford-formal-shirt',name:'Oxford Formal Shirt',category:'Shirts',description:'Crisp cotton-rich shirting with a clean, structured silhouette.',fabric:'Cotton blend',fit:'Regular fit',swatch:'#acc3d0',label:'THE MODERN FORMAL',featured:true,variants:variants('SH-OXF',[['Sky Blue','SKY'],['White','WHT']],['M','L','XL'],1499) },
  { id:'p2',slug:'linen-blend-casual-shirt',name:'Linen Blend Casual Shirt',category:'Shirts',description:'Lightweight summer-ready texture with relaxed tailoring.',fabric:'Linen blend',fit:'Relaxed fit',swatch:'#dfd2bb',label:'THE WEEKEND EDIT',featured:true,variants:variants('SH-LIN',[['Sand','SND'],['Olive','OLV']],['M','L','XL'],1799) },
  { id:'p3',slug:'tailored-formal-trousers',name:'Tailored Formal Trousers',category:'Formal Pants',description:'Sharp drape and all-day comfort for smart dressing.',fabric:'Poly-viscose',fit:'Tailored fit',swatch:'#5b626c',label:'WORKDAY ESSENTIAL',featured:true,variants:variants('PT-FOR',[['Charcoal','CHC'],['Black','BLK']],['30','32','34'],1999) },
  { id:'p4',slug:'everyday-cotton-chinos',name:'Everyday Cotton Chinos',category:'Cotton Pants',description:'Versatile twill chinos for effortless daily dressing.',fabric:'Cotton twill',fit:'Slim straight',swatch:'#b8a88d',label:'EVERYDAY REFINED',featured:true,variants:variants('PT-CHI',[['Stone','STN'],['Olive','OLV']],['30','32','34'],1699) },
  { id:'p5',slug:'selvedge-look-denim',name:'Classic Denim Jeans',category:'Denim Pants',description:'Deep-indigo wash with a comfortable modern leg.',fabric:'Cotton denim',fit:'Straight fit',swatch:'#445a78',label:'DENIM STORIES',featured:false,variants:variants('DN-CLS',[['Indigo','IND']],['30','32','34'],2199) },
  { id:'p6',slug:'utility-cotton-cargo',name:'Utility Cotton Cargo',category:'Cotton Cargo',description:'Purposeful pocket detailing meets a clean city silhouette.',fabric:'Cotton',fit:'Relaxed tapered',swatch:'#849078',label:'URBAN UTILITY',featured:false,variants:variants('CG-UTL',[['Sage','SAG'],['Black','BLK']],['30','32','34'],1899) },
  { id:'p7',slug:'pique-polo-tshirt',name:'Piqué Polo T-Shirt',category:'Polo T-Shirts',description:'Fine piqué knit with a tonal button placket.',fabric:'Cotton piqué',fit:'Regular fit',swatch:'#e2d6be',label:'CASUAL PRECISION',featured:true,variants:variants('PO-PIQ',[['Ecru','ECR'],['Navy','NVY']],['M','L','XL'],1199) },
  { id:'p8',slug:'essential-crewneck-tee',name:'Essential Crewneck Tee',category:'Round-Neck T-Shirts',description:'An everyday crewneck in soft, breathable jersey.',fabric:'Cotton jersey',fit:'Regular fit',swatch:'#a7a3a4',label:'THE BASICS',featured:false,variants:variants('TS-CRW',[['Ash Grey','ASH'],['Black','BLK']],['M','L','XL'],799) }
];
export const initialLocations = [
  { id:'warehouse-hyd', name:'Hyderabad Warehouse',type:'warehouse',onlineEligible:true },
  { id:'store-hyd-01', name:'Hyderabad Store 01',type:'store',onlineEligible:true }
];
export function generateMockStock(products=initialProducts) {
  const stock = {};
  for (const product of products) for (const variant of product.variants) {
    stock[variant.sku] = { 'warehouse-hyd': 6, 'store-hyd-01': 4 };
  }
  return stock;
}
export const policies = { version:'TC-DEV-7.0', rulesVersion:policyRulesVersion, effectiveDate:policyEffectiveDate, title:'TRENDISE Development Terms & Conditions', text:[
  'This is a fictional Development-only checkout. No real payment, shipment or SMS will occur.',
  'Products, prices, discounts and availability shown here are sample data and not commercial offers.',
  'Your entered delivery address is used only by this local demonstration and is not transmitted to a courier.',
  'The virtual try-on feature is a placeholder and will not process your photographs in Development.',
  'A real legal Terms & Conditions and Privacy Policy must be approved before UAT/Production.'
] };
