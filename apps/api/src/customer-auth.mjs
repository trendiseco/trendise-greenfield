import {randomUUID} from 'node:crypto';
import {DomainError} from './errors.mjs';

export function createCustomerAuth(env=process.env,request=fetch){
 const url=String(env.SUPABASE_AUTH_URL||'').replace(/\/$/,'');
 const key=env.SUPABASE_AUTH_PUBLISHABLE_KEY||'';
 let publicKey=key.startsWith('sb_publishable_');
 if(!publicKey){try{publicKey=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role==='anon';}catch{}}
 const configured=publicKey&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)&&Boolean(key);
 return {
  config:{configured,...(configured?{url,publishableKey:key}:{}),googleEnabled:configured&&env.CUSTOMER_GOOGLE_ENABLED==='true'},
  async verify(token){
   if(!configured)throw new DomainError(503,'Email and Google sign-in need the Supabase Auth project settings.');
   if(typeof token!=='string'||!token||token.length>8192)throw new DomainError(401,'Sign in again to continue.');
   let response;
   try{response=await request(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000),redirect:'error'});}
   catch{throw new DomainError(502,'Sign-in verification is unavailable. Please retry.');}
   if(!response.ok)throw new DomainError(401,'Your sign-in has expired. Please sign in again.');
   const user=await response.json();
   if(!user.id||!user.email||!user.email_confirmed_at)throw new DomainError(401,'Confirm your email before signing in.');
   return user;
  },
 };
}

export function bindCustomerIdentity(core,user,body){
 const id='auth:'+user.id;
 core.ensureWebsite();
 let profile=core.website.customers[id];
 if(!profile){
  const metadata=user.user_metadata||{};
  const firstName=String(body.firstName??metadata.first_name??'').trim();
  const lastName=String(body.lastName??metadata.last_name??'').trim();
  const phone=String(body.phone??metadata.contact_phone??'').replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'');
  if(!firstName||firstName.length>50||!lastName||lastName.length>50||!(/^[6-9]\d{9}$/).test(phone)){
   throw new DomainError(400,'Complete your first name, last name and 10-digit Indian phone number.','PROFILE_REQUIRED');
  }
  const existing=Object.entries(core.website.customers).find(([,entry])=>entry.phone===phone);
  if(existing?.[1].customerId&&existing[0]!==id){
   throw new DomainError(409,'This phone number is already linked to another customer account.');
  }
  const history=[...core.orders.values(),...core.reservations.values()].some(record=>record.phone===phone);
  if(existing||history){
   const legacy=body.legacyToken?core.session(body.legacyToken,['customer']):null;
   if(!legacy?.smsVerified||legacy.phone!==phone||legacy.customerId){
    throw new DomainError(409,'Verify the original mobile number to link your existing orders and rewards.','PHONE_LINK_REQUIRED');
   }
   for(const records of [core.orders.values(),core.reservations.values(),core.website.couponUses,core.website.rewardLedger]){
    for(const record of records)if(record.phone===phone&&!record.customerId)record.customerId=id;
   }
   for(const [token,session] of core.sessions)if(session.role==='customer'&&session.phone===phone){
    if(session.smsVerified)session.customerId=id;else core.sessions.delete(token);
   }
  }
  profile={...(existing?.[1]??{birthday:'',points:0}),customerId:id,phone,firstName,lastName,name:firstName+' '+lastName,email:user.email};
  if(existing)delete core.website.customers[existing[0]];
  core.website.customers[id]=profile;
  core.event({role:'customer'},'CUSTOMER_IDENTITY_LINKED',id);
 }
 const token=randomUUID();
 core.sessions.set(token,{role:'customer',customerId:id,phone:profile.phone,identityVerified:true,expiresAt:Date.now()+86400000});
 return {token,role:'customer',phone:profile.phone,name:profile.name,customerId:id};
}
