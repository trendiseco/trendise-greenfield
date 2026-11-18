import {centralBalances} from './warehouse-inventory.mjs';
import {createHash} from 'node:crypto';
import {createCustomerOtp} from './customer-otp.mjs';
import {authorizeShipmentEvent,applyShipmentEvent} from './shipment-events.mjs';
import {createShiprocketLookup} from './shiprocket.mjs';
import {adminDashboard} from './admin-dashboard.mjs';
import {policyDocument} from '../../../shared/order-policy.mjs';
import http from 'node:http';
import { URL } from 'node:url';
import { Commerce, DomainError, canonicalPhone } from './core.mjs';
import {DurableCommerce,poolFor} from './database.mjs';

if (process.env.NODE_ENV==='production') throw new Error('Mock API must not run in production mode.');
if (process.env.TRENDISE_ENV && process.env.TRENDISE_ENV!=='development') throw new Error('This mock API is hard-locked to Development; UAT/production use a separate deployment.');
if (process.env.MOCK_ONLY && process.env.MOCK_ONLY!=='true') throw new Error('Mock API must be MOCK_ONLY=true.');
let commerce;
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
 commerce=process.env.DATABASE_URL?new DurableCommerce(poolFor()):process.env.ALLOW_MEMORY==='true'?new Commerce():(()=>{throw new Error('DATABASE_URL required; explicit ALLOW_MEMORY=true is test/demo only');})();
}
const allowedOrigins=new Set(['http://localhost:3000','http://127.0.0.1:3000','http://localhost:3001','http://127.0.0.1:3001']);
const port=Number(process.env.API_PORT||4100);
const respond=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
async function bodyOf(req){
  let text='';for await(const chunk of req){text+=chunk;if(text.length>36000000)throw new DomainError(413,'Request too large');}
  if(!text)return {};
  try{return JSON.parse(text);}catch{throw new DomainError(400,'Invalid JSON');}
}
function tokenFrom(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):'';}

const ratePath='/api/admin/shipping/rates';
export function createServer(core=commerce,lookupRates=createShiprocketLookup(),customerOtp=createCustomerOtp()){
 if(customerOtp)core.requireVerifiedSms=true;
const handle=async (req,res)=>{
  const origin=req.headers.origin||'';
  if(allowedOrigins.has(origin)){
    res.setHeader('access-control-allow-origin',origin);
    res.setHeader('vary','origin');
    res.setHeader('access-control-allow-headers','content-type,authorization,x-idempotency-key');
    res.setHeader('access-control-allow-methods','GET,POST,OPTIONS');
  }
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  const is=(method,route)=>req.method===method&&path===route;
  try{
    if(is('POST','/api/delivery/events')){
      authorizeShipmentEvent(process.env.SHIPROCKET_WEBHOOK_SECRET,req.headers['x-api-key']);
      return respond(res,200,applyShipmentEvent(core,await bodyOf(req)));
    }
    if(is('GET','/api/health'))return respond(res,200,core.health());
    if(is('GET','/api/products'))return respond(res,200,{products:core.listing()});
    if(is('GET','/api/products/availability')){
      const available=Object.fromEntries(core.listing().flatMap(p=>p.variants.map(v=>[v.sku,v.available])));
      return respond(res,200,{available});
    }
    if(is('GET','/api/website'))return respond(res,200,core.websitePublic());
    const media=path.match(/^\/api\/media\/([a-f0-9-]+)$/);
    if(req.method==='GET'&&media){core.ensureWebsite();const file=core.website.media[media[1]];if(!file)throw new DomainError(404,'Media not found');res.writeHead(200,{'content-type':file.mime,'x-content-type-options':'nosniff','cache-control':'public, max-age=3600'});return res.end(Buffer.from(file.data,'base64'));}
    if(is('GET','/api/account'))return respond(res,200,core.customerView(core.session(tokenFrom(req),['customer'])));
    if(is('POST','/api/account'))return respond(res,200,await core.saveCustomer(core.session(tokenFrom(req),['customer']),await bodyOf(req)));
    if(is('POST','/api/checkout/quote'))return respond(res,200,core.onlineQuote(core.session(tokenFrom(req),['customer']),await bodyOf(req)));
    if(is('GET','/api/locations'))return respond(res,200,{locations:core.locations});
    if(is('GET','/api/policy'))return respond(res,200,policyDocument(core.policy));
    if(is('GET','/api/auth/customer-config'))return respond(res,200,customerOtp?.widget??{});
    if(is('POST','/api/auth/msg91/verify')){
      if(!customerOtp?.verifyWidget)throw new DomainError(404,'MSG91 widget sign-in is disabled');
      const {phone,accessToken}=await bodyOf(req);
      if(typeof accessToken!=='string'||accessToken.length>8192||!accessToken)throw new DomainError(400,'Missing SMS verification token');
      const key='msg91:'+createHash('sha256').update(accessToken).digest('hex');
      const verified=await customerOtp.verifyWidget(phone,accessToken);
      return await core.serialized(()=>{
        if(core.eventIds.has(key))throw new DomainError(409,'Request a new SMS code');
        const session=core.issueCustomerSession(verified,{smsVerified:true});
        core.setIdempotent(key,'used',true);
        return respond(res,200,session);
      });
    }
    if(is('POST','/api/auth/request-otp')){const b=await bodyOf(req);return respond(res,200,customerOtp?await customerOtp.send(b.phone):core.requestOtp(String(b.phone||'')));}
    if(is('POST','/api/auth/verify-otp')){const b=await bodyOf(req);return respond(res,200,customerOtp?core.issueCustomerSession(await customerOtp.verify(b.phone,String(b.otp||'')),{smsVerified:true}):core.verifyOtp(String(b.phone||''),String(b.otp||'')));}
    if(is('POST','/api/auth/staff')){const b=await bodyOf(req);return respond(res,200,core.staffLogin(String(b.role||''),String(b.pin||''),String(b.userId||b.role||'')));}
    if(is('GET','/api/me')){
      const session=core.session(tokenFrom(req));
      return respond(res,200,session.role==='customer'?session:core.staffProfile(session));
    }
    if(is('POST','/api/auth/staff/logout')){
      const token=tokenFrom(req),session=core.session(token);
      if(!session.userId)throw new DomainError(403,'Staff access required');
      core.sessions.delete(token);
      return respond(res,200,{signedOut:true});
    }
    if(is('POST','/api/checkout/place')){const s=core.session(tokenFrom(req),['customer']);return respond(res,201,await core.placeOrder(s,await bodyOf(req),req.headers['x-idempotency-key']));}
    if(is('POST','/api/checkout/reserve')){const s=core.session(tokenFrom(req),['customer']);return respond(res,201,await core.startCheckout(s,await bodyOf(req)));}
    if(is('POST','/api/payments/mock/confirm')){const s=core.session(tokenFrom(req),['customer']);const b=await bodyOf(req);return respond(res,200,await core.confirmMockPayment(s,String(b.reservationId||''),String(req.headers['x-idempotency-key']||b.idempotencyKey||'')));}
    const orderAction=path.match(/^\/api\/orders\/(TRD-\d+)\/(cancel|return)$/);
    if(req.method==='POST'&&orderAction){const s=core.session(tokenFrom(req),['customer']);return respond(res,200,orderAction[2]==='cancel'?await core.cancelOrder(s,orderAction[1]):await core.requestOrderReturn(s,orderAction[1],await bodyOf(req)));}
    const cancellationReceipt=path.match(/^\/api\/warehouse\/orders\/(TRD-\d+)\/cancellation-receipt$/);
    if(req.method==='POST'&&cancellationReceipt)return respond(res,200,await core.receiveCancellationReturn(core.session(tokenFrom(req)),cancellationReceipt[1],await bodyOf(req)));
    const receiveReturn=path.match(/^\/api\/warehouse\/orders\/(TRD-\d+)\/return-receipt$/);
    if(req.method==='POST'&&receiveReturn)return respond(res,200,await core.receiveOrderReturn(core.session(tokenFrom(req)),receiveReturn[1],await bodyOf(req)));
    const inspectReturn=path.match(/^\/api\/warehouse\/orders\/(TRD-\d+)\/return-inspection$/);
    if(req.method==='POST'&&inspectReturn)return respond(res,200,await core.inspectOrderReturn(core.session(tokenFrom(req)),inspectReturn[1],await bodyOf(req)));
    const delivered=path.match(/^\/api\/warehouse\/orders\/(TRD-\d+)\/delivered$/);
    if(req.method==='POST'&&delivered)return respond(res,200,await core.markDelivered(core.session(tokenFrom(req)),delivered[1]));
    if(is('GET','/api/orders')){const s=core.session(tokenFrom(req));return respond(res,200,{orders:core.ordersFor(s)});}
    if(is('POST','/api/pos/sales')){const s=core.session(tokenFrom(req));const b=await bodyOf(req);return respond(res,201,await core.completePosSale(s,{...b,idempotencyKey:String(req.headers['x-idempotency-key']||b.idempotencyKey||'')}));}
    if(is('GET','/api/pos/inventory'))return respond(res,200,core.posInventory(core.session(tokenFrom(req))));
    if(is('GET','/api/pos/dashboard'))return respond(res,200,core.posDashboard(core.session(tokenFrom(req)),url.searchParams.get('period')||'today',url.searchParams.get('year')));
    if(is('POST','/api/pos/examples'))return respond(res,200,await core.seedPosExamples(core.session(tokenFrom(req))));
    if(is('POST','/api/pos/customers/search')) {
      const staff=core.session(tokenFrom(req));
      const {phone}=await bodyOf(req);
      return respond(res,200,core.purchaseHistory(staff,canonicalPhone(phone)));
    }
    const posReturn=path.match(/^\/api\/pos\/sales\/(POS-\d+)\/returns$/);
    if(req.method==='POST'&&posReturn)return respond(res,200,await core.returnPosItem(core.session(tokenFrom(req)),posReturn[1],await bodyOf(req),req.headers['x-idempotency-key']));
    if(is('GET','/api/warehouse/inventory'))return respond(res,200,core.warehouseInventory(core.session(tokenFrom(req)),url.searchParams));
    if(is('GET','/api/warehouse/orders'))return respond(res,200,{orders:core.warehouseQueue(core.session(tokenFrom(req)))});
    const warehouseOrder=path.match(/^\/api\/warehouse\/orders\/(TRD-\d+)$/);
    if(req.method==='GET'&&warehouseOrder)return respond(res,200,core.warehouseOrder(core.session(tokenFrom(req)),warehouseOrder[1]));
    const verify=path.match(/^\/api\/warehouse\/orders\/(TRD-\d+)\/scan$/);
    if(req.method==='POST'&&verify){const s=core.session(tokenFrom(req));const b=await bodyOf(req);return respond(res,200,await core.warehouseVerify(s,verify[1],b.pickCode,b.barcode));}
    const ship=path.match(/^\/api\/warehouse\/orders\/(TRD-\d+)\/dispatch$/);
    if(req.method==='POST'&&ship){const s=core.session(tokenFrom(req));return respond(res,200,await core.dispatch(s,ship[1]));}
    if(is('POST',ratePath)){
      const authorize=()=>core.permit(core.session(tokenFrom(req)),'shipping.rates');
      if(core.unit)await core.unit(authorize,{readOnly:true});else authorize();
      return respond(res,200,await lookupRates(await bodyOf(req)));
    }
    const codExport=path.match(/^\/api\/admin\/shipping\/orders\/(TRD-\d+)$/);
    if(req.method==='POST'&&codExport){
      const staff=core.session(tokenFrom(req));
      core.permit(staff,'shipping.export');
      const order=core.orders.get(codExport[1]);
      if(!order)throw new DomainError(404,'Order not found');
      if(order.shiprocketOrder)return respond(res,200,order.shiprocketOrder);
      const parcel=await bodyOf(req);
      order.shiprocketOrder=await lookupRates.createCodOrder(order,parcel);
      core.event(staff,'SHIPROCKET_ORDER_CREATED',order.id);
      return respond(res,201,order.shiprocketOrder);
    }
    if(path.startsWith('/api/admin/')){
      const staff=core.session(tokenFrom(req));
      if(is('GET','/api/admin/customer-contact'))return respond(res,200,core.customerContact(staff));
      if(is('POST','/api/admin/customer-contact'))return respond(res,200,await core.saveCustomerContact(staff,await bodyOf(req)));
      if(is('GET','/api/admin/pos-terms'))return respond(res,200,core.posTermsSettings(staff));
      if(is('POST','/api/admin/pos-terms'))return respond(res,200,core.savePosTerms(staff,(await bodyOf(req))?.text));
      if(is('GET','/api/admin/website-promotions'))return respond(res,200,core.posPromotionList(staff,true));
      if(is('POST','/api/admin/website-promotions'))return respond(res,200,core.savePosPromotion(staff,await bodyOf(req),true));
      if(is('POST','/api/admin/website-price-import'))return respond(res,200,core.importPosPrices(staff,(await bodyOf(req))?.rows,true));
      if(is('GET','/api/admin/pos-promotions'))return respond(res,200,core.posPromotionList(staff));
      if(is('POST','/api/admin/pos-price-import'))return respond(res,200,core.importPosPrices(staff,(await bodyOf(req))?.rows));
      if(is('POST','/api/admin/pos-promotions'))return respond(res,200,core.savePosPromotion(staff,await bodyOf(req)));
      if(is('GET','/api/admin/customer-extract'))return respond(res,200,core.purchaseExtract(staff,Object.fromEntries(url.searchParams)));
      if(is('GET','/api/admin/orders'))return respond(res,200,core.adminOrderList(staff,url.searchParams));
      const adminOrder=path.match(/^\/api\/admin\/orders\/(TRD-\d+)$/);
      if(req.method==='GET'&&adminOrder)return respond(res,200,core.adminOrderDetail(staff,adminOrder[1]));
      const orderReview=path.match(/^\/api\/admin\/orders\/(TRD-\d+)\/review$/);
      if(req.method==='POST'&&orderReview)return respond(res,200,await core.reviewOrderCase(staff,orderReview[1],await bodyOf(req)));

      if(is('GET','/api/admin/website')){core.permit(staff,'website.read');core.ensureWebsite();return respond(res,200,{published:core.website.site,draft:core.website.siteDraft,media:Object.entries(core.website.media).map(([id,m])=>({url:'/api/media/'+id,name:m.name,mime:m.mime}))});}
      if(is('POST','/api/admin/website'))return respond(res,200,await core.saveWebsite(staff,await bodyOf(req)));
      if(is('POST','/api/admin/website/publish'))return respond(res,200,await core.publishWebsite(staff,await bodyOf(req)));
      if(is('POST','/api/admin/media'))return respond(res,201,await core.uploadMedia(staff,await bodyOf(req)));
      if(is('GET','/api/admin/offers')){core.permit(staff,'offers.read');core.ensureWebsite();return respond(res,200,{coupons:core.website.coupons,uses:core.website.couponUses});}
      if(is('POST','/api/admin/offers'))return respond(res,200,await core.saveCoupon(staff,await bodyOf(req)));
      if(is('GET','/api/admin/rewards')){core.permit(staff,'rewards.read');core.ensureWebsite();return respond(res,200,{rules:core.website.rules,customers:Object.values(core.website.customers),ledger:core.website.rewardLedger.slice(-100).reverse()});}
      if(is('POST','/api/admin/rewards'))return respond(res,200,await core.saveRewardRules(staff,await bodyOf(req)));
      if(is('POST','/api/admin/rewards/customer'))return respond(res,200,await core.adjustCustomer(staff,await bodyOf(req)));
      if(is('GET','/api/admin/catalog')){core.permit(staff,'catalog.read');return respond(res,200,{products:core.products,drafts:core.drafts,approvals:core.approvals,categories:core.catalogCategories(),hiddenCategories:core.hiddenCategories});}
      if(is('POST','/api/admin/categories/update'))return respond(res,200,await core.updateCatalogCategory(staff,await bodyOf(req)));
      if(is('POST','/api/admin/categories'))return respond(res,201,{categories:await core.addCatalogCategory(staff,await bodyOf(req))});
      if(is('POST','/api/admin/products'))return respond(res,200,await core.saveDraft(staff,await bodyOf(req)));
      const action=path.match(/^\/api\/admin\/products\/([^/]+)\/(submit|decide)$/);
      if(req.method==='POST'&&action){const b=await bodyOf(req);return respond(res,200,action[2]==='submit'?await core.submitDraft(staff,action[1],b.revision):await core.decideDraft(staff,action[1],b));}
      if(is('GET','/api/admin/access')){
        core.permit(staff,'users.manage');
        return respond(res,200,{users:core.users.map(({pinCredential,...user})=>user),roles:core.roles,locations:core.locations});
      }
      if(is('GET','/api/admin/audit')){
        core.permit(staff,'audit.read');
        return respond(res,200,{entries:core.audit.slice(-100).reverse()});
      }
      if(is('POST','/api/admin/users'))return respond(res,200,await core.saveUser(staff,await bodyOf(req)));
      if(is('POST','/api/admin/roles'))return respond(res,200,await core.saveRole(staff,await bodyOf(req)));
      if(is('GET','/api/admin/inventory')){core.permit(staff,'inventory.read');return respond(res,200,{stock:centralBalances(core),ledger:core.ledger.slice(-100)});}
      if(is('POST','/api/admin/inventory/receive'))return respond(res,200,await core.receiveStock(staff,await bodyOf(req)));
    if(is('GET','/api/admin/summary')){core.permit(staff,'reports.read');const period=url.searchParams.get('period');
      if(!period)return respond(res,200,adminDashboard(core));
      const pos=core.posDashboard(core.session(tokenFrom(req)),period,null,true);
      return respond(res,200,{...adminDashboard(core,period),pos:{bills:pos.sales.length,customers:pos.customers,gross:pos.gross,refunded:pos.refunded,net:pos.net,recentSales:pos.sales.slice(0,6).map(sale=>({id:sale.id,total:sale.quote.total,method:sale.payment.method})),exchanges:pos.exchanges}});}
    }
    if(is('POST','/api/tryon/mock')){core.session(tokenFrom(req),['customer']);const b=await bodyOf(req);if(!b.sku)throw new DomainError(400,'Select a product');core.product(b.sku);return respond(res,200,{status:'mock_only',generatedImage:null,message:'Virtual try-on generation is intentionally disabled in Development. No photos are uploaded to AI providers.'});}
    return respond(res,404,{error:'Endpoint not found',code:'NOT_FOUND'});
  }catch(err){
    if(core.unit&&path!==ratePath&&!(customerOtp&&req.method==='POST'&&path==='/api/auth/request-otp'))throw err;
    const status=err instanceof DomainError?err.status:500;
    if(status===500)console.error(err);
    return respond(res,status,{error:status===500?'Internal server error':err.message,code:err.code||'INTERNAL_ERROR'});
  }
};
return http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const smsSend=customerOtp&&req.method==='POST'&&path==='/api/auth/request-otp';
 if(!core.unit||smsSend||req.method==='OPTIONS'||(req.method==='POST'&&path===ratePath))return handle(req,res);
 let response;const buffered={setHeader:(...args)=>res.setHeader(...args),writeHead:(status,headers)=>{response={status,headers};},end:body=>{response={...response,body};}};
 // Account reads can initialize a profile. Other GET handlers only need a snapshot.
 const readOnly=req.method==='GET'&&path!=='/api/account';
 try{await core.unit(()=>handle(req,buffered),{readOnly});res.writeHead(response.status,response.headers);res.end(response.body);}catch(e){console.error(e);respond(res,e instanceof DomainError?e.status:503,{error:e instanceof DomainError?e.message:'Database transaction unavailable; no changes committed',code:e.code||'DATABASE_UNAVAILABLE'});}
});
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const customerOtp=createCustomerOtp();
  createServer(commerce,undefined,customerOtp).listen(port,'127.0.0.1',()=>console.log(`TRENDISE mock API at http://localhost:${port} (Development ONLY)`));
}
