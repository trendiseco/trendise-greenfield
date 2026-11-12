import {DomainError} from './errors.mjs';

const base='https://apiv2.shiprocket.in/v1/external';
const pinPattern=/^[1-9]\d{5}$/;

export function createShiprocketLookup(env=process.env,request=fetch){
 let cachedLogin;
 async function call(path,options){
  try{
   const response=await request(base+path,{...options,signal:AbortSignal.timeout(8000),redirect:'error'});
   return {status:response.status,ok:response.ok,data:await response.json()};
  }catch{
   throw new DomainError(502,'Shiprocket did not respond. Please retry.');
  }
 }
 async function login(){
  if(cachedLogin&&cachedLogin.expires>Date.now())return cachedLogin.promise;
  const promise=call('/auth/login',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({email:env.SHIPROCKET_API_EMAIL,password:env.SHIPROCKET_API_PASSWORD})
  }).then(({ok,data})=>{
   if(!ok||typeof data?.token!=='string'||!data.token)throw new DomainError(502,'Shiprocket sign-in failed. Check the dedicated API user credentials.');
   return data.token;
  }).catch(error=>{cachedLogin=undefined;throw error;});
  cachedLogin={promise,expires:Date.now()+5*60*1000};
  return promise;
 }
 return async function lookup(input){
  if(env.SHIPROCKET_RATE_LOOKUP!=='true'||!env.SHIPROCKET_API_EMAIL||!env.SHIPROCKET_API_PASSWORD){
   throw new DomainError(503,'Shiprocket rate lookup is not configured for this server.');
  }
  const pickup=env.SHIPROCKET_PICKUP_PIN||'501505';
  const {deliveryPin,weightKg,cod}=input||{};
  if(typeof deliveryPin!=='string'||!pinPattern.test(deliveryPin)||!pinPattern.test(pickup)||
    !Number.isFinite(weightKg)||weightKg<=0||weightKg>30||typeof cod!=='boolean'){
   throw new DomainError(400,'Enter a valid Indian PIN, a package weight up to 30 kg, and a payment type.');
  }
  const token=await login();
  const params=new URLSearchParams({pickup_postcode:pickup,delivery_postcode:deliveryPin,cod:cod?'1':'0',weight:String(weightKg)});
  const {ok,status,data}=await call('/courier/serviceability/?'+params,{headers:{Authorization:'Bearer '+token}});
  if(status===401)cachedLogin=undefined;
  if(!ok||!Array.isArray(data?.data?.available_courier_companies))throw new DomainError(502,'Shiprocket could not check this route. Verify the PIN and try again.');
  const couriers=data.data.available_courier_companies.map(row=>({
   name:String(row.courier_name||'Courier'),
   rate:row.rate!=null&&row.rate!==''&&Number.isFinite(Number(row.rate))?Number(row.rate):null,
   estimatedDays:row.estimated_delivery_days==null?null:String(row.estimated_delivery_days)
  }));
  return {pickupPin:pickup,deliveryPin,weightKg,cod,couriers};
 };
}
