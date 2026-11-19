'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '../lib/api';
import {customerAuthClient} from '../lib/customer-auth';
import {birthdayToday,validBirthday} from '../../../../shared/customer-birthday.mjs';
import {openMsg91Widget} from '../lib/msg91-widget';
import ActionFeedback from './ActionFeedback';
import './customer-auth.css';

export default function CustomerAuth({onSignedIn,next='/account'}){
 const [mode,setMode]=useState('signin'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [form,setForm]=useState({firstName:'',lastName:'',email:'',phone:'',password:'',birthday:''});
 const [providerSession,setProviderSession]=useState(null),[linkRequired,setLinkRequired]=useState(false);
 const [legacyOtp,setLegacyOtp]=useState(''),[legacyRequested,setLegacyRequested]=useState(false);
 const inFlight=useRef(false),callbackStarted=useRef(false);
 const destination=()=>{
  const requested='/'+new URLSearchParams(window.location.search).get('next');
  return ['/checkout','/orders'].includes(requested)?requested:['/account','/checkout','/orders'].includes(next)?next:'/account';
 };
 async function run(action){
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setError('');setNotice('');
  try{await action();}catch(error){setError(error.message);}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function finish(session,details=form,legacyToken){
  setProviderSession(session);
  try{
   const result=await api('/api/auth/customer/session',{method:'POST',body:JSON.stringify({
    accessToken:session.access_token,firstName:details.firstName||undefined,lastName:details.lastName||undefined,
    phone:details.phone||undefined,birthday:details.birthday||undefined,legacyToken,
   })});
   sessionStorage.setItem('trd_customer_token',result.token);
   setProviderSession(null);setLinkRequired(false);
   await onSignedIn(result);
  }catch(error){
   if(error.code==='PROFILE_REQUIRED'){
    setMode('profile');setNotice('Finish your profile to continue.');
    const metadata=session.user?.user_metadata||{};
    setForm(previous=>({...previous,email:session.user?.email||previous.email,firstName:metadata.first_name||previous.firstName,lastName:metadata.last_name||previous.lastName,phone:metadata.contact_phone||previous.phone,birthday:metadata.date_of_birth||previous.birthday}));
    return;
   }
   if(error.code==='PHONE_LINK_REQUIRED'){
    const metadata=session.user?.user_metadata||{};
    setForm(previous=>({...previous,email:session.user?.email||previous.email,firstName:details.firstName||metadata.first_name||previous.firstName,lastName:details.lastName||metadata.last_name||previous.lastName,phone:details.phone||metadata.contact_phone||previous.phone,birthday:details.birthday||metadata.date_of_birth||previous.birthday}));
    setLinkRequired(true);setNotice(error.message);return;
   }
   throw error;
  }
 }
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  if(callbackStarted.current)return;
  if(params.get('error_description')){
   setError(params.get('error_description'));window.history.replaceState(null,'',window.location.pathname);return;
  }
  const code=params.get('code');
  if(!code)return;
  callbackStarted.current=true;
  run(async()=>{
   const {client}=await customerAuthClient();
   const {data,error}=await client.auth.exchangeCodeForSession(code);
   window.history.replaceState(null,'',window.location.pathname);
   if(error)throw error;
   if(!data.session)throw new Error('Sign-in did not complete. Please try again.');
   await finish(data.session,{});
  });
 },[]);
 async function submit(event){
  event.preventDefault();
  await run(async()=>{
   if((mode==='signup'||mode==='profile')&&!validBirthday(form.birthday))throw new Error('Enter a valid date of birth, no earlier than 1900 and not in the future.');
   if(mode==='profile'){await finish(providerSession);return;}
   const {client}=await customerAuthClient();
   if(mode==='signup'){
    sessionStorage.setItem('trd_auth_next',destination());
    const {data,error}=await client.auth.signUp({
     email:form.email.trim(),password:form.password,
     options:{emailRedirectTo:window.location.origin+'/account',data:{
      first_name:form.firstName.trim(),last_name:form.lastName.trim(),contact_phone:form.phone.trim(),date_of_birth:form.birthday,
     }},
    });
    if(error)throw error;
    if(data.session)await finish(data.session);
    else{setNotice('Check your email to confirm your account, then sign in.');setMode('signin');setForm(previous=>({...previous,password:''}));}
   }else{
    const {data,error}=await client.auth.signInWithPassword({email:form.email.trim(),password:form.password});
    if(error)throw error;
    await finish(data.session,{});
   }
  });
 }
 async function google(){
  await run(async()=>{
   const {client,config}=await customerAuthClient();
   if(!config.googleEnabled)throw new Error('Google sign-in is awaiting provider setup. Please use email and password.');
   sessionStorage.setItem('trd_auth_next',destination());
   const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/account'}});
   if(error)throw error;
  });
 }
 async function verifyLegacy(){
  await run(async()=>{
   if(legacyRequested){
    const verified=await api('/api/auth/verify-otp',{method:'POST',body:JSON.stringify({phone:form.phone,otp:legacyOtp})});
    await finish(providerSession,form,verified.token);return;
   }
   const result=await api('/api/auth/request-otp',{method:'POST',body:JSON.stringify({phone:form.phone})});
   if(result.widget){
    await openMsg91Widget(form.phone,verified=>run(()=>finish(providerSession,form,verified.token)),setError);
   }else{setLegacyRequested(true);setNotice(result.devOtp?'Development verification code: '+result.devOtp:result.message);}
  });
 }
 const fields=mode==='signup'||mode==='profile';
 const change=event=>{setForm(previous=>({...previous,[event.target.name]:event.target.value}));setError('');};
 return <section className="customer-auth" aria-label="Customer sign-in">
  <h2>{mode==='signup'?'Create your TRENDISE account.':mode==='profile'?'Complete your profile.':'Welcome to your wardrobe.'}</h2>
  {mode!=='profile'&&<div className="customer-auth-tabs">
   <button type="button" aria-pressed={mode==='signin'} disabled={busy} onClick={()=>{setMode('signin');setError('');setNotice('');}}>Sign in</button>
   <button type="button" aria-pressed={mode==='signup'} disabled={busy} onClick={()=>{setMode('signup');setError('');setNotice('');}}>Create account</button>
  </div>}
  <form onSubmit={submit} className="customer-auth-form">
   <fieldset disabled={busy||linkRequired}>
    {fields&&<div className="customer-auth-names">
     <label>First name<input required name="firstName" autoComplete="given-name" maxLength={50} value={form.firstName} onChange={change}/></label>
     <label>Last name<input required name="lastName" autoComplete="family-name" maxLength={50} value={form.lastName} onChange={change}/></label>
    </div>}
    <label>Email<input required type="email" name="email" autoComplete="email" maxLength={254} value={form.email} readOnly={mode==='profile'} onChange={change} placeholder="you@example.com"/></label>
    {fields&&<label>Phone number<input required type="tel" name="phone" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} value={form.phone} onChange={change} placeholder="10-digit Indian mobile number"/></label>}
    {fields&&<label>Date of birth (optional)<input type="date" name="birthday" autoComplete="bday" min="1900-01-01" max={birthdayToday()} value={form.birthday} onChange={change}/><small>Add your birthday to receive birthday offers. Once saved, you cannot change or remove it.</small></label>}
    {mode!=='profile'&&<label>Password<input required type="password" name="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?8:undefined} maxLength={128} value={form.password} onChange={change}/>{mode==='signup'&&<small>Use at least 8 characters.</small>}</label>}
    <button className="button button-dark full" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='profile'?'Save and continue':'Sign in'}</button>
   </fieldset>
  </form>
  {mode!=='profile'&&!linkRequired&&<button type="button" className="button button-line full customer-google" disabled={busy} onClick={google}>Continue with Google</button>}
  {linkRequired&&<div className="customer-auth-link">
   <p>Verify {form.phone} once to keep your existing orders and rewards with this account.</p>
   {legacyRequested&&<label>Verification code<input value={legacyOtp} onChange={event=>setLegacyOtp(event.target.value)} autoComplete="one-time-code" inputMode="numeric" maxLength={6}/></label>}
   <button type="button" className="button button-dark" disabled={busy} onClick={verifyLegacy}>{legacyRequested?'Verify and link account':'Verify existing mobile account'}</button>
  </div>}
  <ActionFeedback error={error} success={notice} pending={busy?'Completing sign-in…':''}/>
 </section>;
}
