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
 const warehouse=(await send(base,'/api/auth/staff',{method:'POST',body:{role:'warehouse',pin:'1234'}})).data.token;
 const verify=await send(base,`/api/warehouse/orders/${orderId}/scan`,{method:'POST',token:warehouse,body:{pickCode:`PICK-${orderId}-${sku}`,barcode:`PICK-${orderId}-${sku}`}});assert.equal(verify.data.complete,true);
 const ship=await send(base,`/api/warehouse/orders/${orderId}/dispatch`,{method:'POST',token:warehouse,body:{}});assert.equal(ship.data.shipment.provider,'MOCK_SHIPROCKET');
 const pos=(await send(base,'/api/auth/staff',{method:'POST',body:{role:'pos',pin:'1234'}})).data.token;
 const afterOnline=(await send(base,'/api/pos/inventory',{token:pos})).data.products[0].variants[0].available;
 assert.equal(afterOnline,products[0].variants[0].available-1);
 const sale=await send(base,'/api/pos/sales',{method:'POST',token:pos,key:'http-pos-sale-001',body:{items:[{sku,qty:1}],customer:{name:'Test Buyer',phone:'9876543210'},paymentMethod:'Cash'}});assert.equal(sale.status,201);
 const after=(await send(base,'/api/products')).data.products[0].variants[0].available;
 assert.equal(after,afterOnline-1);
 assert.equal((await send(base,'/api/products/availability')).data.available[sku],after);
 assert.equal(core.stock[sku]['warehouse-hyd'],after);
 assert.equal(core.stock[sku]['store-hyd-01'],4);
 const denied=await send(base,'/api/admin/summary',{token:pos});assert.equal(denied.status,403);
 const cancelled=await send(base,`/api/orders/${orderId}/cancel`,{method:'POST',token:customer,body:{}});
 assert.equal(cancelled.data.cancellationReturn.status,'pending');
 assert.equal(core.stock[sku]['warehouse-hyd'],after);
 const receipt=await send(base,`/api/warehouse/orders/${orderId}/cancellation-receipt`,{method:'POST',token:warehouse,body:{sku,barcode:core.product(sku).variant.barcode,sellable:1,reason:'Returned sealed',received:true}});
 assert.equal(receipt.data.cancellationReturn.status,'received');
 assert.equal(core.stock[sku]['warehouse-hyd'],after+1);
});

test('staff sign-in, portal grants, delegated permissions and revocation',async t=>{
 const {server,base}=await start();t.after(()=>server.close());
 const post=(path,body,token)=>send(base,path,{method:'POST',body,token});
 const root=await post('/api/auth/staff',{userId:'superadmin',pin:'1234'});
 assert.equal(root.status,200);
 const admin=root.data.token;
 assert.ok(root.data.permissions.includes('users.manage'));
 const role={name:'warehouse-picker',permissions:['warehouse.scan']};
 assert.equal((await post('/api/admin/roles',role,admin)).status,200);
 const staff={id:'picker-test',name:'Picker',role:role.name,locationId:'warehouse-hyd',active:true,pin:'641572'};
 assert.equal((await post('/api/admin/users',staff,admin)).status,200);
 assert.equal((await post('/api/auth/staff',{userId:staff.id,pin:'1234'})).status,401);
 const login=await post('/api/auth/staff',{userId:staff.id,pin:staff.pin});
 assert.equal(login.status,200);
 assert.deepEqual(new Set(login.data.permissions),new Set(['warehouse.read','warehouse.scan']));
 assert.equal(login.data.locationType,'warehouse');
 const token=login.data.token;
 assert.equal((await send(base,'/api/warehouse/orders',{token})).status,200);
 assert.equal((await post('/api/warehouse/orders/TRD-99999/scan',{pickCode:'x',barcode:'x'},token)).status,404);
 for(const path of ['/api/admin/access','/api/admin/audit','/api/admin/customer-extract','/api/pos/inventory']){
  assert.equal((await send(base,path,{token})).status,403,path);
 }
 assert.equal((await post('/api/warehouse/orders/TRD-99999/dispatch',{},token)).status,403);
 assert.equal((await post('/api/admin/roles',{...role,permissions:['users.manage']},admin)).status,400);
 assert.equal((await post('/api/admin/roles',{...role,permissions:['warehouse.inventory']},admin)).status,200);
 assert.equal((await send(base,'/api/warehouse/orders',{token})).status,403);
 assert.equal((await send(base,'/api/warehouse/inventory',{token})).status,200);
 const access=await send(base,'/api/admin/access',{token:admin});
 assert.equal(access.data.users.find(user=>user.id===staff.id).pinCredential,undefined);
 const audit=await send(base,'/api/admin/audit',{token:admin});
 assert.ok(audit.data.entries.some(entry=>entry.type==='ROLE_SAVED'&&entry.actor==='superadmin'&&entry.permissions.includes('warehouse.inventory')));
 assert.equal((await post('/api/auth/staff/logout',{},token)).status,200);
 assert.equal((await send(base,'/api/me',{token})).status,401);
});
