import {createClient} from '@supabase/supabase-js';
import {api} from './api';

let clientPromise;
export async function customerAuthClient(){
 if(!clientPromise){
  clientPromise=api('/api/auth/email-config').then(config=>{
   if(!config.configured)throw new Error('Customer sign-in is awaiting Supabase Auth setup. Please contact TRENDISE support.');
   return {config,client:createClient(config.url,config.publishableKey,{
    auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:localStorage,storageKey:'trd_email_auth'},
   })};
  }).catch(error=>{clientPromise=null;throw error;});
 }
 return clientPromise;
}

export async function signOutCustomer(token){
 if(token)await api('/api/auth/customer/logout',{token,method:'POST'});
 sessionStorage.removeItem('trd_customer_token');
 if(clientPromise){const {client}=await clientPromise;await client.auth.signOut({scope:'local'});}
}
