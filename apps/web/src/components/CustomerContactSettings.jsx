'use client';
import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import ActionFeedback from './ActionFeedback';

export default function CustomerContactSettings({token}){
 const [contact,setContact]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  api('/api/admin/customer-contact',{token,signal:controller.signal}).then(setContact).catch(error=>{if(!controller.signal.aborted)setError(error.message);});
  return()=>controller.abort();
 },[token]);
 async function save(event){
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   setContact(await api('/api/admin/customer-contact',{token,method:'POST',body:JSON.stringify(contact)}));
   localStorage.setItem('trd_website_updated',String(Date.now()));
   setNotice('Customer contact details saved and published to About Us.');
  }catch(error){setError(error.message);}
  finally{setBusy(false);}
 }
 return <section className="staff-panel">
  <h3>Customer contact details</h3><p>These public details appear on About Us. Saving publishes them immediately.</p>
  {contact?<form onSubmit={save} className="m02-grid">
   <label>Indian customer support mobile<input type="tel" required pattern="[6-9][0-9]{9}" maxLength={10} placeholder="e.g. 8712435445" value={contact.phone} disabled={busy} onChange={event=>setContact({...contact,phone:event.target.value})}/></label>
   <label>Customer support email<input type="email" required maxLength={254} placeholder="e.g. trendise@trendise.co.in" value={contact.email} disabled={busy} onChange={event=>setContact({...contact,email:event.target.value})}/></label>
   <button disabled={busy}>{busy?'Saving…':'Save contact details'}</button>
   <ActionFeedback error={error} success={notice} pending={busy?'Saving contact details…':''}/>
  </form>:<ActionFeedback error={error} pending="Loading customer contact details…"/>}
 </section>;
}
