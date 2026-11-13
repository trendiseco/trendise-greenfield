import {periodStart} from './pos.mjs';
import {orderCases,orderStatusLabels} from '../../../shared/admin-orders.mjs';
import {indiaDate} from './website.mjs';

const money=n=>Math.round(n*100)/100;
export function adminDashboard(core,period){
 const now=core.orderNow();
 const start=period?periodStart(period,now):-Infinity;
 const inPeriod=at=>!period||(Date.parse(at)>=start&&Date.parse(at)<=now);
 const orders=[...core.orders.values()].filter(order=>inPeriod(order.placedAt));
 const live=orders.filter(o=>o.status!=='cancelled');
 const status={confirmed:0,picking:0,shipped:0,delivered:0,cancelled:0};
 const requests={return:{requested:0,approved:0,rejected:0},issue:{requested:0,approved:0,rejected:0}};
 let returnsReceived=0;
 const inspections={passed:0,failed:0,quarantinedUnits:0,refunds:0};
 const payments={cod:0,card:0,phonepe:0,split:0};
 const days=Array.from({length:7},(_,i)=>({date:indiaDate(new Date(now-(6-i)*86400000)),orders:0}));
 for(const o of orders){
  const key=o.status==='paid'?'confirmed':o.status;if(Object.hasOwn(status,key))status[key]++;
  for(const {kind,request}of orderCases(o)){
   if(Object.hasOwn(requests[kind],request.status))requests[kind][request.status]++;
   if(kind==='return'&&request.receivedAt)returnsReceived++;
   if(kind==='return'&&request.inspection){
    const {decision,quantity,refund}=request.inspection;
    if(decision==='pass')inspections.passed++;
    else{inspections.failed++;inspections.quarantinedUnits+=quantity;}
    inspections.refunds+=refund.amount;
   }
  }
  const day=days.find(d=>d.date===indiaDate(new Date(o.placedAt)));if(day)day.orders++;
 }
 let orderValue=0,collected=0,cashDue=0;
 for(const o of live){
  const {method='card',status:paymentStatus,split}=o.payment;
  if(Object.hasOwn(payments,method))payments[method]++;
  orderValue+=o.quote.total;
  if(['captured','mock_collected'].includes(paymentStatus))collected+=o.quote.total;
  if(paymentStatus==='partially_paid'&&split){collected+=split.upfront;cashDue+=split.remaining;}
  if(paymentStatus==='due_on_delivery')cashDue+=o.quote.total;
 }
 const variants=core.products.flatMap(p=>p.variants);
 const held=new Map();
 for(const r of core.reservations.values())if(r.status==='active'&&r.expiresAt>Date.now())for(const a of r.allocations){const key=a.sku+'|'+a.locationId;held.set(key,(held.get(key)||0)+a.qty);}
 const locations=core.locations.map(l=>{
  let onHand=0,reserved=0,available=0;
  for(const v of variants){const n=core.stock[v.sku]?.[l.id]||0,r=held.get(v.sku+'|'+l.id)||0;onHand+=n;reserved+=r;if(v.active!==false)available+=Math.max(0,n-r);}
  return {id:l.id,name:l.name,onHand,reserved,available};
 });
 const onHand=locations.reduce((n,l)=>n+l.onHand,0),reserved=locations.reduce((n,l)=>n+l.reserved,0),available=locations.reduce((n,l)=>n+l.available,0);
 return {orders:orders.length,status,requests,returnsReceived,inspections:{...inspections,refunds:money(inspections.refunds)},payments,orderValue:money(orderValue),collected:money(collected),cashDue:money(cashDue),days,
  products:core.products.length,variants:variants.length,onHand,reserved,available,locations,customers:Object.keys(core.website.customers).length,
  pendingApprovals:Object.values(core.drafts).filter(d=>d.status==='pending').length,stockEvents:core.ledger.length,auditEvents:core.audit.length,
  recentOrders:orders.slice(-6).reverse().map(o=>({id:o.id,status:orderStatusLabels[o.status]||o.status,total:o.quote.total,placedAt:o.placedAt}))};
}
