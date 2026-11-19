import {customerIdentity} from './customer-identity.mjs';
import {centralWarehouseId} from './seed.mjs';
import {randomUUID} from 'node:crypto';
import {DomainError} from './errors.mjs';
import {orderCases} from '../../../shared/admin-orders.mjs';

export const returnInspectionMethods={
 async inspectOrderReturn(session,id,body){
  return this.serialized(()=>{
   this.permit(session,'warehouse.inspect');
   const order=this.orders.get(id);
   if(!order)throw new DomainError(404,'Order not found');
   const request=orderCases(order).find(entry=>entry.kind==='return'&&entry.request.sku===body.sku)?.request;
   if(order.status!=='delivered'||request?.status!=='approved'||!request.receivedAt){
    throw new DomainError(409,'Receive the approved exchange garment before inspecting it.');
   }
   const {decision}=body;
   const reason=typeof body.reason==='string'?body.reason.trim():'';
   if(!['pass','fail'].includes(decision)||reason.length<5||reason.length>500){
    throw new DomainError(400,'Choose pass or fail and enter a reason of 5–500 characters.');
   }
   if(request.inspection){
    if(request.inspection.decision!==decision||request.inspection.reason!==reason){
     throw new DomainError(409,'This garment has already been inspected.');
    }
    return this.warehouseOrder(session,id);
   }
   const item=order.items.find(line=>line.sku===request.sku);
   const location=this.locations.find(l=>l.id===centralWarehouseId);
   const balances=item&&this.stock[item.sku];
   if(!item||!location||!balances)throw new DomainError(409,'Original garment or warehouse stock is unavailable.');
   const passed=decision==='pass';
   const before=balances[location.id]??0;
   if(passed&&before+item.qty>2147483647)throw new DomainError(409,'Warehouse stock balance is too large.');
   const at=new Date(this.orderNow()).toISOString();
   let replacementOrderId;
   if(passed){
    // Honour the accepted quote. Earlier requests used a free same-product replacement.
    const legacySku=request.replacement?.sku??body.replacementSku;
    const legacyLine=()=> {
     if(!legacySku)throw new DomainError(400,'Enter a replacement SKU before completing this earlier request.');
     const {product,variant}=this.product(legacySku);
     if(product!==this.product(item.sku).product||legacySku===item.sku)throw new DomainError(409,'Choose another size or colour of the original product.');
     return {...item,sku:legacySku,qty:item.qty,color:variant.color,size:variant.size,unitPrice:0};
    };
    const exchange=request.exchange??{lines:[legacyLine()],subtotal:0,credit:0,difference:0};
    const allocations=this.allocations(exchange.lines);
    const lines=exchange.lines.map(line=>({
     ...line,barcode:this.product(line.sku).variant.barcode,lineTotal:Math.round(line.unitPrice*line.qty*100)/100,
    }));
    replacementOrderId=`TRD-${String(this.orders.size+10001).padStart(5,'0')}`;
    const replacementOrder={
     id:replacementOrderId,...customerIdentity(order),items:lines,address:structuredClone(order.address),
     quote:{items:lines,subtotal:exchange.subtotal,discount:exchange.credit,exchangeCredit:exchange.credit,
      couponDiscount:0,pointsDiscount:0,shipping:0,total:exchange.difference},
     payment:{method:'exchange',provider:exchange.difference?'MOCK_COD':'NONE',
      status:exchange.difference?'due_on_delivery':'no_payment_due'},
     status:'confirmed',placedAt:at,allocations,verified:{},shipment:null,
     exchangeFor:{orderId:id,sku:item.sku},acceptedPolicyVersion:order.acceptedPolicyVersion,
    };
    for(const allocation of allocations)this.decrement(allocation,'EXCHANGE_REPLACEMENT',replacementOrderId);
    balances[location.id]=before+item.qty;
    this.ledger.push({id:randomUUID(),sku:item.sku,locationId:location.id,qty:item.qty,delta:item.qty,before,after:before+item.qty,reason:'EXCHANGE_RESTOCK',ref:id,at});
    request.replacement=exchange.lines[0];
    this.orders.set(replacementOrderId,replacementOrder);
   }
   request.inspection={decision,reason,at,quantity:item.qty,locationId:location.id,locationName:location.name,
    disposition:passed?'restocked':'quarantined',...(replacementOrderId?{replacementOrderId}:{})};
   this.audit.push({type:'EXCHANGE_INSPECTED',id,sku:item.sku,decision,actor:session.userId||session.role,at});
   return this.warehouseOrder(session,id);
  });
 }
};
