import test from 'node:test';
import assert from 'node:assert/strict';
import {Commerce} from '../src/core.mjs';
import {warehousePickCode} from '../../../shared/warehouse-pick.mjs';

test('warehouse immediately sees placed orders and verifies the same order-line barcode on the pick list and physical label',async()=>{
 const c=new Commerce(),customer={role:'customer',phone:'9876543210'},warehouse={role:'warehouse'};
 const v=c.products[0].variants[0],other=c.products[0].variants[1];
 const body={items:[{sku:v.sku,qty:2},{sku:other.sku,qty:1}],paymentMethod:'cod',acceptedPolicyVersion:c.version,address:{name:'Test Shopper',phone:customer.phone,line1:'Demo road',city:'Hyderabad',state:'Telangana',pincode:'500001'}};
 const {orderId}=await c.placeOrder(customer,body,'warehouse-auto-queue');
 assert.deepEqual(c.warehouseQueue(warehouse).map(x=>[x.id,x.units]),[[orderId,3]]);
 assert.throws(()=>c.warehouseQueue(customer),{status:403});
 assert.throws(()=>c.warehouseOrder({role:'pos'},orderId),{status:403});
 const detail=c.warehouseOrder(warehouse,orderId);assert.equal(detail.items[0].barcode,v.barcode);assert.equal(detail.items[0].color,v.color);assert.ok(detail.allocations[0].locationName);
 const firstCode=warehousePickCode(orderId,0),secondCode=warehousePickCode(orderId,1);
 const foreignCode=warehousePickCode('TRD-99999',0);
 await assert.rejects(c.warehouseVerify(warehouse,orderId,foreignCode,foreignCode),{code:'WRONG_PICK_CODE'});
 await assert.rejects(c.warehouseVerify(warehouse,orderId,firstCode,secondCode),{code:'WRONG_BARCODE'});
 await assert.rejects(c.warehouseVerify(warehouse,orderId,firstCode,v.barcode),{code:'WRONG_BARCODE'});
 assert.deepEqual(c.warehouseOrder(warehouse,orderId).verified,{});
 const first=await c.warehouseVerify(warehouse,orderId,firstCode,firstCode);assert.equal(first.scanned,1);
 await c.warehouseVerify(warehouse,orderId,firstCode,firstCode);
 await assert.rejects(c.warehouseVerify(warehouse,orderId,firstCode,firstCode),{status:409});
 assert.equal((await c.warehouseVerify(warehouse,orderId,secondCode,secondCode)).complete,true);
 assert.equal(c.warehouseQueue(warehouse)[0].verifiedUnits,3);
 assert.equal((await c.dispatch(warehouse,orderId)).status,'shipped');
});

test('warehouse inventory lists all published variants, location balances and active checkout holds',async()=>{
 const c=new Commerce(),customer={role:'customer',phone:'9876543210'},warehouse={role:'warehouse'},v=c.products[0].variants[0];
 const body={items:[{sku:v.sku,qty:1}],acceptedPolicyVersion:c.version,address:{name:'Test Shopper',phone:customer.phone,line1:'Demo road',city:'Hyderabad',state:'Telangana',pincode:'500001'}};
 const {reservationId}=await c.startCheckout(customer,body);
 const [allocation]=c.reservations.get(reservationId).allocations;
 const query=new URLSearchParams({q:v.barcode,location:allocation.locationId});
 assert.throws(()=>c.warehouseInventory(customer,query),{status:403});
 const {items,total}=c.warehouseInventory(warehouse,query);
 assert.equal(total,1);assert.equal(items[0].sku,v.sku);
 assert.equal(items[0].totals.reserved,1);
 assert.equal(items[0].totals.available,items[0].totals.onHand-1);
 c.reservations.get(reservationId).expiresAt=Date.now()-1;
 assert.equal(c.warehouseInventory(warehouse,query).items[0].totals.reserved,0);
 v.active=false;c.products[0].websiteVisible=false;
 const inactive=c.warehouseInventory(warehouse,new URLSearchParams({q:v.sku,stock:'unavailable'})).items[0];
 assert.equal(inactive.active,false);assert.equal(inactive.websiteVisible,false);assert.equal(inactive.totals.available,0);
});
