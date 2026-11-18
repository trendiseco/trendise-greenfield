import test from 'node:test';
import assert from 'node:assert/strict';
import {adminDashboard} from '../src/admin-dashboard.mjs';
import {Commerce} from '../src/core.mjs';
import {cancellationMs} from '../../../shared/order-policy.mjs';

test('admin queue and decisions enforce permissions and preserve order and stock',async()=>{
 const c=new Commerce(),customer={role:'customer',phone:'9876543210'},warehouse={role:'warehouse'},admin={role:'admin',userId:'admin'};
 const v=c.products[0].variants[0];
 const body={items:[{sku:v.sku,qty:1}],paymentMethod:'cod',acceptedPolicyVersion:c.version,address:{name:'Test Shopper',phone:customer.phone,line1:'Demo road',city:'Hyderabad',state:'Telangana',pincode:'500001'}};
 const {order,orderId}=await c.placeOrder(customer,body,'admin-order-test');
 c.clock=()=>new Date(Date.parse(order.placedAt)+cancellationMs);
 await c.warehouseVerify(warehouse,orderId,`PICK-${orderId}-${v.sku}`,`PICK-${orderId}-${v.sku}`);
 await c.dispatch(warehouse,orderId);await c.markDelivered(warehouse,orderId);
 await c.requestOrderReturn(customer,orderId,{sku:v.sku,replacementSku:c.product(v.sku).product.variants[1].sku,reason:'fit',conditionConfirmed:true});
 const query=new URLSearchParams({status:'needs-review',q:'test shopper'});
 assert.throws(()=>c.adminOrderList(customer,query),{status:403});
 assert.throws(()=>c.adminOrderDetail(warehouse,orderId),{status:403});
 const result=c.adminOrderList(admin,query);
 assert.equal(result.orders.length,1);assert.equal(result.orders[0].pending,1);assert.equal(result.orders[0].address,undefined);
 const stock=c.available(v.sku),review={caseKey:'return:'+v.sku,decision:'approved',note:'Approved for inspection.'};
 await assert.rejects(c.reviewOrderCase(customer,orderId,review),{status:403});
 await assert.rejects(c.reviewOrderCase(admin,orderId,{...review,note:' '}),{status:400});
 const receipt={sku:v.sku,barcode:v.barcode,quantity:1};
 await assert.rejects(c.receiveOrderReturn(warehouse,orderId,receipt),{status:409});
 await c.reviewOrderCase(admin,orderId,review);
 await assert.rejects(c.reviewOrderCase(admin,orderId,review),{status:409});
 assert.equal(c.adminOrderList(admin,query).total,0);
 const [visible]=c.ordersFor(customer);assert.equal(visible.returnRequests[0].review.note,review.note);
 assert.equal(visible.status,'delivered');assert.equal(c.available(v.sku),stock);
 assert.equal(c.audit.at(-1).actor,'admin');assert.equal(c.audit.at(-1).decision,'approved');
 await assert.rejects(c.receiveOrderReturn(customer,orderId,receipt),{status:403});
 await assert.rejects(c.receiveOrderReturn(warehouse,orderId,{...receipt,barcode:'wrong'}),{status:400});
 await assert.rejects(c.receiveOrderReturn(warehouse,orderId,{...receipt,quantity:2}),{status:400});
 const received=await c.receiveOrderReturn(warehouse,orderId,receipt);
 const at=received.returnRequests[0].receivedAt;
 assert.ok(at);
 await c.receiveOrderReturn(warehouse,orderId,receipt);
 assert.equal(c.audit.filter(event=>event.type==='RETURN_RECEIVED').length,1);
 assert.equal(c.ordersFor(customer)[0].returnRequests[0].receivedAt,at);
 assert.equal(c.adminOrderDetail(admin,orderId).returnRequests[0].receivedAt,at);
 const returns=c.adminOrderList(admin,new URLSearchParams({status:'returns'}));
 assert.equal(returns.total,1);
 assert.equal(returns.orders[0].id,orderId);
 assert.equal(returns.orders[0].returns[0].receivedAt,at);
 for(const status of ['picking','shipped','cancelled']){
  assert.equal(c.adminOrderList(admin,new URLSearchParams({status})).total,0);
 }
 const dashboard=adminDashboard(c);
 assert.equal(dashboard.requests.return.approved,1);
 assert.equal(dashboard.returnsReceived,1);
 assert.equal(c.available(v.sku),stock);
});

test('exchange inspection creates one replacement and isolates failed stock',async()=>{
 const c=new Commerce(),customer={role:'customer',phone:'9876543210'},warehouse={role:'warehouse',userId:'warehouse'},admin={role:'admin'};
 const [first,second]=c.products[0].variants;
 const items=[{sku:first.sku,qty:1},{sku:second.sku,qty:2}];
 c.customer(customer).points=100;
 const {order,orderId}=await c.placeOrder(customer,{items,paymentMethod:'card',coupon:'WELCOME10',redeemPoints:10,acceptedPolicyVersion:c.version,address:{name:'Test Shopper',phone:customer.phone,line1:'Demo road',city:'Hyderabad',state:'Telangana',pincode:'500001'}},'return-inspection');
 c.clock=()=>new Date(Date.parse(order.placedAt)+cancellationMs);
 for(const [index,item] of items.entries()){
  const code=`LINE-${orderId}-${index+1}`;
  for(let count=0;count<item.qty;count++)await c.warehouseVerify(warehouse,orderId,code,code);
 }
 await c.dispatch(warehouse,orderId);await c.markDelivered(warehouse,orderId);
 const pass={sku:first.sku,decision:'pass',reason:'Tags intact and garment unused.'};
 await assert.rejects(c.inspectOrderReturn(warehouse,orderId,pass),{status:409});
 for(const variant of [first,second]){
  await c.requestOrderReturn(customer,orderId,{sku:variant.sku,replacementSku:c.products[0].variants[2].sku,reason:'fit',conditionConfirmed:true});
  await c.reviewOrderCase(admin,orderId,{caseKey:'return:'+variant.sku,decision:'approved',note:'Approved for inspection.'});
  await c.receiveOrderReturn(warehouse,orderId,{sku:variant.sku,barcode:variant.barcode,quantity:items.find(i=>i.sku===variant.sku).qty});
 }
 const firstStock=c.available(first.sku),secondStock=c.available(second.sku);
 await assert.rejects(c.inspectOrderReturn(customer,orderId,pass),{status:403});
 await assert.rejects(c.inspectOrderReturn(warehouse,orderId,{...pass,reason:' '}),{status:400});
 const replacementSku=c.products[0].variants[2].sku;
 const replacementBalances=c.stock[replacementSku];
 const replacementStock=replacementBalances['warehouse-hyd'];
 replacementBalances['warehouse-hyd']=0;
 await assert.rejects(c.inspectOrderReturn(warehouse,orderId,pass),{status:409});
 assert.equal(c.available(first.sku),firstStock);
 assert.equal(c.orders.size,1);
 assert.equal(c.orders.get(orderId).returnRequests[0].inspection,undefined);
 replacementBalances['warehouse-hyd']=replacementStock;
 const [settled,retried]=await Promise.all([c.inspectOrderReturn(warehouse,orderId,pass),c.inspectOrderReturn(warehouse,orderId,pass)]);
 const inspection=settled.returnRequests[0].inspection;
 assert.deepEqual(retried.returnRequests[0].inspection,inspection);
 assert.equal(inspection.refund,undefined);
 const replacement=c.orders.get(inspection.replacementOrderId);
 assert.equal(replacement.quote.total,0);
 assert.equal(replacement.payment.status,'no_payment_due');
 assert.equal(replacement.items[0].sku,c.products[0].variants[2].sku);
 assert.equal(c.available(replacement.items[0].sku),5);
 assert.ok(c.warehouseQueue(warehouse).some(row=>row.id===replacement.id));
 assert.equal(c.customer(customer).points,100-order.quote.redeemPoints+order.quote.earnPoints);
 assert.equal(c.available(first.sku),firstStock+1);
 await assert.rejects(c.inspectOrderReturn(warehouse,orderId,{...pass,decision:'fail'}),{status:409});
 const failed=await c.inspectOrderReturn(warehouse,orderId,{sku:second.sku,decision:'fail',reason:'Both garments have visible stains.'});
 assert.equal(failed.returnRequests[1].inspection.disposition,'quarantined');
 assert.equal(failed.returnRequests[1].inspection.quantity,2);
 assert.equal(failed.returnRequests[1].inspection.replacementOrderId,undefined);
 assert.equal(c.available(second.sku),secondStock);
 assert.equal(c.audit.filter(event=>event.type==='EXCHANGE_INSPECTED').length,2);
 assert.deepEqual(c.ordersFor(customer)[0].returnRequests,c.adminOrderDetail(admin,orderId).returnRequests);
 assert.deepEqual(adminDashboard(c).inspections,{passed:1,failed:1,quarantinedUnits:2,refunds:0});
});
