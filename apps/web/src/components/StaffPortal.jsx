'use client';
import Link from 'next/link';
import {createContext,useContext,useEffect,useState} from 'react';
import {staffCanOpen,staffPortals} from '../../../../shared/staff-access.mjs';
import {api} from '../lib/api';
import ActionFeedback from './ActionFeedback';

const tokenKey='trd_staff_token';
const StaffContext=createContext(null);
export const useStaff=()=>useContext(StaffContext);

export default function StaffPortal({portal,children}) {
 const [session,setSession]=useState(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [userId,setUserId]=useState('');
 const [pin,setPin]=useState('');
 const [busy,setBusy]=useState(false);

 useEffect(()=>{
  const token=sessionStorage.getItem(tokenKey);
  if(!token){setLoading(false);return;}
  const controller=new AbortController();
  const refresh=async()=>{
   try {
    const profile=await api('/api/me',{token,signal:controller.signal});
    if(!controller.signal.aborted)setSession({token,profile});
   } catch (error) {
    if(controller.signal.aborted)return;
    if(error.status===401){sessionStorage.removeItem(tokenKey);setSession(null);}
    setError(error.message);
   } finally {
    if(!controller.signal.aborted)setLoading(false);
   }
  };
  refresh();
  window.addEventListener('focus',refresh);
  return ()=>{controller.abort();window.removeEventListener('focus',refresh);};
 },[session?.token]);

 async function login(event) {
  event.preventDefault();
  setBusy(true);setError('');
  try {
   const {token,...profile}=await api('/api/auth/staff',{method:'POST',body:JSON.stringify({userId:userId.trim(),pin})});
   sessionStorage.setItem(tokenKey,token);
   setSession({token,profile});setPin('');
  } catch(error){setError(error.message);}
  finally{setBusy(false);}
 }

 async function logout() {
  setBusy(true);setError('');
  try {
   await api('/api/auth/staff/logout',{token:session.token,method:'POST'});
  } catch(error) {
   if(error.status!==401){setError(error.message);return;}
  } finally {setBusy(false);}
  sessionStorage.removeItem(tokenKey);setSession(null);
 }

 if(loading)return <main className="container section-pad"><p role="status">Checking staff access…</p></main>;
 if(portal&&(!session||!staffCanOpen(portal,session.profile)))return <main className="container section-pad">
  <h1>{session?'Access restricted':'Staff sign-in required'}</h1>
  <p>{session?'Your assigned role or location does not grant access to this portal.':'Sign in through Operations to open your staff portals.'}</p>
  <Link className="button button-dark" href="/operations">Go to Operations</Link>
 </main>;
 if(portal)return <StaffContext.Provider value={{...session,logout}}>
  {children}
  <ActionFeedback error={error}/>
 </StaffContext.Provider>;

 return <main className="staff-shell operations-workspace">
  <div className="staff-page-header"><div><div className="eyebrow">TRENDISE</div><h1>Operations</h1>
   {session&&<p>Signed in as {session.profile.userId} · {session.profile.role}</p>}</div>
   {session&&<button className="button button-line" disabled={busy} onClick={logout}>Sign out</button>}
  </div>
  {!session?<form className="staff-login-card" onSubmit={login}>
   <h2>Staff sign in</h2>
   <label>Staff ID<input required autoComplete="username" value={userId} onChange={event=>setUserId(event.target.value)}/></label>
   <label>Staff PIN<input required type="password" autoComplete="current-password" inputMode="numeric" value={pin} onChange={event=>setPin(event.target.value)}/></label>
   <button className="button button-dark" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
  </form>:<section className="staff-panel" aria-label="Available portals">
   <div className="button-row">{staffPortals.filter(entry=>staffCanOpen(entry.id,session.profile)).map(entry=>
    <Link className="button button-dark" key={entry.id} href={entry.href}>{entry.label}</Link>
   )}</div>
   {!staffPortals.some(entry=>staffCanOpen(entry.id,session.profile))&&<p>No portals are assigned to your account.</p>}
  </section>}
  <ActionFeedback error={error}/>
 </main>;
}
