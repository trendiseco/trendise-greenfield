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

 const portalLabel=staffPortals.find(entry=>entry.id===portal).label;
 if(loading)return <main className="container section-pad"><p role="status">Checking staff access…</p></main>;
 if(!session)return <main className="container staff-login-page">
  <form className="staff-login-card" onSubmit={login}>
   <h1>{portalLabel}</h1>
   <p>Sign in with your staff account.</p>
   <label>Staff ID<input required autoComplete="username" value={userId} onChange={event=>setUserId(event.target.value)}/></label>
   <label>Staff PIN<input required type="password" autoComplete="current-password" inputMode="numeric" value={pin} onChange={event=>setPin(event.target.value)}/></label>
   <button className="button button-dark" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
   <ActionFeedback error={error}/>
  </form>
 </main>;

 const available=staffPortals.filter(entry=>staffCanOpen(entry.id,session.profile));
 return <StaffContext.Provider value={{...session,logout}}>
  {available.length>0&&<nav className="container button-row staff-portal-nav" aria-label="Staff portals">
   {available.map(entry=><Link key={entry.id} href={entry.href} aria-current={entry.id===portal?'page':undefined}
    className={`button ${entry.id===portal?'button-dark':'button-line'}`}>{entry.label}</Link>)}
  </nav>}
  {staffCanOpen(portal,session.profile)?children:<main className="container section-pad">
   <h1>Access restricted</h1>
   <p>{available.length?'Your role or location does not grant access to this page. Choose one of your available portals above.':'No staff portals are assigned to your account.'}</p>
   <button className="button button-line" disabled={busy} onClick={logout}>Sign out</button>
  </main>}
  <ActionFeedback error={error}/>
 </StaffContext.Provider>;
}
