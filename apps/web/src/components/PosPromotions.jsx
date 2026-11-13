'use client';
import {useEffect,useState} from 'react';
import {api,cash} from '../lib/api';

const columns=['SKU','Barcode','Product','Category','Colour','Size','Active','Warehouse units','Store units','Website price','Store base price','POS scan price'];

export default function PosPromotions({token}) {
 const [variants,setVariants]=useState({}),[scope,setScope]=useState('variant'),[target,setTarget]=useState('');
 const [type,setType]=useState('none'),[value,setValue]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{api('/api/admin/pos-promotions',{token}).then(setVariants).catch(error=>setError(error.message));},[token]);
 const entries=Object.entries(variants);
 const choices=scope==='category'?[...new Set(entries.map(([,entry])=>entry.category))].sort().map(name=>[name,name])
  :scope==='product'?[...new Map(entries.map(([,entry])=>[entry.productId,entry.name]))]
  :entries.map(([sku,entry])=>[sku,`${entry.name} · ${entry.color} / ${entry.size} · ${sku}`]);
 function select(target) {
  const rule=scope==='variant'?variants[target]?.rule:null;
  setTarget(target);setType(rule?.type||'none');setValue(rule?.value??'');setNotice('');
 }
 async function run(action) {
  setBusy(true);setError('');setNotice('');
  try {await action();} catch(error){setError(error.message);}
  finally{setBusy(false);}
 }
 function save(event) {
  event.preventDefault();
  run(async()=>{
   setVariants(await api('/api/admin/pos-promotions',{token,method:'POST',body:JSON.stringify({sku:target,scope,target,type,value:Number(value)})}));
   localStorage.setItem('trd_pos_prices_updated',String(Date.now()));
   setNotice('Store promotion saved for the selected variants.');
  });
 }
 function download() {
  run(async()=>{
   const {default:Excel}=await import('exceljs/dist/exceljs.min.js');
   const book=new Excel.Workbook(),sheet=book.addWorksheet('Store POS prices');
   sheet.addRow(columns);
   sheet.getRow(1).font={bold:true};
   sheet.views=[{state:'frozen',ySplit:1}];
   sheet.autoFilter='A1:L1';
   columns.forEach((label,index)=>{sheet.getColumn(index+1).width=Math.max(14,label.length+3);});
   sheet.getColumn(2).numFmt='@';
   for(const [sku,entry] of entries)sheet.addRow([sku,entry.barcode,entry.name,entry.category,entry.color,entry.size,
    entry.active?'Yes':'No',entry.stock?.['warehouse-hyd']??0,entry.stock?.['store-hyd-01']??0,
    entry.websitePrice,entry.regularPrice,entry.salePrice]);
   const url=URL.createObjectURL(new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const link=document.createElement('a');link.href=url;link.download='trendise-store-pos-prices.xlsx';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
 }
 function upload(event) {
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  run(async()=>{
   if(file.size>5*1024*1024)throw new Error('Choose an Excel workbook under 5 MB.');
   const {default:Excel}=await import('exceljs/dist/exceljs.min.js');
   const book=new Excel.Workbook();await book.xlsx.load(await file.arrayBuffer());
   const sheet=book.getWorksheet('Store POS prices');
   if(!sheet||columns.some((name,index)=>sheet.getRow(1).getCell(index+1).value!==name))throw new Error('Use the downloaded Store POS workbook and keep its column headings.');
   const rows=[];
   sheet.eachRow((row,index)=>{
    if(index===1)return;
    const sku=row.getCell(1).value,barcode=row.getCell(2).value,price=row.getCell(12).value;
    if(typeof sku!=='string'||typeof barcode!=='string'||typeof price!=='number')throw new Error(`Excel row ${index}: keep SKU and barcode as text and enter a numeric POS scan price.`);
    rows.push({sku,barcode,price});
   });
   const result=await api('/api/admin/pos-price-import',{token,method:'POST',body:JSON.stringify({rows})});
   setVariants(result.catalog);
   localStorage.setItem('trd_pos_prices_updated',String(Date.now()));
   setNotice(`Updated ${result.updated} POS scan prices.`);
  });
 }
 return <section className="staff-panel"><h2>Store POS promotions</h2>
  <form className="m02-grid" onSubmit={save}>
   <label>Apply to<select value={scope} onChange={event=>{setScope(event.target.value);setTarget('');setType('none');setValue('');}}>
    <option value="variant">One variant</option><option value="product">Product</option><option value="category">Category</option><option value="all">Entire stock</option>
   </select></label>
   {scope!=='all'&&<label>Selection<select required disabled={busy} value={target} onChange={event=>select(event.target.value)}><option value="">Choose an item</option>{choices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
   <label>Promotion<select value={type} onChange={event=>setType(event.target.value)}><option value="none">Clear promotion</option><option value="percent">Percentage off</option><option value="fixed">Flat final price (₹)</option></select></label>
   {type!=='none'&&<label>{type==='percent'?'Discount %':'Final price (₹)'}<input required type="number" min=".01" step=".01" value={value} placeholder={type==='percent'?'e.g. 15':'e.g. 1299'} onChange={event=>setValue(event.target.value)}/></label>}
   {scope==='variant'&&target&&<p>Store price {cash(variants[target]?.regularPrice)} · Current scan price {cash(variants[target]?.salePrice)}</p>}
   <button disabled={busy||(!target&&scope!=='all')}>Save store promotion</button>
  </form>
  <h3>Bulk pricing in Excel</h3>
  <p>Edit the POS scan price column and upload the workbook. Changed prices become the store price and clear any promotion on those rows.</p>
  <button disabled={busy||!entries.length} onClick={download}>Download stock workbook</button>
  <label>Upload updated prices<input disabled={busy} type="file" accept=".xlsx" onChange={upload}/></label>
  {error&&<p role="alert" className="error-box">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
