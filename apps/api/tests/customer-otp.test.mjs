import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {Commerce} from '../src/core.mjs';
import {createServer} from '../src/server.mjs';
import {createCustomerOtp} from '../src/customer-otp.mjs';

test('private UAT requests real-mode SMS and only grants customer access after provider verification',async()=>{
 const phone='9999900001',calls=[];
 const config={CUSTOMER_OTP_MODE:'supabase-uat',SUPABASE_AUTH_URL:'https://example.supabase.co',
  SUPABASE_AUTH_PUBLISHABLE_KEY:'sb_publishable_test',CUSTOMER_OTP_TEST_NUMBERS:phone};
 const provider=createCustomerOtp(config,async(url,options)=>{
  const body=JSON.parse(options.body);
  calls.push({url,body});
  if(url.endsWith('/otp'))return Response.json({});
  if(body.token==='123456')return Response.json({error_code:'otp_expired'},{status:403});
  return Response.json({access_token:'provider-token',user:{phone:'91'+phone,phone_confirmed_at:'2026-11-14'}});
 });
 assert.throws(()=>createCustomerOtp({...config,CUSTOMER_OTP_TEST_NUMBERS:''}));
 const core=new Commerce();
 core.requestOtp(phone);
 const mock=core.verifyOtp(phone,'123456');
 const server=createServer(core,undefined,provider);
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 try{
  const call=(path,body,token)=>fetch('http://127.0.0.1:'+server.address().port+path,{
   method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
   body:body?JSON.stringify(body):undefined
  });
  assert.equal((await call('/api/orders',null,mock.token)).status,401);
  assert.equal((await call('/api/auth/request-otp',{phone:'9999900002'})).status,403);
  assert.equal(calls.length,0);
  const sent=await call('/api/auth/request-otp',{phone:'+91 '+phone});
  assert.equal(sent.status,200);
  assert.equal((await sent.json()).devOtp,undefined);
  assert.deepEqual(calls[0].body,{phone:'+91'+phone,channel:'sms',create_user:true});
  assert.equal((await call('/api/auth/verify-otp',{phone,otp:'123456'})).status,401);
  const verified=await call('/api/auth/verify-otp',{phone,otp:'654321'});
  assert.equal(verified.status,200);
  const user=await verified.json();
  assert.equal(user.phone,phone);
  assert.notEqual(user.token,'provider-token');
  assert.equal((await call('/api/orders',null,user.token)).status,200);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('MSG91 binds OTP verification to the requested number and consumes the challenge',async()=>{
 const phone='9999900001',calls=[];
 let verifiedPhone='919999900002';
 const otp=createCustomerOtp({CUSTOMER_OTP_MODE:'msg91-uat',MSG91_AUTH_KEY:'test-key',
  MSG91_WIDGET_ID:'testWidget',CUSTOMER_OTP_TEST_NUMBERS:phone},async(url,options)=>{
  const action=url.split('/').at(-1),body=JSON.parse(options.body);
  calls.push({action,body});
  if(action==='verifyOtp'&&body.otp==='123456')return Response.json({type:'error',message:'OTP not match'});
  return Response.json({type:'success',message:{sendOtp:'request-id',verifyOtp:'access-token',verifyAccessToken:verifiedPhone}[action]});
 });
 await assert.rejects(otp.send('9999900002'),{status:403});
 await otp.send(phone);
 assert.deepEqual(calls[0],{action:'sendOtp',body:{authkey:'test-key',widgetId:'testWidget',identifier:'91'+phone}});
 await assert.rejects(otp.send(phone),{status:429});
 await assert.rejects(otp.verify(phone,'123456'),{status:401});
 await assert.rejects(otp.verify(phone,'654321'),{status:401});
 verifiedPhone='91'+phone;
 assert.equal(await otp.verify(phone,'654321'),phone);
 await assert.rejects(otp.verify(phone,'654321'),{status:401});
});

test('MSG91 browser widget checks identity server-side and rejects token replay',async()=>{
 const phone='9999900001';
 const provider=createCustomerOtp({CUSTOMER_OTP_MODE:'msg91-widget',MSG91_AUTH_KEY:'test-key',
  MSG91_WIDGET_ID:'widget',MSG91_WIDGET_TOKEN:'browser-token',CUSTOMER_OTP_TEST_NUMBERS:phone},
 async(_url,options)=>Response.json({type:'success',message:JSON.parse(options.body)['access-token']==='right'?'91'+phone:'919999900002'}));
 const server=createServer(new Commerce(),undefined,provider);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const verify=accessToken=>fetch(base+'/api/auth/msg91/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone,accessToken})});
  assert.deepEqual(await (await fetch(base+'/api/auth/customer-config')).json(),{provider:'msg91',widgetId:'widget',tokenAuth:'browser-token'});
  assert.equal((await verify('wrong')).status,401);
  const signedIn=await verify('right');assert.equal(signedIn.status,200);
  const {token}=await signedIn.json();
  assert.equal((await fetch(base+'/api/orders',{headers:{authorization:'Bearer '+token}})).status,200);
  assert.equal((await verify('right')).status,409);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
