export const receiptFields={businessName:'Billing name',address:'Store address',phone:'Phone',email:'Email',gstin:'GSTIN',bankName:'Bank name',accountName:'Account holder',accountNumber:'Account number',ifsc:'IFSC'};
export function receiptLines(sale){
 return sale.items.map(item=>{
  const gross=Math.round(item.lineTotal*100),tax=Number.isFinite(item.gst)?Math.round(item.gst*100):null;
  return {...item,taxable:tax===null?null:(gross-tax)/100,netUnit:tax===null?null:(gross-tax)/100/item.qty};
 });
}
