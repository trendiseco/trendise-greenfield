'use client';
import ActionFeedback from './ActionFeedback';
import {useState} from 'react';
import {api} from '../lib/api';
import {customerHistoryWorkbook} from '../lib/customer-history-export.mjs';
import PurchaseChannel from './PurchaseChannel';
import {PosSaleList,WebsiteOrderList} from './PosHistory';

export default function CustomerExtract({token}) {
 const [channel,setChannel]=useState('sales'),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [exporting,setExporting]=useState(false);
 const label=channel==='sales'?'Store POS':'Website';
 const count=result?.[channel].length??0;
 function change(setter,value) {
  setter(value);setResult(null);setError('');
 }
 async function search(event) {
  event.preventDefault();setBusy(true);setResult(null);setError('');
  try {
   const query=new URLSearchParams({channel,from,to});
   setResult(await api('/api/admin/customer-extract?'+query,{token}));
  }catch(error){setError(error.message);}
  finally{setBusy(false);}
 }
 async function download() {
  setExporting(true);setError('');
  try {
   const {default:Excel}=await import('exceljs/dist/exceljs.min.js');
   const data=await customerHistoryWorkbook(Excel,result).xlsx.writeBuffer();
   const url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const link=document.createElement('a');
   link.href=url;
   link.download=`trendise-${channel==='sales'?'store-pos':'website'}-${from}-to-${to}.xlsx`;
   link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){setError(error.message);}
  finally{setExporting(false);}
 }
 const locked=busy||exporting;
 return <section className="staff-panel pos-history">
  <h2>Data extract · {label}</h2>
  <PurchaseChannel channel={channel} disabled={locked} onChange={value=>{if(value!==channel)change(setChannel,value);}}/>
  <form className="m02-grid" onSubmit={search}>
   <label>From date<input type="date" required value={from} max={to||undefined} disabled={locked} onChange={event=>change(setFrom,event.target.value)}/></label>
   <label>To date<input type="date" required value={to} min={from||undefined} disabled={locked} onChange={event=>change(setTo,event.target.value)}/></label>
   <div className="button-row">
    <button className="button button-dark" disabled={locked}>{busy?'Searching…':'Search'}</button>
    <button type="button" className="button button-dark" disabled={locked||!count} onClick={download}>{exporting?'Preparing Excel…':'Download Excel'}</button>
   </div>
   <ActionFeedback error={error} success={result?`${count} ${label} purchases found.`:''}/>
  </form>
  {!result&&!error&&<p className="hint">Search a date range to enable the Excel download. Both dates are inclusive in India time.</p>}
  {count>0&&<section aria-label={label+' purchase results'} key={channel+from+to}>
   {channel==='sales'?<PosSaleList sales={result.sales}/>:<WebsiteOrderList orders={result.orders}/>}
  </section>}
 </section>;
}
