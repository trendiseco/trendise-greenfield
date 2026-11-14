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
