import {DomainError} from './errors.mjs';

const hosts={sandbox:'https://api-sandbox.shiprocket.in',production:'https://apiv2.shiprocket.in'};
const pinPattern=/^[1-9]\d{5}$/;

export function createShiprocketLookup(env=process.env,request=fetch){
 const environment=env.SHIPROCKET_RATE_ENV||'sandbox';
 const host=Object.hasOwn(hosts,environment)?hosts[environment]:null;
 const label='Shiprocket '+environment;
 let cachedLogin;
 async function call(path,options){
  let response;
  try{
   response=await request(host+'/v1/external'+path,{...options,headers:{Accept:'application/json',...options.headers},signal:AbortSignal.timeout(8000),redirect:'error'});
  }catch{
   throw new DomainError(502,'Could not reach the '+label+'. Please retry.');
  }
  if(response.status===498||response.status===403){
   const step=path==='/auth/login'?'authentication':'courier lookup';
   throw new DomainError(502,`${label} denied backend ${step} (HTTP ${response.status}). Verify external ${environment} access with Shiprocket.`,environment==='sandbox'?'SHIPROCKET_SANDBOX_ACCESS_DENIED':'SHIPROCKET_PRODUCTION_ACCESS_DENIED');
  }
  if(!response.ok)return {status:response.status,ok:false};
  try{
   return {status:response.status,ok:true,data:await response.json()};
  }catch{
   throw new DomainError(502,label+' returned an unreadable response.');
  }
 }
 async function login(){
  if(cachedLogin&&cachedLogin.expires>Date.now())return cachedLogin.promise;
  const promise=call('/auth/login',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({email:env.SHIPROCKET_API_EMAIL,password:env.SHIPROCKET_API_PASSWORD})
  }).then(({ok,status,data})=>{
   if(!ok||typeof data?.token!=='string'||!data.token)throw new DomainError(502,label+' sign-in failed (HTTP '+status+'). Check the API user credentials.');
   return data.token;
  }).catch(error=>{cachedLogin=undefined;throw error;});
  cachedLogin={promise,expires:Date.now()+5*60*1000};
  return promise;
 }
 return async function lookup(input){
  if(env.SHIPROCKET_RATE_LOOKUP!=='true'||!env.SHIPROCKET_API_EMAIL||!env.SHIPROCKET_API_PASSWORD){
   throw new DomainError(503,'Shiprocket rate lookup is not configured for this server.');
  }
  if(!host)throw new DomainError(503,'Choose sandbox or production for Shiprocket rate lookup.');
  const pickup=env.SHIPROCKET_PICKUP_PIN||'501505';
  const {deliveryPin,weightKg,cod}=input||{};
  if(typeof deliveryPin!=='string'||!pinPattern.test(deliveryPin)||!pinPattern.test(pickup)||
    !Number.isFinite(weightKg)||weightKg<=0||weightKg>30||typeof cod!=='boolean'){
   throw new DomainError(400,'Enter a valid Indian PIN, a package weight up to 30 kg, and a payment type.');
  }
  const token=await login();
  const params=new URLSearchParams({pickup_postcode:pickup,delivery_postcode:deliveryPin,cod:cod?'1':'0',weight:String(weightKg)});
  const {ok,status,data}=await call('/courier/serviceability?'+params,{headers:{Authorization:'Bearer '+token}});
  if(status===401)cachedLogin=undefined;
  if(!ok||!Array.isArray(data?.data?.available_courier_companies))throw new DomainError(502,'Shiprocket could not check this route. Verify the PIN and try again.');
  const couriers=data.data.available_courier_companies.map(row=>({
   name:String(row.courier_name||'Courier'),
   rate:row.rate!=null&&row.rate!==''&&Number.isFinite(Number(row.rate))?Number(row.rate):null,
   estimatedDays:row.estimated_delivery_days==null?null:String(row.estimated_delivery_days)
  }));
  return {environment,pickupPin:pickup,deliveryPin,weightKg,cod,couriers};
 };
}
