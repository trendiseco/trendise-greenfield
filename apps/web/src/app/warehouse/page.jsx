'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {api,cash} from '../../lib/api';
import {orderCases,orderRequestStatus} from '../../../../../shared/admin-orders.mjs';
import {cancellationMs,paymentLabels,orderEligibility,returnConditions,returnReasons} from '../../../../../shared/order-policy.mjs';
import {warehousePickCode} from '../../../../../shared/warehouse-pick.mjs';
import PickBarcode from '../../components/PickBarcode';
import StorePhoto from '../../components/StorePhoto';
import WarehouseInventory from '../../components/WarehouseInventory';
import ReturnOutcome from '../../components/ReturnOutcome';
import ShipmentTracking from '../../components/ShipmentTracking';
import OrderCharges from '../../components/OrderCharges';
import {StaffTabs,useStaffSection} from '../../components/StaffWorkspace';

const formatTime=value=>new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST';
const pickable=status=>['paid','confirmed','picking'].includes(status);

const warehouseTabs=[['orders','Orders & picking'],['returns','Returns'],['inventory','Products & inventory']];

export default function Warehouse(){
 const [token,T]=useState(''),[pin,P]=useState(''),[orders,O]=useState(null),[selected,S]=useState(''),[order,D]=useState(null),[pickCode,PC]=useState(''),[barcode,BC]=useState(''),[message,M]=useState(''),[error,E]=useState(''),[queueError,QE]=useState(''),[busy,B]=useState(false),[reload,R]=useState(0);
 const [section,openSection]=useStaffSection('orders');
 const view=warehouseTabs.some(([id])=>id===section)?section:'orders';
 const returnsView=view==='returns';
 const queue=returnsView?orders?.filter(row=>row.hasReturns):orders;
 const pickInput=useRef(null),garmentInput=useRef(null),inFlight=useRef(false);
 const expireSession=useCallback(()=>{
  sessionStorage.removeItem('trd_warehouse_token');
  T('');O(null);S('');D(null);QE('');M('');PC('');BC('');
  E('Your warehouse session expired. Sign in again.');
 },[]);
 useEffect(()=>{T(sessionStorage.getItem('trd_warehouse_token')||'');},[]);
 useEffect(()=>{
  if(!token)return;
  const controller=new AbortController();
  let fetching=false;
  const refresh=async()=>{
   if(fetching)return;fetching=true;
   try{const r=await api('/api/warehouse/orders',{token,signal:controller.signal});if(!controller.signal.aborted){O(r.orders);QE('');}}
   catch(e){if(!controller.signal.aborted){if(e.status===401)expireSession();else QE(e.message);}}
   finally{fetching=false;}
  };
  refresh();const timer=setInterval(()=>{if(!document.hidden)refresh();},5000);
  const onVisible=()=>{if(!document.hidden)refresh();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
 },[token,reload,expireSession]);
 const selectedRow=orders?.find(row=>row.id===selected);
 const selectedStatus=selectedRow?.status,trackingRevision=selectedRow?.trackingRevision;
 useEffect(()=>{
  if(!token||!selected)return;
  const controller=new AbortController();
  api('/api/warehouse/orders/'+selected,{token,signal:controller.signal}).then(value=>{if(!controller.signal.aborted)D(value);}).catch(e=>{if(!controller.signal.aborted){if(e.status===401)expireSession();else E(e.message);}});
  return()=>controller.abort();
 },[selected,selectedStatus,trackingRevision,token,reload,expireSession]);
 const run=async task=>{if(inFlight.current)return;inFlight.current=true;B(true);E('');M('');try{await task();}catch(e){if(token&&e.status===401)expireSession();else E(e.message);}finally{B(false);inFlight.current=false;}};
 const login=()=>run(async()=>{const r=await api('/api/auth/staff',{method:'POST',body:JSON.stringify({role:'warehouse',pin})});sessionStorage.setItem('trd_warehouse_token',r.token);T(r.token);P('');});
 const action=(name,body)=>api('/api/warehouse/orders/'+order.id+'/'+name,{token,method:'POST',body:JSON.stringify(body)});
 const scan=e=>{
  e.preventDefault();if(!order||!pickCode.trim()||!barcode.trim()||!pickable(order.status))return;
  run(async()=>{
   const result=await action('scan',{pickCode,barcode});
   D(previous=>({...previous,status:'picking',verified:result.allVerified}));
   PC('');BC('');
   M(`${result.sku}: ${result.scanned}/${result.required} matched. ${result.complete?'All ordered units verified.':'Scan both barcodes for the next unit.'}`);
   R(n=>n+1);
   requestAnimationFrame(()=>pickInput.current?.focus());
  });
 };
 const dispatch=()=>run(async()=>{const done=await action('dispatch',{});D(previous=>({...previous,status:done.status,shipment:done.shipment}));M('Mock dispatch recorded. AWB: '+done.shipment.awb);R(n=>n+1);});
 const deliver=()=>run(async()=>{const done=await action('delivered',{});D(previous=>({...previous,status:done.status,deliveredAt:done.deliveredAt,payment:done.payment}));M('Mock delivery recorded.');R(n=>n+1);});
 if(!token)return <main className="container staff-login-page operations-login operations-warehouse"><div className="staff-login-card"><span className="panel-icon">▤</span><div className="eyebrow">TRENDISE / WAREHOUSE</div><h1>Warehouse <em>login.</em></h1><p>Verify ordered SKUs against physical garment barcodes before mock dispatch.</p><label>Demo warehouse PIN<input value={pin} type="password" placeholder="Enter 1234" onChange={e=>P(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}/></label><button className="button button-dark full" onClick={login} disabled={busy}>Sign in ↗</button>{error&&<p className="error-box" role="alert">{error}</p>}</div></main>;
 const active=order&&pickable(order.status),verified=order?.items.every(i=>(order.verified[i.sku]||0)===i.qty),dispatchAfter=order?Date.parse(order.placedAt)+cancellationMs:0,held=Date.now()<dispatchAfter;
 return <main className="staff-shell operations-workspace operations-warehouse">
  <div className="staff-page-header"><div><div className="eyebrow">WAREHOUSE / DEVELOPMENT</div><h1>Warehouse <em>operations.</em></h1><p>Pick and dispatch orders, receive returns and check shared stock.</p></div><div className="button-row"><button className="small-outline" disabled={busy} onClick={()=>R(n=>n+1)}>Refresh</button><button className="small-outline" disabled={busy} onClick={()=>{sessionStorage.removeItem('trd_warehouse_token');T('');setView('orders');O(null);S('');D(null);PC('');BC('');M('');E('');QE('');}}>Sign out</button></div></div>
  <StaffTabs label="Warehouse sections" tabs={warehouseTabs} active={view} onChange={openSection}/>
  {view==='inventory'?<WarehouseInventory token={token} onSessionExpired={expireSession}/>:<div className="warehouse-layout"><section className="staff-panel warehouse-list"><div className="panel-heading"><h2>{returnsView?'Return queue':'Order queue'}</h2><span>{queue?.length??'—'} orders</span></div>
   <p className="hint">New orders appear automatically. Most recent first.</p>
   {queueError&&<p className="error-box" role="alert">{queueError}</p>}
   {!orders&&!queueError?<p role="status">Loading orders…</p>:queue?.length===0?<p>{returnsView?'No returns yet.':'No orders yet.'}</p>:queue?.map(o=><button key={o.id} className={`warehouse-order ${selected===o.id?'active':''}`} aria-pressed={selected===o.id} disabled={busy} onClick={()=>{if(selected!==o.id)D(null);S(o.id);E('');M('');PC('');BC('');}}><span><strong>{o.id}</strong><small>{o.lineCount} lines / {o.units} units</small></span><span className="order-status">{o.status.toUpperCase()}</span></button>)}
  </section><section className="staff-panel warehouse-detail">
   {error&&<p className="error-box" role="alert">{error}</p>}{message&&<p className="success-box" role="status">{message}</p>}
   {!order||(returnsView&&!queue?.some(row=>row.id===order.id))?<div className="pos-empty"><h3>{returnsView?'Select a return':selected&&!error?'Loading order…':'Select an order'}</h3><p>{returnsView?'Open a return to review approval and record receipt.':'Open the pick list to see product images, quantities and barcodes.'}</p></div>:<>
    <div className="panel-heading"><div><h2>{order.id}</h2><p className="hint">Placed {formatTime(order.placedAt)}</p>{order.deliveredAt&&<p className="hint">Delivered {formatTime(order.deliveredAt)} · Customer return deadline {formatTime(orderEligibility(order).returnUntil)}</p>}</div><span className="order-status">{order.status.toUpperCase()}</span></div>
    {returnsView&&<div className="operations-return-cases">
    {orderCases(order).filter(({kind})=>kind==='return').map(({kind,key,request})=><div key={key} className="notice-box">
     <p>{kind==='return'?'Customer return':'Delivery issue'} · {request.sku} · {returnReasons[request.reason]} · {orderRequestStatus(request)}</p>
     {request.note&&<p>{request.note}</p>}
     {request.receivedAt&&<p>Received {formatTime(request.receivedAt)}{!request.inspection&&' · Awaiting inspection'}</p>}
     <ReturnOutcome inspection={request.inspection} staff/>
     {request.receivedAt&&!request.inspection&&<form className="stack" onSubmit={e=>{
      e.preventDefault();
      const form=new FormData(e.currentTarget);
      run(async()=>{
       D(await action('return-inspection',{sku:request.sku,decision:form.get('decision'),reason:form.get('reason')}));
       M('Return inspection and settlement recorded.');
      });
     }}>
      <h3>Inspect received return</h3>
      <ul>{returnConditions.map(condition=><li key={condition}>{condition}</li>)}</ul>
      <label>Inspection result<select name="decision" required defaultValue=""><option value="" disabled>Choose a result</option><option value="pass">Pass · restock and record eligible mock refund</option><option value="fail">Fail · quarantine outside sellable stock</option></select></label>
      <label>Reason shown to customer<textarea name="reason" required minLength={5} maxLength={500}/></label>
      <button className="button button-dark" disabled={busy}>Record final inspection</button>
     </form>}
     {kind==='return'&&request.status==='approved'&&!request.receivedAt&&<form className="stack" onSubmit={e=>{
      e.preventDefault();
      const form=new FormData(e.currentTarget);
      run(async()=>{D(await action('return-receipt',{sku:request.sku,barcode:form.get('returnBarcode'),quantity:form.get('returnQuantity')}));M('Mock return received for inspection.');});
     }}>
      <label>Returned garment barcode<input name="returnBarcode" required autoComplete="off"/></label>
      <label>Units received (expected {order.items.find(item=>item.sku===request.sku)?.qty})<input name="returnQuantity" type="number" min="1" required/></label>
      <button className="button button-dark" disabled={busy}>Record mock return receipt</button>
     </form>}
    </div>)}
    </div>}
    {!returnsView&&orderCases(order).length>0&&<div className="button-row">
     {orderCases(order).some(({kind})=>kind==='return')&&<button className="small-outline" onClick={()=>openSection('returns')}>Open returns ↗</button>}
     {order.issueReport&&<p className="hint">Delivery issue · {returnReasons[order.issueReport.reason]} · {orderRequestStatus(order.issueReport)}{order.issueReport.note?' · '+order.issueReport.note:''}</p>}
    </div>}
    <div className="pick-meta warehouse-order-meta">
     <span><strong>Recipient & contact</strong>{order.address.name} · {order.address.phone}</span>
     <span><strong>Delivery address</strong>{[order.address.line1,order.address.line2,order.address.city,order.address.district,order.address.state,order.address.pincode].filter(Boolean).join(', ')}</span>
     <span><strong>Payment & total</strong>{paymentLabels[order.payment.method||'card']} · {cash(order.quote.total)} · {order.payment.status.replaceAll('_',' ')}</span>
     {order.payment.split&&order.status!=='cancelled'&&<span><strong>Delivery balance</strong>{cash(order.payment.split.remaining)} {order.status==='delivered'?'collected in demo':'due on delivery'}</span>}
    </div>
    <div className="warehouse-order-charges"><OrderCharges quote={order.quote}/></div>
    <div className="pick-sheet" hidden={returnsView}><div className="pick-sheet-head"><h3>Order pick list</h3><button className="small-outline" onClick={()=>window.print()}>Print pick list ↗</button></div>
     {order.items.map((item,index)=><article className="pick-line warehouse-pick-line" key={item.sku}>
      <StorePhoto className="warehouse-product-photo" product={{...item,variants:[{color:item.color}]}} color={item.color} src={item.photo?.src} alt={item.photo?.alt}/>
      <div className="warehouse-pick-info"><h4>{item.name}</h4><p>{[item.category,item.fabric,item.fit].filter(Boolean).join(' · ')}</p>
       <dl><div><dt>Colour</dt><dd>{item.color}</dd></div><div><dt>Size</dt><dd>{item.size}</dd></div><div><dt>Quantity</dt><dd>{item.qty}</dd></div><div><dt>SKU</dt><dd>{item.sku}</dd></div><div><dt>Garment barcode</dt><dd>{item.barcode}</dd></div><div><dt>Line total</dt><dd>{cash(item.lineTotal)}</dd></div></dl>
       <p className="hint">Pick from: {order.allocations.filter(a=>a.sku===item.sku).map(a=>a.locationName+' × '+a.qty).join(' · ')||'Not recorded'}</p>
       <span className="verified-count">{order.verified[item.sku]||0} / {item.qty} matched</span>
       <div className="warehouse-pick-label"><strong>1 · Order-line barcode</strong><PickBarcode value={warehousePickCode(order.id,index)}/><small>2 · Scan the barcode attached to the physical garment.</small></div>
      </div>
     </article>)}
    </div>
    {active&&<form className="warehouse-scanner" onSubmit={scan}><h3>Dual barcode verification</h3><p>For each unit, scan the order-line barcode first, then the barcode on the garment. Both must match.</p>
     <label>1 / Order-line barcode<input ref={pickInput} value={pickCode} onChange={e=>PC(e.target.value)} autoComplete="off" placeholder={warehousePickCode(order.id,0)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(pickCode.trim())garmentInput.current?.focus();}}}/></label>
     <label>2 / Physical garment barcode<input ref={garmentInput} value={barcode} onChange={e=>BC(e.target.value)} autoComplete="off" placeholder="Scan the garment label" disabled={!pickCode.trim()}/></label>
     <button className="button button-dark" disabled={busy||!pickCode.trim()||!barcode.trim()}>Verify barcode match ↗</button>
    </form>}
    <div className="warehouse-actions">
     {active&&<><button className="button button-dark full" disabled={busy||held||!verified} onClick={dispatch}>Complete mock dispatch ↗</button><p className="hint">{held?`Dispatch opens ${formatTime(dispatchAfter)}, after the cancellation window.`:'All ordered units must pass both barcode checks before dispatch.'}</p></>}
     {order.status==='shipped'&&<button className="button button-line" disabled={busy} onClick={deliver}>Mark mock delivered</button>}
    </div>
    <ShipmentTracking shipment={order.shiprocketOrder} staff/>
    {order.shipment&&<p className="shipment-label">Mock AWB: {order.shipment.awb}</p>}

   </>}
  </section></div>}
 </main>;
}
