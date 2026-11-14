import {api} from './api';

let sdk;
function loadSdk() {
 if(window.initSendOTP)return Promise.resolve();
 sdk??=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://verify.msg91.com/otp-provider.js';
  script.onload=()=>window.initSendOTP?resolve():reject(new Error('MSG91 verification could not load'));
  script.onerror=()=>reject(new Error('MSG91 verification could not load'));
  document.head.append(script);
 }).catch(error=>{sdk=null;throw error;});
 return sdk;
}

export async function openMsg91Widget(phone,onVerified,onError) {
 const {widgetId,tokenAuth}=await api('/api/auth/customer-config');
 await loadSdk();
 window.initSendOTP({
  widgetId,tokenAuth,identifier:'91'+phone.replace(/\D/g,'').slice(-10),
  success:async data=>{
   try {
    const result=await api('/api/auth/msg91/verify',{
     method:'POST',body:JSON.stringify({phone,accessToken:data?.message})
    });
    await onVerified(result);
   }catch(error){onError(error.message);}
  },
  failure:()=>onError('MSG91 could not complete verification. Try requesting a new code.')
 });
}
