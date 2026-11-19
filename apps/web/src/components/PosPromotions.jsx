'use client';
import {promotionSchedule} from '../../../../shared/promotion-schedule.mjs';
import ActionFeedback from './ActionFeedback';
import {useEffect,useState} from 'react';
import {api,cash} from '../lib/api';

const posColumns=['SKU','Barcode','Product','Category','Colour','Size','Active','Central warehouse units','Website price','Store base price','POS scan price'];

export default function PosPromotions({token,online=false,canImport=true,canPromote=true}) {
 const label=online?'Website':'Store POS';
 const endpoint='/api/admin/'+(online?'website':'pos');
 const sheetName=label+' prices';
 const priceColumn=online?'Website offer price':'POS scan price';
 const columns=online?[...posColumns.slice(0,8),'Website regular price','Store base price',priceColumn,'Start date','End date']:posColumns;
 const updateKey=online?'trd_website_prices_updated':'trd_pos_prices_updated';
 const [variants,setVariants]=useState({}),[scope,setScope]=useState('variant'),[target,setTarget]=useState('');
 const [type,setType]=useState('none'),[value,setValue]=useState('');
 const [action,setAction]=useState('');
 const [start,setStart]=useState(''),[end,setEnd]=useState(''),[bulkStart,setBulkStart]=useState(''),[bulkEnd,setBulkEnd]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState('');
 useEffect(()=>{api(endpoint+'-promotions',{token}).then(setVariants).catch(error=>setError(error.message));},[token,endpoint]);
 const entries=Object.entries(variants);
 const choices=scope==='category'?[...new Set(entries.map(([,entry])=>entry.category))].sort().map(name=>[name,name])
  :scope==='product'?[...new Map(entries.map(([,entry])=>[entry.productId,entry.name]))]
  :entries.map(([sku,entry])=>[sku,`${entry.name} · ${entry.color} / ${entry.size} · ${sku}`]);
 function select(target) {
  const rule=scope==='variant'?variants[target]?.rule:null;
  setStart(rule?.start||'');setEnd(rule?.end||'');
  setTarget(target);setType(rule?.type||'none');setValue(rule?.value??'');setNotice('');
 }
 async function run(message,action) {
  setBusy(message);setError('');setNotice('');
  try {await action();} catch(error){setError(error.message);}
  finally{setBusy('');}
 }
 function save(event) {
  event.preventDefault();
  setAction('promotion');
  run('Saving promotion…',async()=>{
   setVariants(await api(endpoint+'-promotions',{token,method:'POST',body:JSON.stringify({sku:target,scope,target,type,value:Number(value),...(online?{start,end}:{})})}));
   localStorage.setItem(updateKey,String(Date.now()));
   setNotice(label+' promotion saved for the selected variants.');
  });
 }
 function download() {
  setAction('download');
  run('Preparing stock workbook…',async()=>{
   if(online)promotionSchedule(bulkStart,bulkEnd);
   const {default:Excel}=await import('exceljs/dist/exceljs.min.js');
   const book=new Excel.Workbook(),sheet=book.addWorksheet(sheetName);
   sheet.addRow(columns);
   sheet.getRow(1).font={bold:true};
   sheet.views=[{state:'frozen',ySplit:1}];
   sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:columns.length}};
   columns.forEach((label,index)=>{sheet.getColumn(index+1).width=Math.max(14,label.length+3);});
   sheet.getColumn(2).numFmt='@';
   for(const [sku,entry] of entries)sheet.addRow([sku,entry.barcode,entry.name,entry.category,entry.color,entry.size,
    entry.active?'Yes':'No',entry.onHand,
    entry.websitePrice,online?entry.storePrice:entry.regularPrice,online&&entry.rule?entry.rule.type==='fixed'?entry.rule.value:Math.round(entry.regularPrice*(100-entry.rule.value))/100:entry.salePrice,...(online?[entry.rule?.start||bulkStart,entry.rule?.end||bulkEnd]:[])]);
   const url=URL.createObjectURL(new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const link=document.createElement('a');link.href=url;link.download=online?'trendise-website-prices.xlsx':'trendise-store-pos-prices.xlsx';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
 }
 function upload(event) {
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  setAction('upload');
  run('Importing prices…',async()=>{
   if(online)promotionSchedule(bulkStart,bulkEnd);
   if(file.size>5*1024*1024)throw new Error('Choose an Excel workbook under 5 MB.');
   const {default:Excel}=await import('exceljs/dist/exceljs.min.js');
   const book=new Excel.Workbook();await book.xlsx.load(await file.arrayBuffer());
   const sheet=book.getWorksheet(sheetName);
   if(!sheet||columns.some((name,index)=>sheet.getRow(1).getCell(index+1).value!==name))throw new Error('Use the downloaded workbook and keep its column headings.');
   const rows=[];
   sheet.eachRow((row,index)=>{
    if(index===1)return;
    const sku=row.getCell(1).value,barcode=row.getCell(2).value,price=row.getCell(11).value;
    if(typeof sku!=='string'||typeof barcode!=='string'||typeof price!=='number')throw new Error(`Excel row ${index}: keep SKU and barcode as text and enter a numeric ${priceColumn.toLowerCase()}.`);
    const dateValue=(cell,fallback)=>{const value=cell.value;if(value==null||value==='')return fallback;if(value instanceof Date)return value.toISOString().slice(0,10);if(typeof value==='string')return value.trim();throw new Error(`Excel row ${index}: dates must use YYYY-MM-DD.`);};
    rows.push({sku,barcode,price,...(online?{start:dateValue(row.getCell(12),bulkStart),end:dateValue(row.getCell(13),bulkEnd)}:{})});
   });
   const result=await api(endpoint+'-price-import',{token,method:'POST',body:JSON.stringify({rows})});
   setVariants(result.catalog);
   localStorage.setItem(updateKey,String(Date.now()));
   setNotice(`Updated ${result.updated} ${priceColumn.toLowerCase()}s.`);
  });
 }
 const feedback=key=>action===key&&<ActionFeedback error={error} success={notice} pending={busy}/>;
 return <section className="staff-panel"><h2>{label} promotions</h2>
  <form className="m02-grid" onSubmit={save}>
   <label>Apply to<select value={scope} onChange={event=>{setScope(event.target.value);setTarget('');setType('none');setValue('');setStart('');setEnd('');}}>
    <option value="variant">One variant</option><option value="product">Product</option><option value="category">Category</option><option value="all">Entire stock</option>
   </select></label>
   {scope!=='all'&&<label>Selection<select required disabled={busy} value={target} onChange={event=>select(event.target.value)}><option value="">Choose an item</option>{choices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
   <label>Promotion<select value={type} onChange={event=>setType(event.target.value)}><option value="none">Clear promotion</option><option value="percent">Percentage off</option><option value="fixed">Flat final price (₹)</option></select></label>
   {type!=='none'&&<label>{type==='percent'?'Discount %':'Final price (₹)'}<input required type="number" min=".01" step=".01" value={value} placeholder={type==='percent'?'e.g. 15':'e.g. 1299'} onChange={event=>setValue(event.target.value)}/></label>}
   {online&&<><label>Start date<input required={type!=='none'} disabled={type==='none'} type="date" value={start} max={end||undefined} onChange={e=>setStart(e.target.value)}/></label><label>End date<input required={type!=='none'} disabled={type==='none'} type="date" value={end} min={start||undefined} onChange={e=>setEnd(e.target.value)}/></label><p>Active from the start of the start date through the end of the end date, India time (IST).</p></>}
   {scope==='variant'&&target&&<p>Regular price {cash(variants[target]?.regularPrice)} · Current selling price {cash(variants[target]?.salePrice)}</p>}
   <button disabled={busy||!canPromote||(!target&&scope!=='all')}>Save promotion</button>{feedback('promotion')}
  </form>
  <h3>Bulk pricing in Excel</h3>
  <p>{online?'Edit Website offer price, Start date and End date in the workbook (YYYY-MM-DD). Dates are inclusive in India time. The regular price clears the offer. Existing coupons apply to the offer subtotal.':'Edit the POS scan price column and upload the workbook. Changed prices become the store price and clear any promotion on those rows.'}</p>
  {online&&<div className="m02-grid"><label>Bulk start date<input type="date" value={bulkStart} max={bulkEnd||undefined} onChange={e=>setBulkStart(e.target.value)}/></label><label>Bulk end date<input type="date" value={bulkEnd} min={bulkStart||undefined} onChange={e=>setBulkEnd(e.target.value)}/></label><p>Used for workbook rows with blank dates. Row dates override these defaults. Leave blank for an offer without a date limit.</p></div>}
  <button disabled={busy||!entries.length} onClick={download}>Download stock workbook</button>{feedback('download')}
  <label>Upload updated prices<input disabled={busy||!canImport} type="file" accept=".xlsx" onChange={upload}/></label>
  {feedback('upload')}{!action&&<ActionFeedback error={error}/>}
 </section>;
}
