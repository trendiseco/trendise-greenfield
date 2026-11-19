import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {Commerce} from '../src/core.mjs';
import {createServer} from '../src/server.mjs';
import {createCustomerAuth,bindCustomerIdentity} from '../src/customer-auth.mjs';
import {snapshot,restore,DurableCommerce,poolFor,migrate,seed} from '../src/database.mjs';
import {lookupDeliveryPin} from '../src/pin-directory.mjs';
import {codEligible,splitEligible} from '../../../shared/split-payment.mjs';

const user={id:'verified-user',email:'shopper@example.com',email_confirmed_at:'2026-11-19T00:00:00Z',user_metadata:{first_name:'Test',last_name:'Shopper',contact_phone:'9876543210'}};
const address={name:'Test Shopper',phone:'9876543210',line1:'Test road',city:'Hyderabad',state:'Telangana',pincode:'500001'};

test('email identity owns new orders independently of an unverified matching phone',async()=>{
 const core=new Commerce();core.requireVerifiedSms=true;
 const identity=bindCustomerIdentity(core,user,{});
 const session=core.session(identity.token,['customer']);
 const {orderId}=await core.placeOrder(session,{items:[{sku:core.products[0].variants[0].sku,qty:1}],address,paymentMethod:'card',acceptedPolicyVersion:core.version},'email-identity-order');
 assert.equal(core.orders.get(orderId).customerId,'auth:verified-user');
 assert.equal(core.customer(session).firstName,'Test');
 assert.equal(core.customer(session).email,user.email);
 assert.equal(core.ordersFor({role:'customer',phone:session.phone}).length,0);
 assert.throws(()=>core.ownOrder({role:'customer',phone:session.phone},orderId),{status:404});
 assert.throws(()=>core.customer({role:'customer',phone:session.phone}),{status:409});
 assert.throws(()=>bindCustomerIdentity(core,{...user,id:'another-user'},{}),{status:409});
 const restored=new Commerce();restore(restored,structuredClone(snapshot(core)));
 assert.equal(restored.ordersFor(restored.session(identity.token))[0].id,orderId);
 assert.equal(restored.customerView(session).profile.lastName,'Shopper');
});

test('linking existing orders and rewards requires proof of the original mobile account',async()=>{
 const core=new Commerce(),legacy={role:'customer',phone:'9876543210'};
 core.customer(legacy).points=100;
 const {orderId}=await core.placeOrder(legacy,{items:[{sku:core.products[0].variants[0].sku,qty:1}],address,paymentMethod:'cod',acceptedPolicyVersion:core.version},'legacy-link-order');
 assert.throws(()=>bindCustomerIdentity(core,user,{}),{code:'PHONE_LINK_REQUIRED'});
 const unverified=core.issueCustomerSession(legacy.phone);
 assert.throws(()=>bindCustomerIdentity(core,user,{legacyToken:unverified.token}),{code:'PHONE_LINK_REQUIRED'});
 const verified=core.issueCustomerSession(legacy.phone,{smsVerified:true});
 const linked=bindCustomerIdentity(core,user,{legacyToken:verified.token});
 const session=core.session(linked.token);
 assert.equal(core.ordersFor(session)[0].id,orderId);
 assert.equal(core.customerView(session).availablePoints,100);
 assert.equal(core.website.customers[legacy.phone],undefined);
 assert.equal(core.ordersFor(legacy).length,0);
 assert.equal(core.customer(core.session(verified.token)).customerId,session.customerId);
 assert.throws(()=>core.session(unverified.token),{status:401});
 const phoneOnly=core.issueCustomerSession(legacy.phone,{smsVerified:true});
 assert.throws(()=>core.customerView(core.session(phoneOnly.token)),{status:409});
});

test('COD uses verified PIN distance and cannot be bypassed through the API',async()=>{
 const core=new Commerce(),session={role:'customer',phone:'9876543210'};
 assert.equal(codEligible(lookupDeliveryPin('500001')),true);
 assert.equal(codEligible(lookupDeliveryPin('110001')),false);
 assert.equal(splitEligible(lookupDeliveryPin('110001')),true);
 assert.equal(codEligible(null),false);
 const body={items:[{sku:core.products[0].variants[0].sku,qty:1}],address:{...address,pincode:'110001'},acceptedPolicyVersion:core.version,paymentMethod:'cod'};
 await assert.rejects(core.placeOrder(session,body,'faraway-cod'),{code:'COD_UNAVAILABLE'});
 assert.equal(core.orders.size,0);
 assert.equal(core.reservations.size,0);
 for(const method of ['card','phonepe','split']){
  const result=await core.placeOrder(session,{...body,paymentMethod:method},'faraway-'+method);
  assert.equal(result.order.payment.method,method);
 }
});

test('Supabase tokens are verified with the provider and incomplete email identities are rejected',async()=>{
 const env={SUPABASE_AUTH_URL:'https://example.supabase.co',SUPABASE_AUTH_PUBLISHABLE_KEY:'sb_publishable_public'};
 const calls=[];
 const provider=createCustomerAuth(env,async(url,options)=>{
  calls.push({url,authorization:options.headers.Authorization});
  return options.headers.Authorization==='Bearer real-token'?Response.json(user):Response.json({},{status:401});
 });
 assert.equal(provider.config.configured,true);
 assert.equal(createCustomerAuth({...env,SUPABASE_AUTH_PUBLISHABLE_KEY:'sb_secret_do_not_expose'}).config.configured,false);
 assert.equal(createCustomerAuth({...env,SUPABASE_AUTH_PUBLISHABLE_KEY:'sb_secret_do_not_expose'}).config.publishableKey,undefined);
 assert.deepEqual(await provider.verify('real-token'),user);
 assert.equal(calls[0].url,'https://example.supabase.co/auth/v1/user');
 await assert.rejects(provider.verify('forged-token'),{status:401});
 await assert.rejects(createCustomerAuth({}).verify('real-token'),{status:503});
 await assert.rejects(createCustomerAuth(env,async()=>Response.json({...user,email_confirmed_at:null})).verify('token'),{status:401});
});

test('customer session HTTP flow verifies externally and logout revokes the application token',async t=>{
 const core=new Commerce();
 const provider={config:{configured:true},verify:async token=>{if(token!=='verified')throw new Error('Invalid');return user;}};
 const server=createServer(core,undefined,null,provider);
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port;
 const login=await fetch(base+'/api/auth/customer/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accessToken:'verified'})});
 assert.equal(login.status,200);
 const session=await login.json();
 const headers={authorization:'Bearer '+session.token};
 assert.equal((await fetch(base+'/api/account',{headers})).status,200);
 assert.equal((await fetch(base+'/api/auth/customer/logout',{method:'POST',headers})).status,200);
 assert.equal((await fetch(base+'/api/account',{headers})).status,401);
});


test('email HTTP sessions, order ownership and account projection survive PostgreSQL restart',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const schema='auth_test_'+crypto.randomUUID().replaceAll('-','');
 const setup=poolFor(process.env.TEST_DATABASE_URL);await setup.query(`CREATE SCHEMA ${schema}`);await setup.end();
 const url=new URL(process.env.TEST_DATABASE_URL);url.searchParams.set('options',`-c search_path=${schema}`);
 const pool=poolFor(url.toString());let server;
 try{
  await migrate(pool);await seed(pool);
  const core=new DurableCommerce(pool);
  server=createServer(core,undefined,null,{config:{configured:true},verify:async()=>user});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const login=await fetch(base+'/api/auth/customer/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accessToken:'provider-verified'})});
  assert.equal(login.status,200);const identity=await login.json();
  const body={items:[{sku:core.products[0].variants[0].sku,qty:1}],address,paymentMethod:'card',acceptedPolicyVersion:core.version};
  const placed=await fetch(base+'/api/checkout/place',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+identity.token,'x-idempotency-key':'persistent-email-order'},body:JSON.stringify(body)});
  assert.equal(placed.status,201);const order=await placed.json();
  const restarted=new DurableCommerce(pool);
  await restarted.unit(()=>{
   const session=restarted.session(identity.token);
   assert.equal(restarted.ordersFor(session)[0].id,order.orderId);
   assert.equal(restarted.customerView(session).profile.email,user.email);
   assert.equal(restarted.ordersFor({role:'customer',phone:user.user_metadata.contact_phone}).length,0);
  },{readOnly:true});
  const projected=await pool.query('SELECT document FROM customer_profiles WHERE phone=$1',[user.user_metadata.contact_phone]);
  assert.equal(projected.rows[0].document.customerId,'auth:'+user.id);
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));await pool.end();
  const cleanup=poolFor(process.env.TEST_DATABASE_URL);
  try{await cleanup.query(`DROP SCHEMA ${schema} CASCADE`);}finally{await cleanup.end();}
 }
});


test('registration birthday is optional, validated, persists and cannot be changed through profile or repeat login',async()=>{
 const core=new Commerce();core.clock=()=>new Date('2026-11-19T10:00:00Z');
 const registered=bindCustomerIdentity(core,{...user,user_metadata:{...user.user_metadata,date_of_birth:'1995-11-15'}},{});
 const session=core.session(registered.token);
 assert.equal(core.customerView(session).profile.birthday,'1995-11-15');
 assert.equal(core.customerView(session).birthdayEligible,true);
 for(const birthday of ['1995-12-15',''])await assert.rejects(core.saveCustomer(session,{name:'Test Shopper',birthday}),{status:409});
 bindCustomerIdentity(core,{...user,user_metadata:{...user.user_metadata,date_of_birth:'1990-01-01'}},{birthday:'2000-01-01'});
 assert.equal(core.customerView(session).profile.birthday,'1995-11-15');
 await core.saveCustomer(session,{name:'Updated name',birthday:'1995-11-15'});
 const restored=new Commerce();restore(restored,structuredClone(snapshot(core)));
 assert.equal(restored.customerView(restored.session(registered.token)).profile.birthday,'1995-11-15');
 for(const birthday of ['2026-02-30','2026-11-20','1899-12-31',123]){
  const fresh=new Commerce();fresh.clock=core.clock;
  assert.throws(()=>bindCustomerIdentity(fresh,user,{birthday}),{status:400});
  assert.equal(Object.keys(fresh.website.customers).length,0);
 }
 const fresh=new Commerce(),login=bindCustomerIdentity(fresh,user,{}),late=fresh.session(login.token);
 assert.equal(fresh.customerView(late).profile.birthday,'');
 await fresh.saveCustomer(late,{name:'Test Shopper',birthday:'1992-04-20'});
 await assert.rejects(fresh.saveCustomer(late,{name:'Test Shopper',birthday:''}),{status:409});
});
