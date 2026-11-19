import {lookupDeliveryPin} from './pin-directory.mjs';
import {DomainError} from './errors.mjs';

export function mapAddress(feature,lat,lon){
 const p=feature?.properties;
 if(!p||p.countrycode?.toUpperCase()!=='IN')throw new DomainError(422,'Choose a delivery pin in India. No Indian address was found here.');
 const [foundLon,foundLat]=feature.geometry?.coordinates||[];
 if(!Number.isFinite(foundLat)||!Number.isFinite(foundLon)||Math.hypot((foundLat-lat)*111,(foundLon-lon)*111*Math.cos(lat*Math.PI/180))>2)throw new DomainError(422,'No nearby address was found. Move the pin closer to a road or enter the address manually.');
 const line1=[p.housenumber,p.street||p.name].filter(Boolean).join(', ');
 const city=p.city||p.town||p.village||'';
 const pincode=/^[1-9]\d{5}$/.test(p.postcode||'')?p.postcode:'';
 const postal=lookupDeliveryPin(pincode);
 return {line1,line2:p.locality||'',city,district:postal?.[0]||'',state:postal?.[1]||p.state||'',pincode,mapPin:{lat,lon},source:'OpenStreetMap / Photon'};
}

export function createDeliveryMap(env=process.env,request=fetch,now=Date.now){
 const endpoint=env.DELIVERY_GEOCODER_URL||'https://photon.komoot.io/reverse';
 const cache=new Map();let nextRequest=0;
 return async(lat,lon)=>{
  if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<6||lat>38||lon<68||lon>98)throw new DomainError(400,'Choose a valid delivery pin in India.');
  const key=lat.toFixed(5)+','+lon.toFixed(5),known=cache.get(key);
  if(known&&known.expires>now())return known.address;
  if(now()<nextRequest)throw new DomainError(429,'Please wait a moment before looking up another pin.');
  nextRequest=now()+1100;
  const url=new URL(endpoint);if(url.protocol!=='https:')throw new DomainError(503,'The address lookup service is not configured securely.');
  url.searchParams.set('lat',String(lat));url.searchParams.set('lon',String(lon));url.searchParams.set('lang','en');url.searchParams.set('limit','1');
  let data;
  try{const response=await request(url,{headers:{'User-Agent':'TRENDISE-delivery-map/1.0 (contact: trendise@trendise.co.in)'},signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw new Error();data=await response.json();}
  catch{throw new DomainError(502,'Address lookup is unavailable. Please retry or enter the address manually.');}
  const address=mapAddress(data.features?.[0],lat,lon);
  if(cache.size>=500)cache.delete(cache.keys().next().value);
  cache.set(key,{address,expires:now()+3600000});return address;
 };
}
