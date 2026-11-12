import {readFileSync} from 'node:fs';
const cache=new Map();
export function lookupDeliveryPin(value){
 const pin=String(value??'').trim();
 if(!/^[1-9]\d{5}$/.test(pin))return null;
 const prefix=pin[0];
 if(!cache.has(prefix)){
  const source=new URL('../../web/public/data/india-pins/'+prefix+'.json',import.meta.url);
  cache.set(prefix,JSON.parse(readFileSync(source,'utf8')));
 }
 return cache.get(prefix)[pin]??null;
}
