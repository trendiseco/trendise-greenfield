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
   const step=path==='/auth/login'?'authentication':path==='/orders/create/adhoc'?'order creation':'courier lookup';
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
 async function lookup(input){
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
 lookup.createCodOrder=async(order,parcel)=>{
  if(environment!=='production'||env.SHIPROCKET_RATE_LOOKUP!=='true'||!env.SHIPROCKET_API_EMAIL||!env.SHIPROCKET_API_PASSWORD){
   throw new DomainError(503,'Start TRENDISE with Shiprocket production credentials to export an order.');
  }
  if(order.payment.method!=='cod'||order.status!=='confirmed'||order.quote.discount){
   throw new DomainError(409,'This test export requires a confirmed COD order without discounts.');
  }
  const {pickupLocation,weight,length,breadth,height}=parcel;
  const address=order.address;
  if(typeof pickupLocation!=='string'||!pickupLocation.trim()||![weight,length,breadth,height].every(n=>Number.isFinite(n)&&n>0)||!/^\S+@\S+\.\S+$/.test(address.email||'')){
   throw new DomainError(400,'Provide a saved pickup name, package measurements and recipient email.');
  }
  const [firstName,...lastName]=address.name.trim().split(/\s+/);
  const reference='TRD-UAT-'+order.id.slice(4)+'-'+order.placedAt.replace(/\D/g,'');
  const payload={
   order_id:reference,order_date:order.placedAt.slice(0,10),pickup_location:pickupLocation.trim(),
   billing_customer_name:firstName,billing_last_name:lastName.join(' '),billing_address:address.line1,
   billing_address_2:address.line2||'',billing_city:address.city,billing_state:address.state,
   billing_pincode:Number(address.pincode),billing_country:'India',billing_email:address.email,
   billing_phone:Number(address.phone),shipping_is_billing:true,payment_method:'COD',
   order_items:order.items.map(item=>({name:item.name,sku:item.sku,units:item.qty,selling_price:item.unitPrice})),
   sub_total:order.quote.subtotal,shipping_charges:order.quote.shipping||0,weight,length,breadth,height
  };
  const token=await login();
  const {ok,status,data}=await call('/orders/create/adhoc',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)
  });
  if(!ok||!Number(data?.order_id)||!Number(data?.shipment_id)){
   throw new DomainError(502,`Shiprocket did not confirm order creation (HTTP ${status}). Check reference ${reference} in Shiprocket before retrying.`);
  }
  return {reference,orderId:data.order_id,shipmentId:data.shipment_id,status:data.status||'Created',awb:data.awb_code||null};
 };
 return lookup;

}
