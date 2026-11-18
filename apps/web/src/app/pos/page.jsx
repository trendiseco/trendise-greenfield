'use client';
import ActionFeedback from '../../components/ActionFeedback';
import StaffPortal,{useStaff} from '../../components/StaffPortal';
import {useEffect,useMemo,useRef,useState} from 'react';
import StorePhoto from '../../components/StorePhoto';
import PosHistory,{PosReceipt,PosSaleList} from '../../components/PosHistory';
import {api,cash,uniqueKey} from '../../lib/api';

const refreshInterval=5000;
const periods={today:'Today',week:'This week',month:'This month',year:'This year',previous:'Select a year'};

function Dashboard({token,onReceipt,canCreateExamples}) {
 const [year,setYear]=useState(''),[years,setYears]=useState([]),[revision,setRevision]=useState(0),[creating,setCreating]=useState(false),[notice,setNotice]=useState('');
 const [period,setPeriod]=useState('today'),[report,setReport]=useState(null),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  const query=period==='previous'?'period=year'+(year?'&year='+year:''):'period='+period;
  let pending=false;
  const refresh=async()=>{
   if(pending||document.hidden)return;
   pending=true;
   try {
    const result=await api('/api/pos/dashboard?'+query,{token,signal:controller.signal});
    if(controller.signal.aborted)return;
    setYears(result.years);
    setReport(result);
    setError('');
    if(period==='previous'&&!year)setYear(String(result.years.find(value=>value<result.currentYear)??result.currentYear));
   } catch(error){
    if(!controller.signal.aborted)setError(error.message);
   } finally {pending=false;}
  };
  refresh();
  const timer=setInterval(refresh,refreshInterval);
  window.addEventListener('focus',refresh);
  return ()=>{
   clearInterval(timer);
   window.removeEventListener('focus',refresh);
   controller.abort();
  };
 },[period,year,token,revision]);
 async function createExamples(){
  setCreating(true);setError('');setNotice('');
  try {
   const result=await api('/api/pos/examples',{token,method:'POST'});
   setNotice(result.created ? `${result.created} sample bills saved. Search 9999900001 to see all of them.` : 'Sample bills are already available. Search 9999900001 to see them.');
   setRevision(value=>value+1);
  } catch(error){setError(error.message);}
  finally{setCreating(false);}
 }
 return <section className="staff-panel pos-history"><h2>Store sales dashboard</h2>
  <label>Period<select value={period} onChange={event=>{setReport(null);setError('');setPeriod(event.target.value);}}>{Object.entries(periods).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  {period==='previous'&&<label>Calendar year<select value={year} onChange={event=>{setReport(null);setError('');setYear(event.target.value);}}>{years.map(value=><option key={value}>{value}</option>)}</select></label>}
  <p>India time · Weeks start on Monday.</p>
  {canCreateExamples&&<button disabled={creating} onClick={createExamples}>{creating?'Saving…':'Add sample bills'}</button>}
  <ActionFeedback error={error} success={notice}/>
  {report&&<><div className="metric-row">{[['Bills',report.sales.length],['Customers',report.customers],['Gross sales',cash(report.gross)],['Mock refunds',cash(report.refunded)],['Net sales',cash(report.net)]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><PosSaleList sales={report.sales} onReceipt={onReceipt}/></>}
 </section>;
}

export default function PosPage(){
 return <StaffPortal portal="pos"><Pos/></StaffPortal>;
}

function Pos(){
 const {token,profile,logout}=useStaff();
 const can=permission=>profile.permissions.includes(permission);
 const [inventory,setInventory]=useState(null);
 const [scan,setScan]=useState(''),[cart,setCart]=useState([]),[name,setName]=useState(''),[phone,setPhone]=useState('');
 const [method,setMethod]=useState('UPI'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState(null),[search,setSearch]=useState(''),[tab,setTab]=useState('billing');
 const allowedTabs=[
  ['billing','Billing','pos.read'],['dashboard','Dashboard','pos.report'],['customers','Customer search & exchanges','pos.history']
 ].filter(([, , permission])=>can(permission));
 const currentTab=allowedTabs.some(([key])=>key===tab)?tab:allowedTabs[0]?.[0];
 const [billSuccess,setBillSuccess]=useState('');
 const [billingAction,setBillingAction]=useState('scan');
 const [scanStatus,setScanStatus]=useState('');
 const [stockRefreshError,setStockRefreshError]=useState('');
 const scanner=useRef(null),attempt=useRef(null),saving=useRef(false),inventoryRequest=useRef(0);
 useEffect(()=>{
  if(!can('pos.read'))return;
  const controller=new AbortController();
  let pending=false;
  const update=async()=>{
   if(document.hidden||pending||saving.current)return;
   pending=true;
   try{
    await refresh(token,controller.signal);
   } finally{pending=false;}
  };
  const onStorage=event=>{if(['trd_categories_updated','trd_pos_prices_updated','trd_stock_updated'].includes(event.key))update();};
  update();
  const timer=setInterval(update,refreshInterval);
  window.addEventListener('focus',update);
  window.addEventListener('storage',onStorage);
  document.addEventListener('visibilitychange',update);
  return ()=>{
   clearInterval(timer);
   controller.abort();
   window.removeEventListener('focus',update);
   window.removeEventListener('storage',onStorage);
   document.removeEventListener('visibilitychange',update);
  };
 },[token,profile.permissions.includes('pos.read')]);
 const all=useMemo(()=>inventory?.products.flatMap(product=>product.variants.map(variant=>({...variant,product})))||[],[inventory]);
 const refresh=async(t=token,signal)=>{
  const request=++inventoryRequest.current;
  try{
   const data=await api('/api/pos/inventory',{token:t,signal});
   if(request===inventoryRequest.current&&!signal?.aborted){
    setInventory(data);
    setStockRefreshError('');
   }
  } catch(error){
   if(request===inventoryRequest.current&&!signal?.aborted)setStockRefreshError(error.message);
  }
 };
 function add(variant){
  if(busy||!can('pos.bill'))return;
  setBillingAction('scan');setBillSuccess('');
  const existing=cart.find(line=>line.sku===variant.sku);
  const qty=existing?.qty||0;
  const label=`${variant.product.name} · ${variant.color} / ${variant.size}`;
  if(!variant.available){
   setScanStatus('');
   setError(`${label}: 0 pcs available in central warehouse stock. Check inventory before billing.`);
   return;
  }
  if(qty>=25||qty>=variant.available){
   setScanStatus('');
   setError(qty>=25
    ? `${label}: limit of 25 pcs per variant on one bill reached.`
    : `${label}: all ${variant.available} available pcs are already on this bill.`);
   return;
  }
  setCart(lines=>existing?lines.map(line=>line.sku===variant.sku?{...line,qty:line.qty+1}:line):[...lines,{sku:variant.sku,qty:1,variant}]);
  setScanStatus(`Added ${variant.product.name}, ${variant.color}, ${variant.size} at ${cash(variant.salePrice)}.`);setError('');
 }
 function scanBarcode(event){
  event.preventDefault();setBillingAction('scan');const code=scan.trim();
  const match=all.find(variant=>variant.barcode===code)||all.find(variant=>variant.sku.toUpperCase()===code.toUpperCase());
  if(match){add(match);setScan('');}
  else{
   setScanStatus('');
   setError(inventory?'Barcode or SKU not found in the store catalog. Check the code and refresh stock & prices.':'Store stock is still loading. Wait for products to load, then scan again.');
  }
  scanner.current?.focus();
 }
 function changeQty(sku,delta){
  const line=cart.find(item=>item.sku===sku),variant=all.find(item=>item.sku===sku);
  if(delta>0){if(variant)add(variant);return;}
  setCart(lines=>line.qty===1?lines.filter(item=>item.sku!==sku):lines.map(item=>item.sku===sku?{...item,qty:item.qty-1}:item));
 }
 const lines=cart.map(line=>({...line,variant:all.find(variant=>variant.sku===line.sku)||line.variant}));
 const cents=value=>Math.round(value*100);
 const subtotal=lines.reduce((sum,line)=>sum+cents(line.variant.regularPrice)*line.qty,0);
 const total=lines.reduce((sum,line)=>sum+cents(line.variant.salePrice)*line.qty,0);
 const gst=lines.reduce((sum,line)=>sum+Math.round(cents(line.variant.salePrice)*line.qty*5/105),0);
 async function complete(event){
  event.preventDefault();if(saving.current||!cart.length||!can('pos.bill'))return;
  const body=JSON.stringify({items:cart.map(({sku,qty})=>({sku,qty})),customer:{name,phone},paymentMethod:method,expectedTotal:total/100});
  if(attempt.current?.body!==body)attempt.current={body,key:uniqueKey()};
  saving.current=true;setBillingAction('save');setBillSuccess('');setBusy(true);setError('');
  try{
   const result=await api('/api/pos/sales',{method:'POST',token,headers:{'x-idempotency-key':attempt.current.key},body});
   setBillSuccess(`Bill ${result.sale.id} saved.`);setReceipt(result.sale);window.scrollTo(0,0);setCart([]);setName('');setPhone('');setScanStatus('');attempt.current=null;await refresh();
  }catch(error){setError(error.message);if(error.status===409)await refresh();}
  finally{saving.current=false;setBusy(false);}
 }
 function openReceipt(sale){setReceipt(sale);window.scrollTo(0,0);}
 return <main className="staff-shell pos-workspace">
  {receipt&&<PosReceipt sale={receipt} canPrint={can('pos.receipt')} onClose={()=>{setReceipt(null);scanner.current?.focus();}}/>}
  <div className="pos-print-hide">
   <div className="staff-page-header"><div><div className="eyebrow">{inventory?.locationName||'STORE'}</div><h1>Point of <em>sale.</em></h1><p>Development register · payments are simulated. Change-of-mind purchases are exchange only.</p></div><button disabled={busy} className="small-outline" onClick={logout}>Sign out</button></div>
   <nav aria-label="Store POS" className="cms-tabs">{allowedTabs.map(([key,label])=><button disabled={busy} key={key} aria-pressed={currentTab===key} onClick={()=>{setError('');setTab(key);}}>{label}</button>)}</nav>

   {currentTab==='dashboard'&&<Dashboard token={token} onReceipt={openReceipt} canCreateExamples={can('pos.examples')}/>}
   {currentTab==='customers'&&<PosHistory token={token} onReceipt={openReceipt} onInventoryChanged={can('pos.return')?()=>{setReceipt(null);if(can('pos.read'))refresh();}:undefined}/>}
   {currentTab==='billing'&&<>
    <section className="staff-panel pos-scan-panel"><form className="scanner-row" onSubmit={scanBarcode}>
     <label>Scan garment barcode<input ref={scanner} autoFocus autoComplete="off" value={scan} disabled={busy} onChange={event=>setScan(event.target.value)} placeholder="e.g. 0012345678905"/></label><div className="scanner-submit"><button disabled={!scan.trim()||busy||!can('pos.bill')}>Add to bill</button>
     <ActionFeedback error={billingAction==='scan'?error:''} success={scanStatus}/></div>
    </form><ActionFeedback error={stockRefreshError&&'Stock refresh failed. '+stockRefreshError}/><p className="hint">Stock and prices refresh automatically.</p></section>
    <div className="pos-layout"><aside className="staff-panel pos-register">
     <div className="panel-heading"><h2>Current bill</h2><span>{cart.reduce((sum,item)=>sum+item.qty,0)} items</span></div>
     <div className="pos-bill-lines">{lines.map(({sku,qty,variant})=><div className="pos-bill-row" key={sku}><div className="pos-bill-item"><StorePhoto className="pos-bill-photo" product={variant.product} color={variant.color}/><div><strong>{variant.product.name}</strong><small>{variant.color} / {variant.size} · {sku}</small><div className="qty-control"><button aria-label={`Remove one ${sku}`} disabled={busy} onClick={()=>changeQty(sku,-1)}>−</button><span>{qty}</span><button aria-label={`Add one ${sku}`} disabled={busy} onClick={()=>changeQty(sku,1)}>+</button></div></div></div><b>{cash(qty*variant.salePrice)}</b></div>)}</div>
     <form className="pos-register-bottom" onSubmit={complete}>
      <label>Customer name<input required maxLength={100} disabled={busy} value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. Asha Sharma"/></label>
      <label>Customer mobile<input required type="tel" disabled={busy} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="e.g. 9876543210"/></label>
      <label>Payment method<select disabled={busy} value={method} onChange={event=>setMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Card</option></select></label>
      <div className="summary-row"><span>Subtotal</span><strong>{cash(subtotal/100)}</strong></div>
      <div className="summary-row"><span>Store discount</span><strong>{cash((subtotal-total)/100)}</strong></div>
      <div className="summary-row"><span>Included GST (5%)</span><strong>{cash(gst/100)}</strong></div>
      <div className="pos-grand"><span>Total</span><strong>{cash(total/100)}</strong></div>
      <button className="button button-dark full" disabled={busy||!cart.length||!can('pos.bill')}>{busy?'Saving…':'Save bill'}</button>
      {billingAction==='save'&&<ActionFeedback error={error} success={billSuccess} pending={busy?'Saving bill…':''}/>}
     </form>
    </aside>
    <section className="staff-panel pos-products"><div className="panel-heading"><h2>Find a product</h2><button disabled={busy} onClick={()=>refresh()}>Refresh stock & prices</button></div>
     <div className="pos-search"><input aria-label="Search products" placeholder="e.g. Oxford, M or Sky Blue" value={search} onChange={event=>setSearch(event.target.value)}/></div>
     <div className="pos-product-grid">{all.filter(variant=>`${variant.product.name} ${variant.size} ${variant.color} ${variant.sku}`.toLowerCase().includes(search.toLowerCase())).slice(0,48).map(variant=><button className="pos-product" key={variant.sku} onClick={()=>add(variant)} disabled={busy||!variant.available||!can('pos.bill')}><StorePhoto className="pos-product-photo" product={variant.product} color={variant.color}/><span className="pos-product-info"><strong>{variant.product.name}</strong><small>{variant.color} / {variant.size}</small><b>{variant.salePrice<variant.regularPrice&&<del>{cash(variant.regularPrice)} </del>}{cash(variant.salePrice)}</b><em>{variant.available} available</em></span></button>)}</div>
    </section></div>
   </>}
  </div>
 </main>;
}
