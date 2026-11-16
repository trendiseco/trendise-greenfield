import test from 'node:test';
import assert from 'node:assert/strict';
import { Commerce, DomainError } from '../src/core.mjs';
const c=()=>new Commerce();
const signin=(app,phone='9876543210')=>{app.requestOtp(phone);return app.session(app.verifyOtp(phone,'123456').token,['customer']);};
const address={name:'Test Buyer',phone:'9876543210',line1:'12 Example Lane',city:'Hyderabad',state:'Telangana',pincode:'500001'};

test('fresh demo catalogue uses unique barcodes per SKU',()=>{const app=c();assert.equal(app.products.length,8);assert.equal(app.ensureUniqueBarcodes(),true);assert.equal(app.listing()[0].variants[0].available,6);});
test('store sale atomically reduces customer-visible inventory',async()=>{
 const app=c(),sku=app.products[0].variants[0].sku;const before=app.available(sku);
 const session=app.session(app.staffLogin('pos','1234').token,['pos']);
 app.savePosPromotion({role:'superadmin'},{sku,type:'percent',value:10});
 const response=await app.completePosSale(session,{items:[{sku,qty:1}],customer:{name:'Test Buyer',phone:'9876543210'},paymentMethod:'Cash',idempotencyKey:'test-pos-01'});
 assert.equal(response.sale.quote.discount,149.9);assert.equal(app.available(sku),before-1);
 assert.equal(app.stock[sku]['store-hyd-01'],4);assert.equal(app.stock[sku]['warehouse-hyd'],5);assert.equal(app.ledger.at(-1).reason,'MOCK_POS_SALE');
});
test('duplicate POS submission does not duplicate stock deduction',async()=>{
 const app=c(),sku=app.products[0].variants[0].sku,session=app.session(app.staffLogin('pos','1234').token);
 const body={items:[{sku,qty:1}],customer:{name:'Test Buyer',phone:'9876543210'},paymentMethod:'UPI',idempotencyKey:'duplicate-pos-001'};
 const [a,b]=await Promise.all([app.completePosSale(session,body),app.completePosSale(session,body)]);
 assert.equal(a.sale.id,b.sale.id);assert.equal(app.available(sku),5);assert.equal(app.ledger.length,1);
});
test('online checkout requires accepted current T&C and complete address',async()=>{
 const app=c(),session=signin(app),sku=app.products[0].variants[0].sku;
 await assert.rejects(()=>app.startCheckout(session,{items:[{sku,qty:1}],address,acceptedPolicyVersion:''}),e=>e.code==='TERMS_REQUIRED');
 await assert.rejects(()=>app.startCheckout(session,{items:[{sku,qty:1}],address:{...address,pincode:'x'},acceptedPolicyVersion:app.version}),e=>e.status===400);
});
test('mock payment converts reservation once and creates warehouse order',async()=>{
 const app=c(),session=signin(app),sku=app.products[0].variants[0].sku;
 const r=await app.startCheckout(session,{items:[{sku,qty:2}],address,acceptedPolicyVersion:app.version,coupon:'WELCOME10'});
 assert.equal(app.available(sku),4);
 const a=await app.confirmMockPayment(session,r.reservationId,'payment-001');
 const b=await app.confirmMockPayment(session,r.reservationId,'payment-001');
 assert.equal(a.orderId,b.orderId);assert.equal(app.orders.size,1);assert.equal(app.available(sku),4);
 assert.equal(app.ledger.length,1);assert.equal(a.order.acceptedPolicyVersion,app.version);
});
test('warehouse rejects wrong pick code and barcode; dispatch blocked until full verification',async()=>{
 const app=c(),session=signin(app),sku=app.products[0].variants[0].sku;
 const r=await app.startCheckout(session,{items:[{sku,qty:2}],address,acceptedPolicyVersion:app.version});
 const {orderId}=await app.confirmMockPayment(session,r.reservationId,'payment-002');
 app.clock=()=>new Date(Date.parse(app.orders.get(orderId).placedAt)+12*60*60*1000);
 const warehouse=app.session(app.staffLogin('warehouse','1234').token);
 const pickCode=`PICK-${orderId}-${sku}`, barcode=app.product(sku).variant.barcode, wrong=app.products[1].variants[0].barcode;
 await assert.rejects(()=>app.warehouseVerify(warehouse,orderId,'PICK-TRD-99999-XX',barcode),e=>e.code==='WRONG_PICK_CODE');
 await assert.rejects(()=>app.warehouseVerify(warehouse,orderId,barcode,barcode),e=>e.code==='WRONG_PICK_CODE'&&e.message.includes('Field 1 contains a garment barcode'));
 assert.equal(app.orders.get(orderId).verified[sku]||0,0);
 await assert.rejects(()=>app.warehouseVerify(warehouse,orderId,pickCode,wrong),e=>e.code==='WRONG_BARCODE'&&e.message.includes(barcode)&&e.message.includes(sku));
 await assert.rejects(()=>app.dispatch(warehouse,orderId),e=>e.status===409);
 await app.warehouseVerify(warehouse,orderId,pickCode,barcode);
 await assert.rejects(()=>app.dispatch(warehouse,orderId),e=>e.status===409);
 const checked=await app.warehouseVerify(warehouse,orderId,pickCode,barcode);
 assert.equal(checked.complete,true);
 const shipped=await app.dispatch(warehouse,orderId);assert.equal(shipped.status,'shipped');assert.equal(shipped.shipment.provider,'MOCK_SHIPROCKET');
});
test('customer account cannot access POS or warehouse actions',async()=>{const app=c(),session=signin(app);await assert.rejects(()=>app.completePosSale(session,{items:[],idempotencyKey:'xabc123'}),e=>e.status===403);});
test('cannot oversell the shared pool, even with simultaneous POS requests',async()=>{
 const app=c(),sku=app.products[0].variants[0].sku,session=app.session(app.staffLogin('pos','1234').token);
 app.stock[sku]['warehouse-hyd']=4;
 const run=key=>app.completePosSale(session,{items:[{sku,qty:3}],customer:{name:'Test Buyer',phone:'9876543210'},paymentMethod:'Cash',idempotencyKey:key});
 const outcomes=await Promise.allSettled([run('pos-parallel-a'),run('pos-parallel-b')]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(app.stock[sku]['warehouse-hyd'],1);assert.equal(app.ledger.length,1);
});

test('idempotency key cannot be reused for a different financial request',async()=>{
 const app=c(),sku=app.products[0].variants[0].sku,session=app.session(app.staffLogin('pos','1234').token);
 await app.completePosSale(session,{items:[{sku,qty:1}],customer:{name:'Test Buyer',phone:'9876543210'},paymentMethod:'Cash',idempotencyKey:'pos-immutable-key'});
 await assert.rejects(()=>app.completePosSale(session,{items:[{sku,qty:2}],customer:{name:'Test Buyer',phone:'9876543210'},paymentMethod:'Cash',idempotencyKey:'pos-immutable-key'}),e=>e.code==='IDEMPOTENCY_CONFLICT');
 assert.equal(app.ledger.length,1);
});
test('store POS cannot sell warehouse inventory reserved online',async()=>{
 const app=c(),session=signin(app),sku=app.products[0].variants[0].sku;
 // Hold 5 pieces in the central warehouse.
 await app.startCheckout(session,{items:[{sku,qty:5}],address,acceptedPolicyVersion:app.version});
 const pos=app.session(app.staffLogin('pos','1234').token);
 await assert.rejects(()=>app.completePosSale(pos,{items:[{sku,qty:2}],customer:{name:'Test Buyer',phone:'9876543210'},paymentMethod:'Cash',idempotencyKey:'held-online-key'}),e=>e.code==='INSUFFICIENT_STOCK');
 assert.equal(app.available(sku),1);
});

test('warehouse-only stock is available to POS and website from the same balance',async()=>{
 const app=c(),sku=app.products[0].variants[0].sku;
 const pos=app.session(app.staffLogin('pos','1234').token);
 app.stock[sku]['store-hyd-01']=0;
 app.stock[sku]['warehouse-hyd']=5;
 const posAvailable=()=>app.posInventory(pos).products.flatMap(p=>p.variants).find(v=>v.sku===sku).available;
 assert.equal(posAvailable(),5);
 assert.equal(app.available(sku),5);
 await app.startCheckout(signin(app),{items:[{sku,qty:3}],address,acceptedPolicyVersion:app.version});
 assert.equal(posAvailable(),2);
 await app.completePosSale(pos,{items:[{sku,qty:2}],customer:{name:'Test Buyer',phone:'9876543210'},paymentMethod:'Cash',idempotencyKey:'shared-pool-sale'});
 assert.equal(app.stock[sku]['warehouse-hyd'],3);
 assert.equal(app.ledger.at(-1).locationId,'warehouse-hyd');
 assert.equal(posAvailable(),0);
 assert.equal(app.available(sku),0);
});
