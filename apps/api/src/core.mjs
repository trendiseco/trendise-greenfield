import {customerKey,belongsToCustomer,customerIdentity,orderCustomer} from './customer-identity.mjs';
import {effectivePermissions,reservedPermissions,staffPermissions} from '../../../shared/staff-access.mjs';
import {posMethods} from './pos.mjs';
import {warehouseInventory} from './warehouse-inventory.mjs';
import {resolvePickLine} from '../../../shared/warehouse-pick.mjs';
import {returnInspectionMethods} from './return-inspection.mjs';
import {adminOrderMethods} from './admin-orders.mjs';
import {splitAmounts,splitEligible,codEligible} from '../../../shared/split-payment.mjs';
import {lookupDeliveryPin} from './pin-directory.mjs';
import {orderEligibility,paymentLabels,returnReasons,policyDocument} from '../../../shared/order-policy.mjs';
import {upgradeSizeChart,validateSizeChart} from '../../../shared/size-chart.mjs';
import {websiteState,websiteMethods} from './website.mjs';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { centralWarehouseId, initialProducts, initialLocations, generateMockStock, policies } from './seed.mjs';

import {DomainError} from './errors.mjs';
export {DomainError} from './errors.mjs';
const clone = value => structuredClone(value);
export const canonicalPhone=phone=>{const value=String(phone).replace(/[\s-]/g,'');if(!/^(?:\+91|91)?[6-9]\d{9}$/.test(value))throw new DomainError(400,'Enter a valid Indian mobile number');return value.replace(/\D/g,'').slice(-10);};
const money = value => Math.round(value*100)/100;

export class Commerce {
  constructor() {
    this.website=websiteState();
    this.additionalCategories=[];
    this.hiddenCategories=[];
    this.posPromotions={};
    this.posTerms=null;
    this.posReceipt={};
    this.products=clone(initialProducts).map(upgradeSizeChart);
    this.drafts={}; this.approvals=[];
    this.roles={admin:['catalog.edit','catalog.submit','inventory.read','pos.sell','warehouse.fulfill','website.manage','offers.manage','rewards.manage'],superadmin:['*'],pos:['pos.sell'],warehouse:['warehouse.fulfill']};
    this.users=['admin','superadmin','pos','warehouse'].map(role=>({id:role,name:`Demo ${role}`,role,active:true,locationId:'store-hyd-01'}));
    this.locations=clone(initialLocations);
    this.stock=generateMockStock(this.products);
    this.reservations=new Map();
    this.orders=new Map();
    this.sales=new Map();
    this.sessions=new Map();
    this.otpRequests=new Map();
    this.ledger=[];
    this.audit=[];
    this.version=policies.version;
    this.policy=clone(policies);
    this.policyHistory={[this.version]:policyDocument(this.policy)};
    this.queue=Promise.resolve();
    this.eventIds=new Map();
  }
  getIdempotent(key,fingerprint){const previous=this.eventIds.get(key);if(!previous)return null;if(previous.fingerprint!==fingerprint)throw new DomainError(409,'Idempotency key was already used for a different request','IDEMPOTENCY_CONFLICT');return previous.result;}
  setIdempotent(key,fingerprint,result){this.eventIds.set(key,{fingerprint,result});}
  async serialized(fn) {
    const previous=this.queue;
    let release;
    this.queue=new Promise(resolve=>release=resolve);
    await previous;
    try { return await fn(); } finally { release(); }
  }
  product(sku) { for(const p of this.products){const v=p.variants.find(x=>x.sku===sku);if(v)return { product:p,variant:v };}throw new DomainError(404,'Product variant not found','SKU_NOT_FOUND'); }
  available(sku) {
    const found=this.product(sku);if(found.variant.active===false)return 0;
    this.expireReservations();
    const physical=this.stock[sku]?.[centralWarehouseId]??0;
    const reserved=[...this.reservations.values()].filter(r=>r.status==='active').reduce((sum,r)=>sum+r.allocations.filter(a=>a.sku===sku&&a.locationId===centralWarehouseId).reduce((qty,a)=>qty+a.qty,0),0);
    return Math.max(0,physical-reserved);
  }
  expireReservations() {
    const now=Date.now();
    for(const r of this.reservations.values()) if(r.status==='active'&&r.expiresAt<=now)r.status='expired';
  }
  listing(channel='online') {
    return this.products.filter(product=>!this.hiddenCategories.includes(product.category)&&(channel==='store'||product.websiteVisible!==false)).map(product=>({
      ...product,
      variants:product.variants.map(({posPrice,...variant})=>({
        ...variant, ...(channel==='store'?(posPrice!=null?{posPrice}:{}):this.websitePriceFields(variant)), available:this.available(variant.sku)
      }))
    }));
  }
  catalogBarcode(barcode) { for(const p of this.products)for(const v of p.variants)if(v.barcode===barcode)return {product:p,variant:v};throw new DomainError(404,'Barcode not found','BARCODE_NOT_FOUND'); }
  ensureUniqueBarcodes() {const codes=this.products.flatMap(p=>p.variants.map(v=>v.barcode));return new Set(codes).size===codes.length;}
  requestOtp(phone) {phone=canonicalPhone(phone);const normalized=phone.replace(/[\s-]/g,'');if(!/^(?:\+91|91)?[6-9]\d{9}$/.test(normalized))throw new DomainError(400,'Enter a valid Indian mobile number');this.otpRequests.set(phone,{code:'123456',expiresAt:Date.now()+300000});return {message:'Mock OTP generated (not sent)',devOtp:'123456',expiresInSeconds:300};}
  verifyOtp(phone,code) {phone=canonicalPhone(phone);const entry=this.otpRequests.get(phone);if(!entry||entry.expiresAt<Date.now()||entry.code!==code)throw new DomainError(401,'Incorrect or expired demo OTP');this.otpRequests.delete(phone);return this.issueCustomerSession(phone);}
  issueCustomerSession(phone,{smsVerified=false}={}) {
    const token=randomUUID();
    this.sessions.set(token,{role:'customer',phone,smsVerified,...(smsVerified?{expiresAt:Date.now()+86400000}:{})});
    return {token,role:'customer',phone};
  }
  staffLogin(role,pin,userId=role) {
    const user=this.users.find(entry=>entry.id===userId&&(!role||entry.role===role)&&entry.active);
    if(!user||!Object.hasOwn(this.roles,user.role)||!/^\d{4,12}$/.test(pin))throw new DomainError(401,'Invalid staff credentials');
    const credential=user.pinCredential;
    const demoUser=['admin','superadmin','pos','warehouse'].includes(user.id);
    const valid=credential
      ? timingSafeEqual(scryptSync(pin,credential.salt,32),Buffer.from(credential.hash,'hex'))
      : demoUser&&pin==='1234';
    if(!valid)throw new DomainError(401,'Invalid staff credentials');
    const token=randomUUID();
    this.sessions.set(token,{role:user.role,userId:user.id,locationId:user.locationId,expiresAt:Date.now()+8*60*60*1000});
    return {token,...this.staffProfile(this.sessions.get(token))};
  }
  staffProfile(session) {
    return {...session,locationType:this.locations.find(location=>location.id===session.locationId)?.type,permissions:effectivePermissions(session.role,this.roles[session.role])};
  }

  session(token,allowed) {const session=this.sessions.get(token);if(!session||(session.userId&&!session.expiresAt)||(session.expiresAt&&session.expiresAt<=Date.now())||(session.role==='customer'&&this.requireVerifiedSms&&!session.smsVerified&&!session.identityVerified))throw new DomainError(401,'Please log in');if(session.role==='customer')session.phone=String(session.phone).replace(/\D/g,'').slice(-10);if(session.userId){const user=this.users.find(u=>u.id===session.userId&&u.active);if(!user)throw new DomainError(401,'Staff access revoked');session.role=user.role;session.locationId=user.locationId;}if(allowed&&!allowed.includes(session.role))throw new DomainError(403,'You do not have permission for this action');return session;}
  normalizeLines(lines) {if(!Array.isArray(lines)||!lines.length)throw new DomainError(400,'Add at least one product');const map=new Map();for(const raw of lines){const sku=String(raw.sku||'');const qty=Number(raw.qty);if(!Number.isInteger(qty)||qty<1||qty>25)throw new DomainError(400,'Quantity must be between 1 and 25');if(this.product(sku).variant.active===false)throw new DomainError(409,'Variant is inactive');map.set(sku,(map.get(sku)||0)+qty);}return [...map].map(([sku,qty])=>{if(qty>25)throw new DomainError(400,'Maximum quantity exceeded');return {sku,qty};});}
  websitePriceFields(variant) {
    const {regularPrice,salePrice}=this.posPricing(variant,true);
    return {price:salePrice,regularPrice};
  }
  price(lines,channel,coupon) {
    const items=lines.map(line=>{const {product,variant}=this.product(line.sku);const price=channel==='online'?this.websitePriceFields(variant).price:variant.price;return {sku:line.sku,name:product.name,color:variant.color,size:variant.size,barcode:variant.barcode,qty:line.qty,unitPrice:price,lineTotal:money(price*line.qty)};});
    const subtotal=money(items.reduce((n,item)=>n+item.lineTotal,0));
    const allowed=channel==='store'?{}:{WELCOME10:0.10};
    if(coupon&&!Object.hasOwn(allowed,coupon))throw new DomainError(400,'Coupon is not valid for this sales channel','INVALID_COUPON');
    const discount=money(subtotal*(allowed[coupon]||0));
    return {items,subtotal,discount,shipping:0,total:money(subtotal-discount),currency:'INR',coupon:coupon||null,taxNote:'Illustrative tax-inclusive sample prices. GST rules not configured.'};
  }
  allocations(lines){
    return lines.map(({sku,qty})=>{
      if(qty>this.available(sku))throw new DomainError(409,`Not enough warehouse stock for ${sku}`,'INSUFFICIENT_STOCK');
      return {sku,qty,locationId:centralWarehouseId};
    });
  }
  addressCheck(address) {if(!address||typeof address!=='object'||!address.name?.trim()||!address.line1?.trim()||!address.city?.trim()||!address.state?.trim()||!/^\d{6}$/.test(String(address.pincode||'')))throw new DomainError(400,'Enter a complete delivery address and six-digit PIN code');if(!/^[6-9]\d{9}$/.test(String(address.phone||'')))throw new DomainError(400,'Enter a valid contact phone number');}
  async startCheckout(session,body) {return this.serialized(()=>this.reserveCheckout(session,body));}
  reserveCheckout(session,body){
    if(session.role!=='customer')throw new DomainError(403,'Customer login required');
    this.addressCheck(body.address);
    if(body.acceptedPolicyVersion!==this.version)throw new DomainError(400,'You must accept the current Terms & Conditions','TERMS_REQUIRED');
    const paymentMethod=body.paymentMethod??'card';
    if(typeof paymentMethod!=='string'||!Object.hasOwn(paymentLabels,paymentMethod)||paymentMethod==='exchange')throw new DomainError(400,'Choose a valid payment method');
    if(paymentMethod==='cod'&&!codEligible(lookupDeliveryPin(body.address.pincode)))throw new DomainError(400,'Cash on delivery is available only for verified PIN areas within 1,000 km of 501505.','COD_UNAVAILABLE');
    if(paymentMethod==='split'&&!splitEligible(lookupDeliveryPin(body.address.pincode)))throw new DomainError(400,'Partial payment is available only for verified PIN areas at least 1,000 km from 501505.','SPLIT_PAYMENT_UNAVAILABLE');
    const lines=this.normalizeLines(body.items);
    const quote=this.onlineQuote(session,body);
    const allocations=this.allocations(lines);
    const id=`R-${randomUUID().slice(0,8).toUpperCase()}`;
    this.reservations.set(id,{id,status:'active',paymentMethod,...customerIdentity(session),allocations,items:lines,quote,address:clone(body.address),acceptedPolicyVersion:this.version,acceptedAt:new Date().toISOString(),expiresAt:Date.now()+10*60*1000});
    return {reservationId:id,expiresAt:new Date(Date.now()+10*60*1000).toISOString(),quote,mockPaymentProvider:'MOCK_RAZORPAY',message:'No actual payment was initiated'};
  }
  async confirmMockPayment(session,reservationId,idempotencyKey){return this.serialized(()=>this.finishCheckout(session,reservationId,idempotencyKey));}
  finishCheckout(session,reservationId,idempotencyKey){
    if(session.role!=='customer')throw new DomainError(403,'Customer login required');
    if(!idempotencyKey||idempotencyKey.length<6)throw new DomainError(400,'Idempotency key required');
    const eventKey=`payment:${customerKey(session)}:${idempotencyKey}`;
    const known=this.getIdempotent(eventKey,reservationId);if(known)return known;
    const reservation=this.reservations.get(reservationId);
    if(!reservation||!belongsToCustomer(reservation,session))throw new DomainError(404,'Checkout reservation not found');
    if(reservation.status!=='active'||reservation.expiresAt<=Date.now())throw new DomainError(409,'Reservation expired or already processed','RESERVATION_EXPIRED');
    if(reservation.paymentMethod==='cod'&&!codEligible(lookupDeliveryPin(reservation.address.pincode)))throw new DomainError(400,'Cash on delivery is unavailable for this PIN. Start checkout with another payment method.','COD_UNAVAILABLE');
    if(reservation.acceptedPolicyVersion!==this.version)throw new DomainError(400,'Terms changed. Review and accept the current version.','TERMS_REQUIRED');
    if(reservation.quote.items.some(item=>this.hiddenCategories.includes(this.product(item.sku).product.category)))throw new DomainError(409,'A category on this bill is hidden. Start checkout again.');
    if((reservation.quote.redeemPoints||0)>this.customer(session).points)throw new DomainError(409,'Points balance changed; retry checkout');
    for(const allocation of reservation.allocations){if((this.stock[allocation.sku]?.[allocation.locationId]??0)<allocation.qty)throw new DomainError(409,'Inventory changed; please retry checkout');}
    for(const allocation of reservation.allocations)this.decrement(allocation,'MOCK_ONLINE_PAYMENT',reservationId);
    reservation.status='converted';
    const orderId=`TRD-${String(this.orders.size+10001).padStart(5,'0')}`;
    const method=reservation.paymentMethod||'card',cod=method==='cod',split=method==='split';
    const order={id:orderId,...customerIdentity(session),items:reservation.quote.items,quote:reservation.quote,address:reservation.address,status:cod||split?'confirmed':'paid',payment:{method,provider:split?'MOCK_SPLIT':cod?'MOCK_COD':method==='phonepe'?'MOCK_PHONEPE':'MOCK_RAZORPAY',status:split?'partially_paid':cod?'due_on_delivery':'captured',...(split?{split:splitAmounts(reservation.quote.total)}:{}),reference:cod?null:`MOCKPAY-${orderId}`},allocations:reservation.allocations,verified:{},shipment:null,placedAt:new Date(this.orderNow()).toISOString(),acceptedPolicyVersion:reservation.acceptedPolicyVersion,acceptedAt:reservation.acceptedAt,termsAcceptance:{accepted:true,version:reservation.acceptedPolicyVersion,customerId:customerKey(session),orderId,acceptedAt:reservation.acceptedAt}};
    this.applyWebsiteRewards(session,order);
    this.orders.set(orderId,order);
    this.audit.push({type:cod||split?'ORDER_CONFIRMED':'ORDER_PAID',id:orderId,at:new Date().toISOString()});
    const response={orderId,order:clone(order),message:cod?'Mock COD order placed. No money was collected.':'Mock payment approved. No money was charged.'};this.setIdempotent(eventKey,reservationId,response);return response;
  }
  async placeOrder(session,body,key){return this.serialized(()=>{
    if(session.role!=='customer')throw new DomainError(403,'Customer login required');
    if(typeof key!=='string'||key.length<6||key.length>100)throw new DomainError(400,'A checkout request key is required');
    const eventKey=`checkout:${customerKey(session)}:${key}`, fingerprint=JSON.stringify(body);
    const previous=this.getIdempotent(eventKey,fingerprint);if(previous)return previous;
    const {reservationId}=this.reserveCheckout(session,body);
    try{const result=this.finishCheckout(session,reservationId,'checkout-'+key);this.setIdempotent(eventKey,fingerprint,result);return result;}
    catch(error){this.reservations.delete(reservationId);throw error;}
  });}
  decrement(allocation,reason,ref){const before=this.stock[allocation.sku][allocation.locationId];this.stock[allocation.sku][allocation.locationId]-=allocation.qty;this.ledger.push({id:randomUUID(),sku:allocation.sku,locationId:allocation.locationId,delta:-allocation.qty,before,after:this.stock[allocation.sku][allocation.locationId],reason,ref,at:new Date().toISOString()});}
  async completePosSale(session,body){return this.serialized(()=>{
    this.permit(session,'pos.bill');
    const location=this.posLocation(session);
    const key=String(body.idempotencyKey||'');if(key.length<6)throw new DomainError(400,'Idempotency key required');
    const eventKey=`pos:${session.role}:${location.id}:${key}`;
    const name=typeof body.customer?.name==='string'?body.customer.name.trim():'';
    if(!name||name.length>100)throw new DomainError(400,'Enter the customer name');
    const customer={name,phone:canonicalPhone(body.customer?.phone)};
    const fingerprint=JSON.stringify({items:body.items,coupon:body.coupon||'',paymentMethod:body.paymentMethod,customer,expectedTotal:body.expectedTotal});
    const known=this.getIdempotent(eventKey,fingerprint);if(known)return known;
    const items=this.normalizeLines(body.items);
    if(body.coupon)throw new DomainError(400,'Store promotions are set by Super Admin and apply automatically','INVALID_COUPON');
    if(items.some(item=>this.hiddenCategories.includes(this.product(item.sku).product.category)))throw new DomainError(409,'Remove products in hidden categories before saving this bill.');
    const quote=this.posQuote(items);
    if(body.expectedTotal!==undefined&&quote.total!==body.expectedTotal)throw new DomainError(409,'Store prices changed. Refresh the bill before saving.');
    const allocations=this.allocations(items);
    if(!['Cash','UPI','Card'].includes(body.paymentMethod))throw new DomainError(400,'Select a mock store payment method');
    const id=`POS-${String(this.sales.size+1).padStart(5,'0')}`;
    for(const allocation of allocations)this.decrement(allocation,'MOCK_POS_SALE',id);
    const sale={id,items:quote.items,quote,locationId:location.id,locationName:location.name,customer,staffId:session.userId,receipt:clone(this.posReceipt||{}),terms:this.posReceiptTerms(),payment:{method:body.paymentMethod,status:'simulated',reference:`MOCK-${id}`},at:new Date(this.orderNow()).toISOString()};
    this.sales.set(id,sale);this.audit.push({type:'POS_SALE',id,at:sale.at});
    const response={sale:clone(sale),message:'Demo sale completed. No payment collected.'};this.setIdempotent(eventKey,fingerprint,response);return response;
  });}
  ordersFor(session) {
    if(session.role==='customer')return [...this.orders.values()].filter(order=>belongsToCustomer(order,session)).map(order=>{
      const eligibility=orderEligibility(order,this.orderNow());
      const items=order.items.map(item=>({...clone(item),...(eligibility.canReturn?{exchange:this.exchangeChoices(item,order.quote)}:{})}));
      return {...clone(order),...eligibility,items};
    });
    this.permit(session,'orders.read');
    return [...this.orders.values()].map(clone);
  }
  exchangeChoices(item, quote, online=true) {
    const {product:original}=this.product(item.sku);
    const eligible=product=>!this.hiddenCategories.includes(product.category)&&(!online||product.websiteVisible!==false);
    const options=(product,qty)=>eligible(product)?product.variants
      .filter(variant=>variant.sku!==item.sku&&this.available(variant.sku)>=qty)
      .map(variant=>({
        sku:variant.sku,name:product.name,size:variant.size,color:variant.color,qty,
        unitPrice:this.posPricing(variant,online).salePrice,...(!online?{barcode:variant.barcode}:{}),
      })):[];
    const sameProduct=options(original,item.qty);
    const credit=money((item.lineTotal??item.unitPrice*item.qty)*
      (online&&quote.subtotal>0?1-(quote.discount||0)/quote.subtotal:1));
    return {
      sameProduct:sameProduct.length>0,credit,
      options:sameProduct.length?sameProduct:this.products.filter(product=>product!==original).flatMap(product=>options(product,item.qty)),
      addOns:sameProduct.length?[]:this.products.flatMap(product=>options(product,1)),
    };
  }

  exchangeQuote(choices, replacementSku, addOnSku) {
    const replacement=choices.options.find(option=>option.sku===replacementSku);
    if(!replacement)throw new DomainError(409,choices.sameProduct
      ?'Choose an available size or colour of the original product first.'
      :'Choose an available replacement from the catalogue.');
    const addOn=choices.addOns.find(option=>option.sku===addOnSku);
    if(addOnSku&&(!addOn||addOn.sku===replacement.sku))throw new DomainError(409,'Choose a different, available additional item.');
    const lines=addOn?[replacement,addOn]:[replacement];
    const subtotal=money(lines.reduce((sum,line)=>sum+line.unitPrice*line.qty,0));
    const credit=choices.sameProduct?subtotal:choices.credit;
    const balance=money(subtotal-credit);
    return {lines,subtotal,credit,difference:Math.max(0,balance),shortfall:Math.max(0,-balance)};
  }

  warehouseQueue(session){
    this.permit(session,'warehouse.read');
    return [...this.orders.values()].reverse().map(order=>({id:order.id,status:order.status,placedAt:order.placedAt,lineCount:order.items.length,hasReturns:Boolean(order.returnRequests?.length||order.returnRequest||order.cancellationReturn),trackingRevision:order.shiprocketOrder?.revision,cancellationReceiptCount:order.cancellationReturn?.receipts.length,verifiedUnits:order.items.reduce((sum,item)=>sum+Math.min(item.qty,order.verified?.[item.sku]||0),0),units:order.items.reduce((sum,item)=>sum+item.qty,0)}));
  }
  warehouseOrder(session,orderId){
    this.permit(session,'warehouse.read');
    const order=this.orders.get(orderId);if(!order)throw new DomainError(404,'Order not found');
    const detail=clone(order);
    detail.items=detail.items.map(item=>{
      const {product}=this.product(item.sku);
      const firstColor=product.variants[0]?.color;
      const photo=product.images?.find(im=>im.kind!=='tryon'&&(im.color||firstColor)===item.color);
      return {...item,category:product.category,fabric:product.fabric,fit:product.fit,photo:photo?{src:photo.src,alt:photo.alt}:null,slug:product.slug};
    });
    detail.allocations=detail.allocations.map(allocation=>({...allocation,locationName:this.locations.find(l=>l.id===allocation.locationId)?.name||allocation.locationId}));
    return detail;
  }
  async warehouseVerify(session,orderId,pickCode,barcode){return this.serialized(()=>{
    this.permit(session,'warehouse.scan');
    const order=this.orders.get(orderId);if(!order)throw new DomainError(404,'Order not found');
    if(!['paid','confirmed','picking'].includes(order.status))throw new DomainError(409,'Order is not available for picking');
    const expected=String(pickCode||'').trim();
    const item=resolvePickLine(order,expected);
    if(!item)throw new DomainError(400,'Field 1 needs a valid order-line barcode from this order’s pick list.','WRONG_PICK_CODE');
    const sku=item.sku;
    const scanned=String(barcode||'').trim();
    if(scanned!==expected){
      const otherLine=resolvePickLine(order,scanned);
      const hint=otherLine&&otherLine!==item
        ? ` The scanned code belongs to ${otherLine.name} · ${otherLine.color} / ${otherLine.size}.`
        : ' Scan the matching order-line code from the physical label.';
      throw new DomainError(409,`Field 2: expected ${expected} for ${item.name} · ${item.color} / ${item.size} (${sku}).${hint}`,'WRONG_BARCODE');
    }
    const count=order.verified[sku]||0;if(count>=item.qty)throw new DomainError(409,'All units on this order line already verified');
    order.verified[sku]=count+1;order.status='picking';
    const complete=order.items.every(i=>order.verified[i.sku]===i.qty);
    this.audit.push({type:'WAREHOUSE_SCAN',id:orderId,sku,verified:order.verified[sku],at:new Date().toISOString()});
    return {orderId,sku,scanned:order.verified[sku],required:item.qty,complete,allVerified:clone(order.verified)};
  });}
  async dispatch(session,orderId){return this.serialized(()=>{
    this.permit(session,'warehouse.dispatch');
    const order=this.orders.get(orderId);if(!order)throw new DomainError(404,'Order not found');
    if(order.status==='shipped')return clone(order);
    if(!['paid','confirmed','picking'].includes(order.status))throw new DomainError(409,'Order is not available for dispatch');
    if(!order.items.every(item=>order.verified[item.sku]===item.qty))throw new DomainError(409,'Every ordered unit must pass barcode verification');
    order.status='shipped';order.shipment={provider:'MOCK_SHIPROCKET',awb:`DEMO-AWB-${orderId}`,tracking:'Simulated dispatch, no real courier pickup',dispatchedAt:new Date().toISOString()};
    this.audit.push({type:'MOCK_DISPATCH',id:orderId,at:new Date().toISOString()});return clone(order);
  });}
  orderNow(){return this.clock?.().getTime()??Date.now();}
  ownOrder(session,id){
    if(session.role!=='customer')throw new DomainError(403,'Customer login required');
    const order=this.orders.get(id);if(!order||!belongsToCustomer(order,session))throw new DomainError(404,'Order not found');return order;
  }
  async cancelOrder(session,id){return this.serialized(()=>{
    const order=this.ownOrder(session,id);if(order.status==='cancelled')return clone(order);
    if(!orderEligibility(order,this.orderNow()).canCancel)throw new DomainError(409,'Cancellation is available within 12 hours and before delivery.');
    if(order.status==='shipped'||order.shiprocketOrder){
      order.cancellationReturn={status:'pending',requestedAt:new Date(this.orderNow()).toISOString(),courierFollowUp:Boolean(order.shiprocketOrder),receipts:[]};
    }
    for(const a of order.cancellationReturn?[]:order.allocations){const before=this.stock[a.sku][a.locationId];this.stock[a.sku][a.locationId]+=a.qty;this.ledger.push({id:randomUUID(),...a,before,after:before+a.qty,delta:a.qty,reason:'ORDER_CANCELLED',ref:id,at:new Date(this.orderNow()).toISOString()});}
    const customer=this.customer(session);
    const earned=this.website.rewardLedger.filter(e=>e.ref===id&&e.type==='EARN').reduce((n,e)=>n+e.delta,0);
    const redeemed=order.quote.redeemPoints||0;
    for(const [type,delta]of [['CANCEL_EARN',-Math.min(customer.points,earned)],['CANCEL_REDEEM',redeemed]])if(delta){customer.points+=delta;this.website.rewardLedger.push({id:randomUUID(),...customerIdentity(session),delta,balance:customer.points,type,ref:id,at:new Date(this.orderNow()).toISOString()});}
    this.website.couponUses=this.website.couponUses.filter(u=>u.orderId!==id);
    order.status='cancelled';order.cancelledAt=new Date(this.orderNow()).toISOString();
    const refunded=order.payment.split?.upfront;
    if(refunded!==undefined)order.payment.mockRefundAmount=refunded;
    order.payment.status=order.payment.status==='captured'||refunded>0?'mock_refunded':'void';
    this.event(session,'ORDER_CANCELLED',id);return clone(order);
  });}
  async receiveCancellationReturn(session,id,body){return this.serialized(()=>{
    this.permit(session,'warehouse.cancellation');
    const order=this.orders.get(id);
    if(!order)throw new DomainError(404,'Order not found');
    const pending=order.cancellationReturn;
    if(order.status!=='cancelled'||!pending)throw new DomainError(409,'This order has no cancellation return.');
    const item=order.items.find(line=>line.sku===body.sku);
    const barcode=String(body.barcode??'').trim();
    const sellable=body.sellable;
    const reason=typeof body.reason==='string'?body.reason.trim():'';
    if(!item||barcode!==item.barcode)throw new DomainError(400,'Scan the original inventory barcode for this order line.');
    if(body.received!==true||!Number.isInteger(sellable)||sellable<0||sellable>item.qty||reason.length<5||reason.length>500)throw new DomainError(400,'Confirm the full line was received and inspected, enter the sellable quantity and add a reason.');
    const prior=pending.receipts.find(receipt=>receipt.sku===item.sku);
    if(prior){
      if(prior.sellable!==sellable||prior.reason!==reason)throw new DomainError(409,'This order line has already been received.');
      return this.warehouseOrder(session,id);
    }
    const location=this.locations.find(entry=>entry.id===centralWarehouseId&&entry.type==='warehouse');
    const balances=this.stock[item.sku];
    if(!location||!balances)throw new DomainError(409,'Warehouse stock is unavailable.');
    const before=balances[location.id]??0;
    const after=before+sellable;
    if(after>2147483647)throw new DomainError(409,'Warehouse stock balance is too large.');
    const at=new Date(this.orderNow()).toISOString();
    if(sellable){
      balances[location.id]=after;
      this.ledger.push({id:randomUUID(),sku:item.sku,locationId:location.id,delta:sellable,before,after,reason:'CANCELLATION_RETURN_RESTOCK',ref:id,at});
    }
    pending.receipts.push({sku:item.sku,quantity:item.qty,sellable,quarantined:item.qty-sellable,reason,at,actor:session.userId||session.role});
    if(pending.receipts.length===order.items.length)pending.status='received';
    this.event(session,'CANCELLATION_RETURN_RECEIVED',id);
    return this.warehouseOrder(session,id);
  });}
  async markDelivered(session,id){return this.serialized(()=>{
    this.permit(session,'warehouse.deliver');
    const order=this.orders.get(id);if(!order)throw new DomainError(404,'Order not found');
    if(order.status==='delivered')return clone(order);
    if(order.status!=='shipped')throw new DomainError(409,'Only dispatched orders can be marked delivered');
    order.status='delivered';order.deliveredAt=new Date(this.orderNow()).toISOString();
    if(['cod','split'].includes(order.payment.method)){order.payment.status='mock_collected';this.earnOrderPoints(orderCustomer(order),order);}
    if(order.payment.method==='exchange'&&order.payment.status==='due_on_delivery')order.payment.status='mock_collected';
    this.event(session,'MOCK_DELIVERED',id);return clone(order);
  });}
  async receiveOrderReturn(session,id,body){return this.serialized(()=>{
    this.permit(session,'warehouse.receive');
    const order=this.orders.get(id);if(!order)throw new DomainError(404,'Order not found');
    const request=(order.returnRequests||[order.returnRequest].filter(Boolean)).find(r=>r.sku===body.sku);
    if(!request||request.status!=='approved')throw new DomainError(409,'Admin approval is required before receiving an exchange garment.');
    const item=order.items.find(i=>i.sku===request.sku);
    if(!item||typeof body.barcode!=='string'||body.barcode.trim()!==item.barcode)throw new DomainError(400,'The garment barcode does not match the approved item.');
    if(Number(body.quantity)!==item.qty)throw new DomainError(400,'Confirm the full quantity for the approved order line.');
    if(!request.receivedAt){
      request.receivedAt=new Date(this.orderNow()).toISOString();
      this.event(session,'RETURN_RECEIVED',id);
    }
    return this.warehouseOrder(session,id);
  });}
  async requestOrderReturn(session,id,body){return this.serialized(()=>{
    const order=this.ownOrder(session,id),allowed=orderEligibility(order,this.orderNow());
    const reason=body.reason;
    if(typeof reason!=='string'||!Object.hasOwn(returnReasons,reason))throw new DomainError(400,'Select a reason');
    const routine=['fit','preference'].includes(reason);
    if(routine&&!allowed.canReturn)throw new DomainError(409,'Request a change-of-mind exchange within 3 days of delivery.');
    if(!routine&&!allowed.canReportIssue)throw new DomainError(409,'An issue can be reported after dispatch, once per order.');
    const note=typeof body.note==='string'?body.note.trim():'';
    if(note.length>1000||(!routine&&note.length<5))throw new DomainError(400,'Describe the issue in 5 to 1,000 characters.');
    if(!order.items.some(i=>i.sku===body.sku))throw new DomainError(400,'Select an item from this order');
    if(routine&&body.conditionConfirmed!==true)throw new DomainError(400,'Confirm the exchange condition checklist');
    const request={sku:body.sku,reason,note,status:'requested',requestedAt:new Date(this.orderNow()).toISOString()};
    if(routine){
      const choices=this.exchangeChoices(order.items.find(item=>item.sku===body.sku),order.quote);
      const exchange=this.exchangeQuote(choices,body.replacementSku,body.addOnSku);
      if(exchange.shortfall)throw new DomainError(409,'Add another product to cover the remaining exchange credit.');
      if((exchange.difference>0||body.expectedDifference!==undefined)&&body.expectedDifference!==exchange.difference){
        throw new DomainError(409,'The exchange price changed. Refresh My Orders and confirm the new amount.');
      }
      request.replacement=exchange.lines[0];
      request.exchange=exchange;
      const requests=order.returnRequests||[order.returnRequest].filter(Boolean);if(requests.some(r=>r.sku===body.sku))throw new DomainError(409,'An exchange was already requested for this item');order.returnRequests=[...requests,request];}
    else order.issueReport=request;
    this.event(session,routine?'EXCHANGE_REQUESTED':'DELIVERY_ISSUE_REPORTED',id);return clone(order);
  });}
  permit(session,permission) {
    if(!effectivePermissions(session.role,this.roles[session.role]).includes(permission))throw new DomainError(403,'Permission required: '+permission);
  }
  event(session,type,id){this.audit.push({type,id,actor:session.userId||session.role,at:new Date().toISOString()});}
  catalogCategories(){
    return [...new Set([
      ...this.products.map(product=>product.category),
      ...Object.values(this.drafts).map(draft=>draft.product.category),
      ...this.additionalCategories
    ])].sort((a,b)=>a.localeCompare(b));
  }
  async addCatalogCategory(session,input){return this.serialized(()=>{
    this.permit(session,'categories.manage');
    const name=typeof input?.name==='string'?input.name.trim().replace(/\s+/g,' '):'';
    if(!name||name.length>80)throw new DomainError(400,'Enter a category name of up to 80 characters.');
    if(this.catalogCategories().some(category=>category.toLowerCase()===name.toLowerCase()))throw new DomainError(409,'This category already exists.');
    this.additionalCategories.push(name);
    this.event(session,'CATEGORY_CREATED',name);
    return this.catalogCategories();
  });}
  async updateCatalogCategory(session,{name,action}){return this.serialized(()=>{
    this.permit(session,'categories.manage');
    if(!this.catalogCategories().includes(name))throw new DomainError(404,'Category not found');
    if(action==='remove'){
      if(this.products.some(product=>product.category===name)||Object.values(this.drafts).some(draft=>draft.product.category===name)){
        throw new DomainError(409,'Move products and drafts to another category before removing this category.');
      }
      this.additionalCategories=this.additionalCategories.filter(category=>category!==name);
    }else if(!['hide','show'].includes(action))throw new DomainError(400,'Choose Hide, Show or Remove');
    this.hiddenCategories=this.hiddenCategories.filter(category=>category!==name);
    if(action==='hide')this.hiddenCategories.push(name);
    this.event(session,'CATEGORY_'+action.toUpperCase(),name);
    return {categories:this.catalogCategories(),hiddenCategories:this.hiddenCategories};
  });}
  validateProduct(input,id) {
    const p=clone(input);
    for(const field of ['name','slug','category','description','fabric','fit'])if(typeof p[field]!=='string'||!p[field].trim()||p[field].length>4000)throw new DomainError(400,'Required product field: '+field);
    if(!this.catalogCategories().includes(p.category))throw new DomainError(400,'Select a category from the Super Admin category list.');
    if(!/^[a-z0-9-]{1,100}$/.test(p.slug))throw new DomainError(400,'Slug must contain lowercase letters, numbers and hyphens');
    const others=[...this.products.filter(x=>x.id!==id),...Object.values(this.drafts).filter(x=>x.product.id!==id).map(x=>x.product)];
    if(others.some(x=>x.slug===p.slug))throw new DomainError(409,'Product slug already used');
    if(!Array.isArray(p.variants)||!p.variants.length||p.variants.length>100)throw new DomainError(400,'Add between 1 and 100 variants');
    const barcodes=new Set(),skus=new Set();
    p.variants=p.variants.map((v,index)=>{
      const row='Variant '+(index+1);
      for(const field of ['sku','barcode','color','size'])if(typeof v?.[field]!=='string'||!v[field].trim())throw new DomainError(400,row+' requires '+field,'BARCODE_REQUIRED');
      if(!/^[A-Z0-9-]{1,80}$/.test(v.sku))throw new DomainError(400,row+': SKU must use uppercase letters, numbers or hyphens (up to 80 characters)');
      if(!/^[A-Za-z0-9-]{1,80}$/.test(v.barcode))throw new DomainError(400,row+': barcode must use letters, numbers or hyphens (up to 80 characters)');
      if(skus.has(v.sku)||others.some(x=>x.variants.some(o=>o.sku===v.sku)))throw new DomainError(409,row+': SKU '+v.sku+' is already in use','DUPLICATE_BARCODE');
      if(barcodes.has(v.barcode)||others.some(x=>x.variants.some(o=>o.barcode===v.barcode)))throw new DomainError(409,row+': barcode '+v.barcode+' is already in use','DUPLICATE_BARCODE');
      const existing=this.products.find(x=>x.id===id)?.variants;
      if(existing?.some(x=>x.sku===v.sku&&x.barcode!==v.barcode))throw new DomainError(409,'Published variant identities are permanent; create a new product for new variants');
      if(typeof v.price!=='number'||!Number.isFinite(v.price)||v.price<=0||v.price>1000000)throw new DomainError(400,row+': website price must be greater than zero and at most ₹10,00,000');
      const posPrice=v.posPrice===undefined?existing?.find(x=>x.sku===v.sku)?.posPrice:v.posPrice;
      if(posPrice!=null&&(typeof posPrice!=='number'||!Number.isFinite(posPrice)||posPrice<0.01||posPrice>1000000))throw new DomainError(400,row+': Store POS price must be between ₹0.01 and ₹10,00,000');
      const openingQty=v.openingQty===undefined?0:v.openingQty;
      if(!Number.isSafeInteger(openingQty)||openingQty<0||openingQty>100000)throw new DomainError(400,row+': opening quantity must be a whole number from 0 to 100,000');
      if(openingQty&&existing?.some(x=>x.sku===v.sku))throw new DomainError(400,row+': use Inventory to add stock for published variants');
      skus.add(v.sku);barcodes.add(v.barcode);return {id:v.sku,sku:v.sku,barcode:v.barcode,color:v.color,shade:v.shade||v.color,size:v.size,price:money(v.price),...(posPrice!=null?{posPrice:money(posPrice)}:{}),...(openingQty?{openingQty}:{}),active:v.active!==false};
    });
    if(this.products.find(x=>x.id===id)?.variants.some(v=>!skus.has(v.sku)))throw new DomainError(409,'Published variants cannot be removed');
    p.images=(p.images||[]).map(image=>{
      if(image.kind!==undefined&&!['photo','tryon'].includes(image.kind))throw new DomainError(400,'Invalid image purpose');
      if(image.kind==='tryon'&&(!image.color||!/^data:image\/(png|webp);/.test(image.src)))throw new DomainError(400,'Try-on cutouts need a matching color and transparent PNG or WebP');
      if(typeof image.alt!=='string'||!image.alt.trim())throw new DomainError(400,'Image alternative text required');
      if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image.src)||image.src.length>700000)throw new DomainError(400,'Use PNG, JPEG or WebP images up to 500 KB');
      const bytes=Buffer.from(image.src.split(',')[1],'base64');
      const valid=image.src.startsWith('data:image/png')?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):image.src.startsWith('data:image/jpeg')?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
      if(!valid)throw new DomainError(400,'Image contents do not match its type');
      if(image.kind==='tryon'){const alpha=image.src.startsWith('data:image/png')?([4,6].includes(bytes[25])||bytes.includes(Buffer.from('tRNS'))):(bytes.includes(Buffer.from('ALPH'))||(bytes.toString('ascii',12,16)==='VP8X'&&!!(bytes[20]&16))||(bytes.toString('ascii',12,16)==='VP8L'&&!!(bytes[24]&16)));if(!alpha)throw new DomainError(400,'Try-on cutouts must have an alpha transparency channel');}if(image.color&& !p.variants.some(v=>v.color===image.color))throw new DomainError(400,'Image color must match a variant');return {kind:image.kind||'photo',generated:!!image.generated,src:image.src,alt:image.alt.slice(0,200),color:String(image.color||''),label:String(image.label||'Product photo').slice(0,100)};
    });
    const cutoutColors=p.images.filter(im=>im.kind==='tryon').map(im=>im.color);if(new Set(cutoutColors).size!==cutoutColors.length)throw new DomainError(400,'Only one try-on cutout per color');
    if(p.images.length>20)throw new DomainError(400,'Maximum twenty images');
    let sizeChart;try{sizeChart=validateSizeChart(p.sizeChart,p);}catch(e){throw new DomainError(400,e.message,'INVALID_SIZE_CHART');}
    return {sizeChart,id,slug:p.slug,name:p.name,category:p.category,description:p.description,fabric:p.fabric,fit:p.fit,swatch:p.swatch||'#acc3d0',label:p.label||'NEW ARRIVAL',featured:!!p.featured,variants:p.variants,images:p.images,care:String(p.care||'').slice(0,4000),websiteVisible:p.websiteVisible!==false};
  }
  async saveDraft(session,input){return this.serialized(()=>{
    this.permit(session,'catalog.edit');const id=input.id||`p-${randomUUID()}`;
    if(!/^[a-zA-Z0-9-]{1,100}$/.test(id)||['constructor','prototype','__proto__'].includes(id))throw new DomainError(400,'Invalid product ID');
    const previous=this.drafts[id];
    if(previous&&input.revision!==previous.revision)throw new DomainError(409,'Draft changed; reload before saving');
    const published=this.products.find(product=>product.id===id);
    let slug=published?.slug||previous?.product.slug||input.slug;
    if(!slug){
      const base=(typeof input.name==='string'?input.name:'').normalize('NFKD')
        .replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-')
        .slice(0,90).replace(/^-+|-+$/g,'')||'product';
      const used=new Set([
        ...this.products.map(product=>product.slug),
        ...Object.values(this.drafts).map(draft=>draft.product.slug)
      ]);
      slug=base;
      for(let suffix=2;used.has(slug);suffix++)slug=base+'-'+suffix;
    }
    const product=this.validateProduct({...input,slug},id);
    const draft={product,revision:(previous?.revision||0)+1,status:'draft',author:session.userId||session.role};
    this.drafts[id]=draft;this.event(session,'DRAFT_SAVED',id);return clone(draft);
  });}
  async submitDraft(session,id,revision){return this.serialized(()=>{
    this.permit(session,'catalog.submit');const d=this.drafts[id];
    if(!d||d.revision!==revision||d.status!=='draft')throw new DomainError(409,'Save and preview the current draft before submitting');
    this.validateProduct(d.product,id);d.status='pending';d.submittedBy=session.userId||session.role;this.event(session,'PRODUCT_SUBMITTED',id);return clone(d);
  });}
  async decideDraft(session,id,body){return this.serialized(()=>{
    this.permit(session,'approvals.decide');const d=this.drafts[id];
    if(!d||d.status!=='pending'||d.revision!==body.revision)throw new DomainError(409,'Approval is stale or not pending');
    if(!['publish','reject'].includes(body.action))throw new DomainError(400,'Select publish or reject');
    if(body.action==='publish'){
      const product=this.validateProduct(d.product,id);const index=this.products.findIndex(p=>p.id===id);
      const warehouse=this.locations.find(l=>l.id===centralWarehouseId&&l.type==='warehouse');
      if(!warehouse&&product.variants.some(v=>v.openingQty))throw new DomainError(409,'Hyderabad Warehouse is required to receive opening stock');
      product.variants=product.variants.map(({openingQty=0,...variant})=>{
        const {sku}=variant;
        if(!this.stock[sku]){
          this.stock[sku]={[centralWarehouseId]:0};
          if(openingQty){
            this.stock[sku][warehouse.id]=openingQty;
            this.ledger.push({id:randomUUID(),sku,locationId:warehouse.id,delta:openingQty,before:0,after:openingQty,reason:'PRODUCT_OPENING_STOCK',ref:id,at:new Date().toISOString()});
          }
        }
        return variant;
      });
      if(index<0)this.products.push(product);else this.products[index]=product;
      d.product=clone(product);
      d.status='published';
    }else d.status='draft';
    this.approvals.push({id,revision:d.revision,action:body.action,reason:String(body.reason||'').slice(0,1000),actor:session.userId||session.role,at:new Date().toISOString()});
    this.event(session,'PRODUCT_'+body.action.toUpperCase(),id);return clone(d);
  });}
  async saveUser(session,body){return this.serialized(()=>{
    this.permit(session,'users.manage');if(session.role!=='superadmin')throw new DomainError(403,'Super Admin required');
    if(!/^[a-z0-9-]{1,60}$/.test(body.id)||!body.name?.trim()||!Object.hasOwn(this.roles,body.role)||typeof body.active!=='boolean'||!this.locations.some(l=>l.id===body.locationId))throw new DomainError(400,'Valid user ID, name, role, active flag and location required');
    if(body.id===session.userId&&(body.role!=='superadmin'||!body.active))throw new DomainError(409,'Cannot revoke your own Super Admin access');
    const index=this.users.findIndex(user=>user.id===body.id);
    let pinCredential=this.users[index]?.pinCredential;
    if(body.pin){
      if(typeof body.pin!=='string'||!/^\d{6,12}$/.test(body.pin))throw new DomainError(400,'Use a staff PIN with 6–12 digits');
      const salt=randomBytes(16).toString('hex');
      pinCredential={salt,hash:scryptSync(body.pin,salt,32).toString('hex')};
    }
    if(index<0&&!pinCredential)throw new DomainError(400,'Set a PIN when creating a staff account');
    const user={id:body.id,name:body.name.slice(0,100),role:body.role,active:body.active,locationId:body.locationId};
    const stored=pinCredential?{...user,pinCredential}:user;
    if(index<0)this.users.push(stored);else this.users[index]=stored;
    if(body.pin)for(const [token,active] of this.sessions)if(active.userId===user.id)this.sessions.delete(token);
    this.event(session,'USER_SAVED',user.id);
    Object.assign(this.audit.at(-1),{assignedRole:user.role,locationId:user.locationId,active:user.active});return user;
  });}
  async saveRole(session,body){return this.serialized(()=>{
    this.permit(session,'users.manage');if(session.role!=='superadmin')throw new DomainError(403,'Super Admin required');
    const allowed=staffPermissions.filter(permission=>!reservedPermissions.includes(permission));
    if(['constructor','prototype'].includes(body.name)||!/^[a-z][a-z0-9-]{1,40}$/.test(body.name)||body.name==='superadmin'||!Array.isArray(body.permissions)||body.permissions.some(p=>!allowed.includes(p)))throw new DomainError(400,'Invalid role or permissions');
    this.roles[body.name]=[...new Set(body.permissions)];this.event(session,'ROLE_SAVED',body.name);
    this.audit.at(-1).permissions=[...this.roles[body.name]];return this.roles;
  });}
  async receiveStock(session,body){return this.serialized(()=>{
    this.permit(session,'inventory.receive');const {sku,locationId=centralWarehouseId,qty,key,reason}=body;
    if(typeof key!=='string'||key.length<6||!Number.isSafeInteger(qty)||qty<1||qty>100000||locationId!==centralWarehouseId||typeof reason!=='string'||!reason.trim())throw new DomainError(400,'Receipt requires a SKU, positive quantity, reason and idempotency key for the central warehouse');
    this.product(sku);const fingerprint=JSON.stringify({sku,locationId,qty,reason});const previous=this.getIdempotent('receipt:'+key,fingerprint);if(previous)return previous;
    const before=this.stock[sku][locationId]||0;const after=before+qty;if(after>2147483647)throw new DomainError(400,'Stock balance too large');this.stock[sku][locationId]=after;
    this.ledger.push({id:randomUUID(),sku,locationId,delta:qty,before,after,reason:'MOCK_RECEIPT: '+reason.slice(0,200),ref:key,at:new Date().toISOString()});this.event(session,'STOCK_RECEIPT',key);
    const result={sku,locationId,qty,after};this.setIdempotent('receipt:'+key,fingerprint,result);return result;
  });}
  health(){return {status:'ok',mode:'DEVELOPMENT_MOCK_ONLY',paymentProvider:'MOCK_RAZORPAY',shippingProvider:'MOCK_SHIPROCKET',otpProvider:'MOCK_OTP',mapsProvider:'MOCK_MAP',aiProvider:'MOCK_TRYON',orders:this.orders.size,posSales:this.sales.size};}
}

Object.assign(Commerce.prototype,websiteMethods,adminOrderMethods,returnInspectionMethods,posMethods,{warehouseInventory});
