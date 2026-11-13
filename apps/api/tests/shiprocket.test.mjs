import assert from 'node:assert/strict';
import test from 'node:test';
import {once} from 'node:events';
import {Commerce} from '../src/core.mjs';
import {createServer} from '../src/server.mjs';
import {createShiprocketLookup} from '../src/shiprocket.mjs';

test('Shiprocket lookup sends only parcel inputs and reuses authentication',async()=>{
 const requests=[];
 const lookup=createShiprocketLookup({SHIPROCKET_RATE_LOOKUP:'true',SHIPROCKET_API_EMAIL:'mock@example.invalid',SHIPROCKET_API_PASSWORD:'fixture'},async(url,options)=>{
  requests.push({url:new URL(url),options});
  return Response.json(url.endsWith('/auth/login')?{token:'fixture-token'}:{
   data:{available_courier_companies:[{courier_name:'Demo Courier',rate:'65.50',estimated_delivery_days:3}]}
  });
 });
 await assert.rejects(lookup({deliveryPin:'000000',weightKg:0.5,cod:true}),{status:400});
 assert.equal(requests.length,0);
 const data=await lookup({deliveryPin:'110001',weightKg:0.5,cod:true,address:'Must not leave TRENDISE'});
 await lookup({deliveryPin:'400001',weightKg:1,cod:false});
 assert.equal(requests.length,3);
 assert.ok(requests.every(({url})=>url.origin==='https://api-sandbox.shiprocket.in'));
 assert.equal(requests[0].url.pathname,'/v1/external/auth/login');
 assert.deepEqual(Object.fromEntries(requests[1].url.searchParams),{pickup_postcode:'501505',delivery_postcode:'110001',cod:'1',weight:'0.5'});
 assert.equal(requests[1].options.headers.Authorization,'Bearer fixture-token');
 assert.equal(requests[1].options.method,undefined);
 assert.deepEqual(data.couriers,[{name:'Demo Courier',rate:65.5,estimatedDays:'3'}]);
 await assert.rejects(createShiprocketLookup({})({}),{status:503});
});

test('the courier lookup endpoint only allows Admin and Super Admin',async()=>{
 const core=new Commerce();
 const server=createServer(core,async input=>({deliveryPin:input.deliveryPin,couriers:[]}));
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 try{
  const call=token=>fetch(`http://127.0.0.1:${server.address().port}/api/admin/shipping/rates`,{
   method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
   body:JSON.stringify({deliveryPin:'110001',weightKg:0.5,cod:true})
  });
  assert.equal((await call()).status,401);
  assert.equal((await call(core.staffLogin('warehouse','1234').token)).status,403);
  for(const role of ['admin','superadmin']){
   const response=await call(core.staffLogin(role,'1234').token);
   assert.equal(response.status,200);
   assert.deepEqual(await response.json(),{deliveryPin:'110001',couriers:[]});
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('plain-text sandbox denial is reported without exposing the provider body',async()=>{
 const config={SHIPROCKET_RATE_LOOKUP:'true',SHIPROCKET_API_EMAIL:'test@example.invalid',SHIPROCKET_API_PASSWORD:'fixture'};
 const calls=[];
 const lookup=createShiprocketLookup(config,async url=>{
  calls.push(url);
  return new Response('Access Denied. Private provider details.',{status:498});
 });
 await assert.rejects(lookup({deliveryPin:'110001',weightKg:0.5,cod:true}),{
  code:'SHIPROCKET_SANDBOX_ACCESS_DENIED',
  message:'Shiprocket sandbox denied backend authentication (HTTP 498). Verify external sandbox access with Shiprocket.'
 });
 assert.deepEqual(calls,['https://api-sandbox.shiprocket.in/v1/external/auth/login']);
});

test('production opt-in authenticates and performs only a courier GET',async()=>{
 const paths=[];
 const lookup=createShiprocketLookup({
  SHIPROCKET_RATE_LOOKUP:'true',SHIPROCKET_RATE_ENV:'production',
  SHIPROCKET_API_EMAIL:'test@example.invalid',SHIPROCKET_API_PASSWORD:'fixture'
 },async(url,options)=>{
  const parsed=new URL(url);
  assert.equal(parsed.origin,'https://apiv2.shiprocket.in');
  paths.push([options.method||'GET',parsed.pathname]);
  return Response.json(options.method==='POST'?{token:'fixture'}:{data:{available_courier_companies:[]}});
 });
 assert.equal((await lookup({deliveryPin:'110001',weightKg:0.5,cod:true})).environment,'production');
 assert.deepEqual(paths,[['POST','/v1/external/auth/login'],['GET','/v1/external/courier/serviceability']]);
});
