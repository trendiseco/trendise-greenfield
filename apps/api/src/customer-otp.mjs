import {DomainError,canonicalPhone} from './core.mjs';

export function createCustomerOtp(env=process.env,request=fetch) {
 const mode=env.CUSTOMER_OTP_MODE||'mock';
 if(mode==='mock')return null;
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
