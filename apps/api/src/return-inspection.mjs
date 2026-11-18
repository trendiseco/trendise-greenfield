import {randomUUID} from 'node:crypto';
import {DomainError} from './errors.mjs';
import {orderCases} from '../../../shared/admin-orders.mjs';

// Allocate the original order amounts by merchandise value. Rounded boundaries
// make the sum of all line refunds equal the original net merchandise amount.
function lineShare(order,item,amount){
 const weight=line=>Math.round(line.lineTotal*100);
 const total=order.items.reduce((sum,line)=>sum+weight(line),0);
 if(!total)return 0;
 const before=order.items.slice(0,order.items.indexOf(item)).reduce((sum,line)=>sum+weight(line),0);
 return Math.round(amount*(before+weight(item))/total)-Math.round(amount*before/total);
}

export const returnInspectionMethods={
 async inspectOrderReturn(session,id,body){
  return this.serialized(()=>{
   this.permit(session,'warehouse.inspect');
   const order=this.orders.get(id);
   if(!order)throw new DomainError(404,'Order not found');
   const request=orderCases(order).find(entry=>entry.kind==='return'&&entry.request.sku===body.sku)?.request;
   if(order.status!=='delivered'||request?.status!=='approved'||!request.receivedAt){
    throw new DomainError(409,'Receive the approved return before inspecting it.');
   }
   const {decision}=body;
   const reason=typeof body.reason==='string'?body.reason.trim():'';
   if(!['pass','fail'].includes(decision)||reason.length<5||reason.length>500){
    throw new DomainError(400,'Choose pass or fail and enter a reason of 5–500 characters.');
   }
   if(request.inspection){
    if(request.inspection.decision!==decision||request.inspection.reason!==reason){
     throw new DomainError(409,'This return has already been inspected.');
    }
    return this.warehouseOrder(session,id);
   }
   const item=order.items.find(line=>line.sku===request.sku);
   const location=this.locations.find(l=>l.type==='warehouse');
   const balances=item&&this.stock[item.sku];
   if(!item||!location||!balances)throw new DomainError(409,'Return item or warehouse stock is unavailable.');
   const passed=decision==='pass';
   const before=balances[location.id]??0;
   if(passed&&before+item.qty>2147483647)throw new DomainError(409,'Warehouse stock balance is too large.');
   if(passed&&!['captured','mock_collected'].includes(order.payment.status)){
    throw new DomainError(409,'This order has no recorded payment to settle.');
   }
   const at=new Date(this.orderNow()).toISOString();
   const actor=session.userId||session.role;
   const netPaise=Math.max(0,Math.round((order.quote.total-(order.quote.shipping||0))*100));
   const refundAmount=passed?lineShare(order,item,netPaise)/100:0;
   const refund={amount:refundAmount,status:refundAmount>0?'mock_recorded':'not_due'};
   if(refundAmount>0)Object.assign(refund,{reference:'MOCK-RETURN-'+randomUUID(),recordedAt:at});

   const points={restored:0,reversed:0,unrecovered:0};
   if(passed){
    const customerSession={role:'customer',phone:order.phone};
    const customer=this.customer(customerSession);
    const earned=this.website.rewardLedger.filter(e=>e.ref===id&&e.type==='EARN').reduce((sum,e)=>sum+e.delta,0);
    points.restored=lineShare(order,item,order.quote.redeemPoints||0);
    const expected=lineShare(order,item,earned);
    points.reversed=Math.min(expected,this.customerView(customerSession).availablePoints+points.restored);
    points.unrecovered=expected-points.reversed;
    for(const [type,delta] of [['RETURN_REDEEM',points.restored],['RETURN_EARN',-points.reversed]]){
     if(!delta)continue;
     customer.points+=delta;
     this.website.rewardLedger.push({id:randomUUID(),phone:order.phone,delta,balance:customer.points,type,ref:id,sku:item.sku,at});
    }
    balances[location.id]=before+item.qty;
    this.ledger.push({id:randomUUID(),sku:item.sku,locationId:location.id,qty:item.qty,delta:item.qty,before,after:before+item.qty,reason:'RETURN_RESTOCK',ref:id,at});
   }
   request.inspection={decision,reason,at,quantity:item.qty,locationId:location.id,locationName:location.name,disposition:passed?'restocked':'quarantined',refund,points};
   this.audit.push({type:'RETURN_INSPECTED',id,sku:item.sku,decision,actor,at});
   return this.warehouseOrder(session,id);
  });
 }
};
