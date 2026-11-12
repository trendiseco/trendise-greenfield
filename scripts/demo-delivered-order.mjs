import {DurableCommerce,poolFor} from '../apps/api/src/database.mjs';
import {cancellationMs,orderEligibility} from '../shared/order-policy.mjs';
import {warehousePickCode} from '../shared/warehouse-pick.mjs';

if(process.env.TRENDISE_ENV!=='development'||process.env.MOCK_ONLY!=='true'||process.env.NODE_ENV==='production')throw new Error('This command only runs in the mock development environment');
const completeReturn=process.argv.includes('--complete-return');
const phone='9876543210',scenario=completeReturn?'completed-return-demo':'delivered-return-window';
const pool=poolFor();
try{
 const c=new DurableCommerce(pool);
 const result=await c.unit(async()=>{
  const existing=[...c.orders.values()].find(o=>o.demoScenario===scenario&&o.phone===phone&&orderEligibility(o,c.orderNow()).canReturn);
  if(existing&&!completeReturn)return existing;
  const variant=c.products.flatMap(p=>p.websiteVisible===false?[]:p.variants).find(v=>v.active!==false&&c.available(v.sku)>0);
  if(!variant)throw new Error('No website stock available for the demo order');
  const customer={role:'customer',phone},warehouse={role:'warehouse',userId:'warehouse'};
  const now=Date.now();
  // Stage the placement time before the hold. Dispatch and delivery use the real current time.
  c.clock=()=>new Date(now-cancellationMs-60000);
  const {orderId}=await c.placeOrder(customer,{items:[{sku:variant.sku,qty:1}],paymentMethod:'cod',acceptedPolicyVersion:c.version,address:{name:'TRENDISE Demo Shopper',phone,line1:'10 Demo Road',city:'Hyderabad',district:'Hyderabad',state:'Telangana',pincode:'500001'}},'delivered-demo-'+crypto.randomUUID());
  c.clock=()=>new Date(now);
  await c.warehouseVerify(warehouse,orderId,warehousePickCode(orderId,0),variant.barcode);
  await c.dispatch(warehouse,orderId);await c.markDelivered(warehouse,orderId);
  const order=c.orders.get(orderId);order.demoScenario=scenario;
  if(completeReturn){
   await c.requestOrderReturn(customer,orderId,{sku:variant.sku,reason:'fit',conditionConfirmed:true,note:'Demo return: the fit was not right.'});
   await c.reviewOrderCase({role:'admin',userId:'admin'},orderId,{caseKey:'return:'+variant.sku,decision:'approved',note:'Your return is approved. The warehouse will check the item when it arrives.'});
   await c.receiveOrderReturn(warehouse,orderId,{sku:variant.sku,barcode:variant.barcode,quantity:1});
  }
  return order;
 });
 console.log(JSON.stringify({orderId:result.id,phone,status:result.status,deliveredAt:result.deliveredAt,returnUntil:orderEligibility(result).returnUntil,returnRequest:result.returnRequests?.[0]}));
}finally{await pool.end();}
