'use client';
import {useEffect,useState} from 'react';
import {api,cash} from '../lib/api';

export default function PosPromotions({token}) {
 const [variants,setVariants]=useState({}),[sku,setSku]=useState(''),[type,setType]=useState('none'),[value,setValue]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{api('/api/admin/pos-promotions',{token}).then(setVariants).catch(error=>setError(error.message));},[token]);
 function select(sku) {
  setSku(sku);setType(variants[sku]?.rule?.type||'none');setValue(variants[sku]?.rule?.value??'');setNotice('');
 }
 async function save(event) {
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try {
   setVariants(await api('/api/admin/pos-promotions',{token,method:'POST',body:JSON.stringify({sku,type,value:Number(value)})}));
   setNotice('Store promotion saved.');
  } catch(error) {setError(error.message);}
  finally {setBusy(false);}
 }
 return <section className="staff-panel"><h2>Store POS promotions</h2><p>Set an automatic percentage discount or a flat final selling price for a published variant.</p>
  <form className="m02-grid" onSubmit={save}>
   <label>Product variant<select required disabled={busy} value={sku} onChange={event=>select(event.target.value)}><option value="">Choose a product and size</option>{Object.entries(variants).map(([sku,entry])=><option key={sku} value={sku}>{entry.name} · {entry.color} / {entry.size} · {sku}</option>)}</select></label>
   <label>Promotion<select value={type} onChange={event=>setType(event.target.value)}><option value="none">No promotion</option><option value="percent">Percentage off</option><option value="fixed">Flat final price (₹)</option></select></label>
   {type!=='none'&&<label>{type==='percent'?'Discount %':'Final price (₹)'}<input required type="number" min=".01" step=".01" value={value} placeholder={type==='percent'?'e.g. 15':'e.g. 1299'} onChange={event=>setValue(event.target.value)}/></label>}
   {sku&&<p>Store price {cash(variants[sku]?.regularPrice)} · Current scan price {cash(variants[sku]?.salePrice)}</p>}
   <button disabled={!sku||busy}>Save store promotion</button>
  </form>
  {error&&<p role="alert" className="error-box">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
