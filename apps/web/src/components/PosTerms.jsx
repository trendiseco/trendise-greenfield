'use client';
import {receiptFields} from '../../../../shared/pos-receipt.mjs';
import {posExchangeTerms} from '../../../../shared/order-policy.mjs';
import ActionFeedback from './ActionFeedback';
import {useEffect,useState} from 'react';
import {api} from '../lib/api';

export default function PosTerms({token}) {
 const [receipt,setReceipt]=useState({});
 const [text,setText]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  api('/api/admin/pos-terms',{token,signal:controller.signal})
   .then(result=>{setText(result.text);setReceipt(result.receipt||{});})
   .catch(error=>{if(!controller.signal.aborted)setError(error.message);});
  return ()=>controller.abort();
 },[token]);

 async function save(event) {
  event.preventDefault();
  setSaving(true);setError('');setNotice('');
  try {
   const result=await api('/api/admin/pos-terms',{token,method:'POST',body:JSON.stringify({text,receipt})});
   setText(result.text);setReceipt(result.receipt||{});
   setNotice('Billing details and terms saved. They will appear on new store receipts.');
  } catch(error) {setError(error.message);}
  finally {setSaving(false);}
 }

 return <section className="staff-panel pos-history">
  <h2>Store POS Terms & Conditions</h2>
  <p>{posExchangeTerms}</p><p>Additional receipt notes print below this policy on new bills. Reprints use the original receipt terms.</p>
  {text!==null&&<form className="cms-fields" onSubmit={save}>
   <h3>Receipt billing details</h3><p>Leave optional details blank to omit them from the bill. Reprints retain the details saved with the original sale.</p>
   {Object.entries(receiptFields).map(([key,label])=><label className={key==='address'?'cms-field cms-full':'cms-field'} key={key}>{label}{key==='address'?<textarea rows={3} maxLength={600} value={receipt[key]||''} onChange={e=>setReceipt({...receipt,[key]:e.target.value})}/>:<input type={key==='email'?'email':'text'} maxLength={150} value={receipt[key]||''} placeholder={key==='businessName'?'e.g. TRENDISE':undefined} onChange={e=>setReceipt({...receipt,[key]:e.target.value})}/>}</label>)}
   <label className="cms-field cms-full">Receipt terms<textarea rows={10} required maxLength={6000} value={text} disabled={saving}
    placeholder="e.g. Keep the original receipt and product tags for exchanges."
    onChange={event=>{setText(event.target.value);setNotice('');}}/></label>
   <div><button disabled={saving||!text.trim()}>{saving?'Saving…':'Save receipt details & terms'}</button><ActionFeedback error={error} success={notice} pending={saving?'Saving receipt terms…':''}/></div>
  </form>}
  {text===null&&!error&&<p role="status">Loading receipt terms…</p>}
  {text===null&&<ActionFeedback error={error}/>}
 </section>;
}
