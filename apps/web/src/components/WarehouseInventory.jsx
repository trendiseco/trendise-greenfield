'use client';
import {useEffect,useState} from 'react';
import {api,cash} from '../lib/api';
import StorePhoto from './StorePhoto';

export default function WarehouseInventory({token,onSessionExpired}){
 const [input,I]=useState(''),[search,S]=useState(''),[category,C]=useState('all'),[location,L]=useState('all'),[stock,K]=useState('all'),[page,P]=useState(1),[result,R]=useState(null),[loading,B]=useState(true),[error,E]=useState(''),[refresh,F]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();B(true);E('');
  api('/api/warehouse/inventory?'+new URLSearchParams({q:search,category,location,stock,page:String(page)}),{token,signal:controller.signal})
   .then(data=>{if(!controller.signal.aborted){R(data);B(false);}})
   .catch(e=>{if(!controller.signal.aborted){if(e.status===401)onSessionExpired();else E(e.message);B(false);}});
  return()=>controller.abort();
 },[token,search,category,location,stock,page,refresh,onSessionExpired]);
 const change=(setter,value)=>{setter(value);P(1);};
 return <section className="staff-panel warehouse-inventory" aria-labelledby="warehouse-inventory-title">
  <div className="panel-heading"><div><h2 id="warehouse-inventory-title">Products &amp; inventory</h2><p className="hint">Shared stock across all locations. View only; stock adjustments are managed in Admin.</p></div><button className="small-outline" disabled={loading} onClick={()=>F(n=>n+1)}>Refresh inventory</button></div>
  <div className="warehouse-inventory-content">
   <form className="warehouse-inventory-search" onSubmit={e=>{e.preventDefault();change(S,input.trim());}}>
    <label>Find products or scan a barcode<input type="search" value={input} onChange={e=>I(e.target.value)} maxLength={100} placeholder="e.g. Oxford or SH-OXF-SKY-M" autoComplete="off"/></label>
    <button className="button button-dark" type="submit">Search</button>
    <button className="small-outline" type="button" onClick={()=>{I('');S('');C('all');L('all');K('all');P(1);}}>Clear filters</button>
   </form>
   <div className="warehouse-inventory-filters">
    <label>Location<select value={location} onChange={e=>change(L,e.target.value)}><option value="all">All locations</option>{result?.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    <label>Category<select value={category} onChange={e=>change(C,e.target.value)}><option value="all">All categories</option>{result?.categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Stock<select value={stock} onChange={e=>change(K,e.target.value)}><option value="all">All stock statuses</option><option value="available">Available</option><option value="unavailable">No available stock</option></select></label>
   </div>
   {loading?<p role="status">Loading inventory…</p>:error?<p className="error-box" role="alert">{error}</p>:result&&<>
    <p className="hint" role="status">{result.productCount} {result.productCount===1?'product':'products'} · {result.total} {result.total===1?'variant':'variants'}</p>
    {result.items.length===0?<p>No inventory matches these filters.</p>:<div className="warehouse-stock-scroll"><table className="warehouse-stock-table">
     <caption className="hint">On hand is stock in the inventory system. Reserved units are held for checkout. Inactive variants show zero available.</caption>
     <thead><tr><th scope="col">Product</th><th scope="col">Variant &amp; codes</th><th scope="col">On hand</th><th scope="col">Reserved</th><th scope="col">Available</th><th scope="col">Location breakdown</th></tr></thead>
     <tbody>{result.items.map(item=><tr key={item.sku}>
      <td><div className="warehouse-stock-product"><StorePhoto className="warehouse-stock-photo" product={{...item,variants:[{color:item.color}]}} color={item.color} src={item.photo?.src} alt={item.photo?.alt}/><div><strong>{item.name}</strong><small>{item.category} · {cash(item.price)}</small><small>{item.active?'Active':'Inactive'}{!item.websiteVisible?' · Hidden online':''}</small></div></div></td>
      <td><strong>{item.color} / {item.size}</strong><small>SKU: <code>{item.sku}</code></small><small>Barcode: <code>{item.barcode}</code></small></td>
      <td>{item.totals.onHand}</td><td>{item.totals.reserved}</td><td><strong>{item.totals.available}</strong></td>
      <td><details><summary>{item.balances.length===1?item.balances[0].name:'View locations'}</summary>{item.balances.map(b=><div className="warehouse-stock-location" key={b.id}><strong>{b.name}</strong><small>{b.onHand} on hand · {b.reserved} reserved · {b.available} available</small></div>)}</details></td>
     </tr>)}</tbody>
    </table></div>}
    {result.pageCount>1&&<div className="button-row warehouse-stock-pages"><button className="small-outline" disabled={result.page<=1} onClick={()=>P(result.page-1)}>Previous</button><span>Page {result.page} of {result.pageCount}</span><button className="small-outline" disabled={result.page>=result.pageCount} onClick={()=>P(result.page+1)}>Next</button></div>}
   </>}
  </div>
 </section>;
}
