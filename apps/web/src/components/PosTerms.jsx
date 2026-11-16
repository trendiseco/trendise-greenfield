'use client';
import ActionFeedback from './ActionFeedback';
import {useEffect,useState} from 'react';
import {api} from '../lib/api';

export default function PosTerms({token}) {
 const [text,setText]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  api('/api/admin/pos-terms',{token,signal:controller.signal})
   .then(result=>setText(result.text))
   .catch(error=>{if(!controller.signal.aborted)setError(error.message);});
  return ()=>controller.abort();
 },[token]);

 async function save(event) {
  event.preventDefault();
  setSaving(true);setError('');setNotice('');
  try {
   const result=await api('/api/admin/pos-terms',{token,method:'POST',body:JSON.stringify({text})});
   setText(result.text);
   setNotice('Terms saved. They will appear on new store receipts.');
  } catch(error) {setError(error.message);}
  finally {setSaving(false);}
 }

 return <section className="staff-panel pos-history">
  <h2>Store POS Terms & Conditions</h2>
  <p>New bills print this text as entered, including line breaks. Reprints use the terms saved with the original bill.</p>
  {text!==null&&<form className="cms-fields" onSubmit={save}>
   <label className="cms-field cms-full">Receipt terms<textarea rows={10} required maxLength={6000} value={text} disabled={saving}
    placeholder="e.g. Keep the original receipt and product tags for returns."
    onChange={event=>{setText(event.target.value);setNotice('');}}/></label>
   <div><button disabled={saving||!text.trim()}>{saving?'Saving…':'Save receipt terms'}</button><ActionFeedback error={error} success={notice} pending={saving?'Saving receipt terms…':''}/></div>
  </form>}
  {text===null&&!error&&<p role="status">Loading receipt terms…</p>}
  {text===null&&<ActionFeedback error={error}/>}
 </section>;
}
