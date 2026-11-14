import {DomainError,canonicalPhone} from './core.mjs';

export function createCustomerOtp(env=process.env,request=fetch) {
 const mode=env.CUSTOMER_OTP_MODE||'mock';
 if(mode==='mock')return null;
 if(mode==='msg91-uat')return createMsg91Otp(env,request);
 if(mode!=='supabase-uat')throw new Error('Invalid CUSTOMER_OTP_MODE');
 const url=new URL(env.SUPABASE_AUTH_URL||'invalid');
 const key=env.SUPABASE_AUTH_PUBLISHABLE_KEY;
 const allowed=new Set((env.CUSTOMER_OTP_TEST_NUMBERS||'').split(',').filter(value=>value.trim()).map(canonicalPhone));
 if(url.origin!==url.href.slice(0,-1)||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url.origin)||
    !key?.startsWith('sb_publishable_')||!allowed.size)throw new Error('Configure Supabase Auth URL, publishable key and OTP test numbers');

 function testPhone(input) {
  const phone=canonicalPhone(input);
  if(!allowed.has(phone))throw new DomainError(403,'This number is outside the private SMS test');
  return phone;
 }

 async function call(path,body) {
  let response,data;
  try {
   response=await request(url.origin+'/auth/v1/'+path,{
    method:'POST',headers:{apikey:key,'content-type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error'
   });
   data=await response.json();
  }catch{throw new DomainError(502,'SMS authentication provider could not be reached');}
  if(response.status===429)throw new DomainError(429,'Too many OTP attempts. Wait before retrying.');
  if(!response.ok){
   if(path==='verify'&&['otp_expired','invalid_credentials'].includes(data?.error_code)){
    throw new DomainError(401,'Incorrect or expired SMS code');
   }
   throw new DomainError(502,'SMS authentication failed. Check Phone sign-in and the SMS provider in Supabase.');
  }
  return data;
 }

 return {
  async send(input) {
   const phone=testPhone(input);
   await call('otp',{phone:'+91'+phone,channel:'sms',create_user:true});
   return {message:'A one-time code was sent by SMS.'};
  },
  async verify(input,code) {
   const phone=testPhone(input);
   if(!/^\d{6}$/.test(code))throw new DomainError(400,'Enter the six-digit SMS code');
   const data=await call('verify',{phone:'+91'+phone,token:code,type:'sms'});
   if(!data?.access_token||!data.user?.phone_confirmed_at||
      !['91'+phone,'+91'+phone].includes(data.user.phone)){
    throw new DomainError(401,'Phone verification did not match this number');
   }
   return phone;
  }
 };
}

function createMsg91Otp(env, request) {
 const authkey=env.MSG91_AUTH_KEY?.trim();
 const widgetId=env.MSG91_WIDGET_ID?.trim();
 const allowed=new Set((env.CUSTOMER_OTP_TEST_NUMBERS||'').split(',').filter(value=>value.trim()).map(canonicalPhone));
 if(!authkey||!/^[a-z0-9]+$/i.test(widgetId??'')||!allowed.size){
  throw new Error('Set MSG91_AUTH_KEY, MSG91_WIDGET_ID and CUSTOMER_OTP_TEST_NUMBERS');
 }
 const challenges=new Map();

 function testPhone(input) {
  const phone=canonicalPhone(input);
  if(!allowed.has(phone))throw new DomainError(403,'This number is outside the private SMS test');
  return phone;
 }

 async function call(action,body) {
  let response,data;
  try {
   response=await request('https://control.msg91.com/api/v5/widget/'+action,{
    method:'POST',headers:{'content-type':'application/json',authkey},
    body:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error'
   });
   data=await response.json();
  }catch{throw new DomainError(502,'MSG91 could not be reached');}
  if(response.status===429)throw new DomainError(429,'Too many OTP attempts. Wait before retrying.');
  if(!response.ok||data?.type!=='success'||typeof data.message!=='string'||!data.message){
   if(response.ok&&action==='verifyOtp'&&String(data?.code)!=='201'&&data?.message!=='AuthenticationFailure'){
    throw new DomainError(401,'Incorrect or expired SMS code');
   }
   throw new DomainError(502,'MSG91 verification failed. Check the AuthKey permissions, IP allowlist and widget settings.');
  }
  return data.message;
 }

 return {
  async send(input) {
   const phone=testPhone(input),now=Date.now(),previous=challenges.get(phone);
   if(previous&&(previous.busy||now<previous.retryAt))throw new DomainError(429,'Wait before requesting another SMS code');
   const challenge={retryAt:now+60000,expiresAt:now+300000,attempts:0,busy:true};
   challenges.set(phone,challenge);
   try {
    challenge.reqId=await call('sendOtp',{authkey,widgetId,identifier:'91'+phone});
    return {message:'A one-time code was sent by SMS.'};
   }finally{challenge.busy=false;}
  },
  async verify(input,code) {
   const phone=testPhone(input),challenge=challenges.get(phone);
   if(!/^\d{6}$/.test(code))throw new DomainError(400,'Enter the six-digit SMS code');
   if(!challenge?.reqId||challenge.expiresAt<=Date.now()||challenge.attempts>=5){
    throw new DomainError(401,'Request a new SMS code');
   }
   if(challenge.busy)throw new DomainError(429,'Wait for the current verification to finish');
   challenge.busy=true;
   challenge.attempts++;
   try {
    const accessToken=await call('verifyOtp',{authkey,widgetId,reqId:challenge.reqId,otp:code});
    const identifier=await call('verifyAccessToken',{authkey,'access-token':accessToken});
    if(!['91'+phone,'+91'+phone,phone].includes(identifier)){
     throw new DomainError(401,'Phone verification did not match this number');
    }
    challenges.delete(phone);
    return phone;
   }finally{challenge.busy=false;}
  }
 };
}
