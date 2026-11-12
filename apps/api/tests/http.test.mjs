import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../src/server.mjs';
import { Commerce } from '../src/core.mjs';

const address={name:'Demo Shopper',phone:'9876543210',line1:'12 Sample Street',city:'Hyderabad',state:'Telangana',pincode:'500001'};
async function start(){const core=new Commerce(),server=createServer(core);server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;return {core,server,base};}
async function send(base,path,{method='GET',token,body,key}={}){const headers={'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{ }),...(key?{'x-idempotency-key':key}:{ })};const res=await fetch(`${base}${path}`,{method,headers,...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json()};}

test('HTTP: full mock customer -> warehouse -> POS and shared catalog stock',async t=>{
 const {core,server,base}=await start();t.after(()=>server.close());
 const products=(await send(base,'/api/products')).data.products;
 assert.equal(products.length,8);
 const sku=products[0].variants[0].sku;
 const otp=await send(base,'/api/auth/request-otp',{method:'POST',body:{phone:'9876543210'}});assert.equal(otp.data.devOtp,'123456');
 const customer=(await send(base,'/api/auth/verify-otp',{method:'POST',body:{phone:'9876543210',otp:'123456'}})).data.token;
 const policy=(await send(base,'/api/policy')).data;
 const bad=await send(base,'/api/checkout/reserve',{method:'POST',token:customer,body:{items:[{sku,qty:1}],address,acceptedPolicyVersion:'wrong'}});assert.equal(bad.status,400);
 const hold=await send(base,'/api/checkout/reserve',{method:'POST',token:customer,body:{items:[{sku,qty:1}],address,acceptedPolicyVersion:policy.version}});assert.equal(hold.status,201);
 const paid=await send(base,'/api/payments/mock/confirm',{method:'POST',token:customer,key:'http-mock-payment',body:{reservationId:hold.data.reservationId}});assert.equal(paid.status,200);
 const orderId=paid.data.orderId;
 core.clock=()=>new Date(Date.parse(paid.data.order.placedAt)+12*60*60*1000);
 const warehouse=(await send(base,'/api/auth/staff',{method:'POST',body:{role:'warehouse',pin:'1234'}})).data.token;
 const verify=await send(base,`/api/warehouse/orders/${orderId}/scan`,{method:'POST',token:warehouse,body:{pickCode:`PICK-${orderId}-${sku}`,barcode:core.product(sku).variant.barcode}});assert.equal(verify.data.complete,true);
 const ship=await send(base,`/api/warehouse/orders/${orderId}/dispatch`,{method:'POST',token:warehouse,body:{}});assert.equal(ship.data.shipment.provider,'MOCK_SHIPROCKET');
 const pos=(await send(base,'/api/auth/staff',{method:'POST',body:{role:'pos',pin:'1234'}})).data.token;
 const sale=await send(base,'/api/pos/sales',{method:'POST',token:pos,key:'http-pos-sale-001',body:{items:[{sku,qty:1}],paymentMethod:'Cash',coupon:'STORE10'}});assert.equal(sale.status,201);
 const after=(await send(base,'/api/products')).data.products[0].variants[0].available;
 assert.equal(after,8);
 const denied=await send(base,'/api/admin/summary',{token:pos});assert.equal(denied.status,403);
});
