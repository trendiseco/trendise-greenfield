// A one-item coupon illustration; checkout validates customer and basket eligibility.
export function productOffer(price,coupons=[]){
 if(!Number.isFinite(price)||price<=0)return null;
 let best=null;
 for(const c of coupons){
 if(price<c.minOrder||!['percent','fixed'].includes(c.type)||!(c.value>0))continue;
 let discount=c.type==='percent'?Math.round(price*c.value)/100:c.value;
 if(c.maxDiscount>0)discount=Math.min(discount,c.maxDiscount);
 discount=Math.round(Math.min(price,discount)*100)/100;
 if(discount>0&&(!best||discount>best.discount))best={code:c.code,discount,total:Math.round((price-discount)*100)/100};
 }
 return best;
}
