import assert from 'node:assert/strict';
import test from 'node:test';
import {applyShipmentEvent,authorizeShipmentEvent} from '../src/shipment-events.mjs';

test('tracking matches a saved order, retains missed delivery and ignores duplicate or older status',()=>{
 const order={status:'shipped',shiprocketOrder:{shipmentId:1,orderId:2,reference:'TRD-UAT-1',status:'NEW'}};
 const core={orders:new Map([['TRD-10001',order]])};
 const event={shipment_id:1,sr_order_id:2,order_id:'TRD-UAT-1',awb:'12345',current_status:'UNDELIVERED',current_timestamp:'2026-11-13 15:15:00',scans:[{activity:'Customer unavailable',location:'Demo'}]};
 assert.throws(()=>authorizeShipmentEvent('fixture','invalid'),{status:401});
 assert.doesNotThrow(()=>authorizeShipmentEvent('fixture','fixture'));
 assert.equal(applyShipmentEvent(core,{...event,shipment_id:9,sr_order_id:8,order_id:'unknown'}).matched,false);
 assert.throws(()=>applyShipmentEvent(core,{...event,sr_order_id:8}),{status:409});
 assert.equal(applyShipmentEvent(core,event).matched,true);
 assert.equal(applyShipmentEvent(core,event).duplicate,true);
 assert.equal(order.shiprocketOrder.events[0].activity,'Customer unavailable');
 assert.equal(order.shiprocketOrder.status,'UNDELIVERED');
 assert.equal(order.status,'shipped');
 assert.equal(order.deliveredAt,undefined);
 applyShipmentEvent(core,{...event,current_status:'IN TRANSIT',current_timestamp:'2026-11-13 14:00:00'});
 assert.equal(order.shiprocketOrder.status,'UNDELIVERED');
 applyShipmentEvent(core,{...event,current_status:'DELIVERED',current_timestamp:'2026-11-14 10:00:00'});
 assert.equal(order.status,'delivered');
 assert.equal(order.deliveredAt,'2026-11-14T04:30:00.000Z');
});
