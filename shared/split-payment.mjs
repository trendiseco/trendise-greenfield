export const splitOriginPin='501505';
export const splitMinimumKm=1000;
// Reference point for PIN 501505, from the bundled India Post snapshot.
const origin=[17.32886,78.64281];
const radians=degrees=>degrees*Math.PI/180;
export function deliveryDistanceKm(entry){
 const lat=entry?.[2],lon=entry?.[3];
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 const a=Math.sin(radians(lat-origin[0])/2)**2+Math.cos(radians(origin[0]))*Math.cos(radians(lat))*Math.sin(radians(lon-origin[1])/2)**2;
 return 6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))));
}
export function codEligible(entry){const km=deliveryDistanceKm(entry);return km!==null&&km<=splitMinimumKm;}
export function splitEligible(entry){const km=deliveryDistanceKm(entry);return km!==null&&km>=splitMinimumKm;}
export function splitAmounts(total){
 const paise=Math.round(total*100);
 const upfront=Math.round(paise*0.3);
 return {upfront:upfront/100,remaining:(paise-upfront)/100};
}
