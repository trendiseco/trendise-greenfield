import {DomainError} from './errors.mjs';
import {orderCases,orderListLabels} from '../../../shared/admin-orders.mjs';

function requireManagement(session){
 if(!['admin','superadmin'].includes(session.role))throw new DomainError(403,'Admin access required');
}
export const adminOrderMethods={
 adminOrderList(session,query){
  requireManagement(session);
  const search=String(query.get('q')||'').trim().toLowerCase().slice(0,100);
  const status=query.get('status')||'all';
  if(status!=='paid'&&!Object.hasOwn(orderListLabels,status))throw new DomainError(400,'Invalid order filter');
  const matches=[...this.orders.values()].reverse().map(order=>{
   const cases=orderCases(order);
   const pending=cases.filter(({request})=>request.status==='requested').length;
   const returns=cases.filter(({kind})=>kind==='return').map(({request})=>({status:request.status,receivedAt:request.receivedAt,inspection:request.inspection?{decision:request.inspection.decision}:undefined}));
   return {id:order.id,status:order.status,placedAt:order.placedAt,total:order.quote.total,paymentMethod:order.payment.method||'card',itemCount:order.items.reduce((sum,i)=>sum+i.qty,0),pending,returns};
  }).filter(row=>{
   const order=this.orders.get(row.id);
   const matchesStatus={
    all:true,returns:row.returns.length>0,'needs-review':row.pending>0,
    confirmed:['confirmed','paid'].includes(row.status)
   };
   return (matchesStatus[status]??row.status===status)
    &&(!search||[row.id,order.address?.name,order.phone,order.address?.phone].some(value=>String(value||'').toLowerCase().includes(search)));
  });
  const pageSize=25,pageCount=Math.max(1,Math.ceil(matches.length/pageSize));
  const page=Math.min(pageCount,Math.max(1,Math.floor(Number(query.get('page'))||1)));
  return {orders:matches.slice((page-1)*pageSize,page*pageSize),total:matches.length,page,pageCount};
 },
 adminOrderDetail(session,id){
  requireManagement(session);
  const order=this.orders.get(id);
  if(!order)throw new DomainError(404,'Order not found');
  return structuredClone(order);
 },
 async reviewOrderCase(session,id,body){
  return this.serialized(()=>{
   requireManagement(session);
   const order=this.orders.get(id);
   if(!order)throw new DomainError(404,'Order not found');
   const entry=orderCases(order).find(item=>item.key===body.caseKey);
   if(!entry)throw new DomainError(404,'Customer request not found');
   const decision=body.decision,note=typeof body.note==='string'?body.note.trim():'';
   if(!['approved','rejected'].includes(decision)||note.length<5||note.length>500)throw new DomainError(400,'Choose a decision and write a customer-facing reason (5–500 characters).');
   if(entry.request.status!=='requested')throw new DomainError(409,'This request has already been reviewed.');
   entry.request.status=decision;
   entry.request.review={note,decidedAt:new Date(this.orderNow()).toISOString()};
   this.audit.push({type:'ORDER_REQUEST_REVIEWED',id,caseKey:entry.key,decision,actor:session.userId||session.role,at:entry.request.review.decidedAt});
   return structuredClone(order);
  });
 }
};
