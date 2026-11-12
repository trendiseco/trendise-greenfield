export const isBottom=category=>['Formal Pants','Cotton Pants','Denim Pants','Cotton Cargo'].includes(category);
export function measurementFields(category){return isBottom(category)?[
 {key:'length',label:'Length / outseam',help:'Top of waistband to hem, along the outer leg.'},
 {key:'waistWidth',label:'Waist width (flat)',help:'Straight across the waistband with the garment laid flat.'},
 {key:'hipWidth',label:'Hip width (flat)',help:'Straight across the widest part of the seat.'},
 {key:'inseam',label:'Inseam',help:'Crotch seam to hem, along the inner leg.'},
 {key:'thighWidth',label:'Thigh width (flat)',help:'Across one leg just below the crotch seam.'},
 {key:'legOpening',label:'Leg opening (flat)',help:'Straight across the hem of one leg.'}
]:[
 {key:'length',label:'Body length',help:'Highest shoulder point, beside the neck, straight down to the hem.'},
 {key:'chestWidth',label:'Chest width (flat)',help:'Armpit to armpit, with the garment laid flat.'},
 {key:'shoulder',label:'Shoulder width',help:'Shoulder seam to shoulder seam across the back.'},
 {key:'sleeve',label:'Sleeve length',help:'Shoulder seam to the end of the sleeve.'}
];}
// Fictional development examples only; never represent these as measured TRENDISE stock.
export function sampleSizeChart(product){
 const bottom=isBottom(product.category),short=['Polo T-Shirts','Round-Neck T-Shirts'].includes(product.category);
 const sizes=[...new Set(product.variants.map(v=>v.size))];const known=bottom?['30','32','34']:['M','L','XL'];
 if(sizes.some(size=>!known.includes(size)))return null;
 return {unit:'cm',status:'sample',tolerance:1,notes:'Illustrative development values. Admin must replace these with measurements from the actual garment before marking the chart verified.',rows:sizes.map(size=>{const i=known.indexOf(size);return {size,...(bottom?{length:102+i,waistWidth:38+i*2.5,hipWidth:49+i*2.5,inseam:78,thighWidth:29+i,legOpening:17+i}:{length:72+i*2,chestWidth:52+i*3,shoulder:44+i*2,sleeve:short?22+i:62+i})};})};
}
export function blankSizeChart(product){return {unit:'cm',status:'sample',tolerance:1,notes:'',rows:[...new Set(product.variants.map(v=>v.size))].map(size=>({size,...Object.fromEntries(measurementFields(product.category).map(f=>[f.key,null]))}))};}
export function upgradeSizeChart(product){
 const seededSlugs=['oxford-formal-shirt','linen-blend-casual-shirt','tailored-formal-trousers','everyday-cotton-chinos','selvedge-look-denim','utility-cotton-cargo','pique-polo-tshirt','essential-crewneck-tee'];
 if(product.sizeChart===undefined&&seededSlugs.includes(product.slug))return {...product,sizeChart:sampleSizeChart(product)};
 return product;
}
export function validateSizeChart(chart,product){
 if(chart===undefined||chart===null)return null;
 const fail=message=>{throw new Error(message);};
 if(!['cm','in'].includes(chart.unit)||!['sample','verified'].includes(chart.status))fail('Select chart units and sample/verified status');
 if(typeof chart.tolerance!=='number'||!Number.isFinite(chart.tolerance)||chart.tolerance<0||chart.tolerance>5)fail('Measurement tolerance must be 0–5 in the selected unit');
 if(typeof chart.notes!=='string'||chart.notes.length>2000)fail('Size chart notes must be at most 2000 characters');
 const sizes=[...new Set(product.variants.map(v=>v.size))],fields=measurementFields(product.category),seen=new Set();
 if(!Array.isArray(chart.rows)||chart.rows.length>100)fail('Invalid size chart rows');
 const rows=chart.rows.map(row=>{if(!row||!sizes.includes(row.size)||seen.has(row.size))fail('Chart sizes must match product variants, with one row per size');seen.add(row.size);const result={size:row.size};
 for(const {key,label}of fields){const n=row[key];if(n===null||n===undefined||n===''){if(chart.status==='verified')fail('Verified charts require '+label+' for every size');result[key]=null;continue;}if(typeof n!=='number'||!Number.isFinite(n)||n<=0||n>(chart.unit==='cm'?300:120))fail(label+' must be a positive measurement within the selected unit');result[key]=Math.round(n*100)/100;}return result;});
 if(chart.status==='verified'&&sizes.some(size=>!seen.has(size)))fail('Verified charts require measurements for every variant size');
 return {unit:chart.unit,status:chart.status,tolerance:chart.tolerance,notes:chart.notes,rows};
}
export function convertMeasurement(value,from,to){if(value===null||value===undefined)return null;return Math.round((from===to?value:from==='cm'?value/2.54:value*2.54)*10)/10;}
