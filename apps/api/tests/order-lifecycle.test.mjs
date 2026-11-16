import test from 'node:test';
import assert from 'node:assert/strict';
import {Commerce} from '../src/core.mjs';
import {cancellationMs,returnMs} from '../../../shared/order-policy.mjs';
const customer={role:'customer',phone:'9876543210'},warehouse={role:'warehouse'};
function setup(){
 const c=new Commerce(),v=c.products[0].variants[0];let now=Date.now();c.clock=()=>new Date(now);
 const body={items:[{sku:v.sku,qty:1}],address:{name:'Demo Buyer',phone:customer.phone,line1:'10 Test Road',city:'Hyderabad',state:'Telangana',pincode:'500001'},acceptedPolicyVersion:c.version};
 return {c,v,body,advance:ms=>now+=ms};
}
test('atomic checkout validates terms and payment, handles all three methods, and is safe to retry',async()=>{
 const {c,v,body}=setup(),before=c.available(v.sku);
 await assert.rejects(c.placeOrder(customer,{...body,paymentMethod:'bad'},'invalid-method'),{status:400});
 await assert.rejects(c.placeOrder(customer,{...body,acceptedPolicyVersion:'old'},'old-policy'),{code:'TERMS_REQUIRED'});
 assert.equal(c.reservations.size,0);
 for(const [method,status,provider]of [['cod','due_on_delivery','MOCK_COD'],['card','captured','MOCK_RAZORPAY'],['phonepe','captured','MOCK_PHONEPE']]){
 const payload={...body,paymentMethod:method};const [first,again]=await Promise.all([c.placeOrder(customer,payload,'test-'+method),c.placeOrder(customer,payload,'test-'+method)]);
 assert.equal(first.orderId,again.orderId);assert.equal(first.order.payment.status,status);assert.equal(first.order.payment.provider,provider);}
 assert.equal(c.available(v.sku),before-3);assert.equal(c.orders.size,3);
});
test('cancellation restores stock and coupon once, voids COD or refunds prepaid, and is owner-only',async()=>{
 const {c,v,body,advance}=setup(),before=c.available(v.sku);
 const {orderId}=await c.placeOrder(customer,{...body,paymentMethod:'phonepe',coupon:'WELCOME10'},'cancel-test');
 await assert.rejects(c.cancelOrder({...customer,phone:'9876543211'},orderId),{status:404});
 assert.equal(c.customerView(customer).availablePoints,0);
 advance(cancellationMs-1);assert.equal((await c.cancelOrder(customer,orderId)).payment.status,'mock_refunded');
 await c.cancelOrder(customer,orderId);assert.equal(c.available(v.sku),before);assert.equal(c.website.couponUses.length,0);assert.equal(c.customer(customer).points,0);
 const cod=await c.placeOrder(customer,{...body,paymentMethod:'cod'},'cancel-cod');assert.equal((await c.cancelOrder(customer,cod.orderId)).payment.status,'void');
});
test('dispatch waits for cancellation deadline; returns use delivery timestamp and checklist; issues remain reportable',async()=>{
 const {c,v,body,advance}=setup();const {orderId}=await c.placeOrder(customer,{...body,paymentMethod:'cod'},'return-flow');
 await c.warehouseVerify(warehouse,orderId,`PICK-${orderId}-${v.sku}`,`PICK-${orderId}-${v.sku}`);
 await assert.rejects(c.dispatch(warehouse,orderId),{status:409});advance(cancellationMs);
 await assert.rejects(c.cancelOrder(customer,orderId),{status:409});await c.dispatch(warehouse,orderId);
 await assert.rejects(c.requestOrderReturn(customer,orderId,{sku:v.sku,reason:'fit',conditionConfirmed:true}),{status:409});
 const delivered=await c.markDelivered(warehouse,orderId);assert.equal(delivered.payment.status,'mock_collected');
 await assert.rejects(c.requestOrderReturn(customer,orderId,{sku:v.sku,reason:'fit'}),{status:400});
 advance(returnMs);await assert.rejects(c.requestOrderReturn(customer,orderId,{sku:v.sku,reason:'fit',conditionConfirmed:true}),{status:409});
 const report=await c.requestOrderReturn(customer,orderId,{sku:v.sku,reason:'damaged',note:'Arrived with a torn seam.'});assert.equal(report.issueReport.status,'requested');
 const second=await c.placeOrder(customer,{...body,paymentMethod:'card'},'second-return');
 await c.warehouseVerify(warehouse,second.orderId,`PICK-${second.orderId}-${v.sku}`,`PICK-${second.orderId}-${v.sku}`);
 advance(cancellationMs);await c.dispatch(warehouse,second.orderId);await c.markDelivered(warehouse,second.orderId);advance(returnMs-1);
 const returned=await c.requestOrderReturn(customer,second.orderId,{sku:v.sku,reason:'fit',conditionConfirmed:true});assert.equal(returned.returnRequests[0].status,'requested');
 await assert.rejects(c.requestOrderReturn(customer,second.orderId,{sku:v.sku,reason:'fit',conditionConfirmed:true}),{status:409});
});
test('partial payment requires a distant PIN and splits the final discounted total',async()=>{
 const {c,v,body,advance}=setup();
 const pay=pin=>({...body,address:{...body.address,pincode:pin},paymentMethod:'split',coupon:'WELCOME10'});
 for(const pin of ['501505','500001','560001','999999'])await assert.rejects(c.placeOrder(customer,pay(pin),'near-'+pin),{code:'SPLIT_PAYMENT_UNAVAILABLE'});
 const {order,orderId}=await c.placeOrder(customer,pay('110001'),'split-far');
 assert.equal(order.status,'confirmed');assert.equal(order.payment.status,'partially_paid');
 assert.deepEqual(order.payment.split,{upfront:404.73,remaining:944.37});
 assert.equal(order.quote.gstRate,5);assert.equal(order.quote.gstAmount,64.24);assert.equal(order.quote.shipping,0);assert.equal(order.quote.total,1349.10);
 assert.equal(c.customerView(customer).profile.points,0);
 const cancelled=await c.cancelOrder(customer,orderId);assert.equal(cancelled.payment.mockRefundAmount,404.73);
 const next=await c.placeOrder(customer,pay('700001'),'split-delivery');
 await c.warehouseVerify(warehouse,next.orderId,`PICK-${next.orderId}-${v.sku}`,`PICK-${next.orderId}-${v.sku}`);
 advance(cancellationMs);await c.dispatch(warehouse,next.orderId);
 assert.equal((await c.markDelivered(warehouse,next.orderId)).payment.status,'mock_collected');
 assert.equal(c.customerView(customer).profile.points,next.order.quote.earnPoints);
});
