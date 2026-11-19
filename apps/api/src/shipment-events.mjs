import {orderCustomer} from './customer-identity.mjs';
import {timingSafeEqual} from 'node:crypto';
import {DomainError} from './errors.mjs';

export function authorizeShipmentEvent(secret,provided){
 if(!secret)throw new DomainError(503,'Shipment updates are disabled.');
 const expected=Buffer.from(secret),actual=Buffer.from(typeof provided==='string'?provided:'');
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new DomainError(401,'Invalid shipment update key.');
}

export function applyShipmentEvent(core,event){
 const value=key=>String(event?.[key]??'').trim();
 const identifiers=[
  ['shipmentId',value('shipment_id')],['orderId',value('sr_order_id')],
  ['reference',value('order_id')],['awb',value('awb')]
 ].filter(([,id])=>id&&id!=='0');
 const matches=[...core.orders.values()].filter(order=>order.shiprocketOrder&&identifiers.some(([key,id])=>String(order.shiprocketOrder[key])===id));
 if(!matches.length)return {matched:false};
 if(matches.length!==1)throw new DomainError(409,'Shipment identifiers match different orders.');
 const order=matches[0],shipment=order.shiprocketOrder;
 if(identifiers.some(([key,id])=>key!=='awb'&&String(shipment[key])!==id))throw new DomainError(409,'Shipment identifiers conflict.');
 const awb=value('awb');
 if(awb&&awb!=='0'&&!/^[a-z0-9-]{1,50}$/i.test(awb))throw new DomainError(400,'Invalid AWB.');
 if(awb&&awb!=='0'&&shipment.awb&&shipment.awb!==awb)throw new DomainError(409,'AWB conflicts with saved shipment.');
 const status=value('current_status')||value('shipment_status');
 let timestamp=value('current_timestamp').replace(' ','T');
 if(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(timestamp))timestamp+='+05:30';
 const time=Date.parse(timestamp);
 if(!status||status.length>120||!Number.isFinite(time))throw new DomainError(400,'Shipment status and event timestamp are required.');
 const at=new Date(time).toISOString();
 const code=value('current_status_id').slice(0,16);
 const scan=Array.isArray(event.scans)?event.scans[0]:null;
 const activity=typeof scan?.activity==='string'?scan.activity.trim().slice(0,240):'';
 const history=shipment.events??[];
 if(history.some(e=>e.at===at&&e.status===status&&e.code===code&&e.activity===activity))return {matched:true,duplicate:true};
 shipment.revision=(shipment.revision||0)+1;
 shipment.events=[...history,{at,status,code,activity}].sort((a,b)=>a.at.localeCompare(b.at)).slice(-100);
 if(awb&&awb!=='0')shipment.awb=awb;
 if(!shipment.updatedAt||at>=shipment.updatedAt){
  shipment.status=status;
  shipment.updatedAt=at;
  if(status.toUpperCase()==='DELIVERED'&&!order.deliveredAt&&order.status!=='cancelled'){
   order.status='delivered';order.deliveredAt=at;
   if(order.payment?.status==='due_on_delivery'){
    order.payment.status='mock_collected';
    core.earnOrderPoints(orderCustomer(order),order);
   }
  }
 }
 return {matched:true};
}
