'use client';
import ActionFeedback from '../../components/ActionFeedback';
import {useCallback,useEffect,useRef,useState} from 'react';
import {api,cash} from '../../lib/api';
import {orderCases,orderRequestStatus} from '../../../../../shared/admin-orders.mjs';
import {cancellationMs,paymentLabels,orderEligibility,returnConditions,returnReasons} from '../../../../../shared/order-policy.mjs';
import {resolvePickLine,warehousePickCode} from '../../../../../shared/warehouse-pick.mjs';
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
 const selectedStatus=selectedRow?.status,trackingRevision=selectedRow?.trackingRevision,selectedVerifiedUnits=selectedRow?.verifiedUnits;
 useEffect(()=>{
  if(!token||!selected)return;
  const controller=new AbortController();
  api('/api/warehouse/orders/'+selected,{token,signal:controller.signal}).then(value=>{if(!controller.signal.aborted)D(value);}).catch(e=>{if(!controller.signal.aborted){if(e.status===401)expireSession();else E(e.message);}});
  return()=>controller.abort();
 },[selected,selectedStatus,trackingRevision,selectedVerifiedUnits,token,reload,expireSession]);
 const [feedbackAt,setFeedbackAt]=useState('');
 const dispatchAfter=order?Date.parse(order.placedAt)+cancellationMs:0;
 const [,refreshDispatchClock]=useState(0);
 useEffect(()=>{
  const remaining=dispatchAfter-Date.now();
  if(remaining<=0)return;
  const timer=setTimeout(()=>refreshDispatchClock(n=>n+1),remaining+25);
  return()=>clearTimeout(timer);
 },[dispatchAfter]);

 const feedback=key=>feedbackAt===key&&<ActionFeedback error={error} success={message} pending={busy?'Saving…':''}/>;
 const run=async(task,key='')=>{if(inFlight.current)return;inFlight.current=true;setFeedbackAt(key);B(true);E('');M('');try{await task();}catch(e){if(token&&e.status===401)expireSession();else{
  E(e.message);
  if(key==='scan')requestAnimationFrame(()=>{
   const input=e.code==='WRONG_PICK_CODE'?pickInput.current:garmentInput.current;
   input?.focus();
   input?.select();
  });
 }}finally{B(false);inFlight.current=false;}};
 const login=()=>run(async()=>{const r=await api('/api/auth/staff',{method:'POST',body:JSON.stringify({role:'warehouse',pin})});sessionStorage.setItem('trd_warehouse_token',r.token);T(r.token);P('');});
 const action=(name,body)=>api('/api/warehouse/orders/'+order.id+'/'+name,{token,method:'POST',body:JSON.stringify(body)});
 const scan=e=>{
  e.preventDefault();if(!order||!pickCode.trim()||!barcode.trim()||!pickable(order.status))return;
  run(async()=>{
   const result=await action('scan',{pickCode,barcode});
   D(previous=>({...previous,status:'picking',verified:result.allVerified}));
   PC('');BC('');
   M(`${result.sku}: ${result.scanned}/${result.required} matched. ${result.complete?'All ordered units verified.':'Scan the two matching labels for the next unit.'}`);
   R(n=>n+1);
   requestAnimationFrame(()=>pickInput.current?.focus());
  },'scan');
 };
 const dispatch=()=>run(async()=>{const done=await action('dispatch',{});D(previous=>({...previous,status:done.status,shipment:done.shipment}));M('Mock dispatch recorded. AWB: '+done.shipment.awb);R(n=>n+1);},'dispatch');
 const deliver=()=>run(async()=>{const done=await action('delivered',{});D(previous=>({...previous,status:done.status,deliveredAt:done.deliveredAt,payment:done.payment}));M('Mock delivery recorded.');R(n=>n+1);},'deliver');
 if(!token)return <main className="container staff-login-page operations-login operations-warehouse"><div className="staff-login-card"><span className="panel-icon">▤</span><div className="eyebrow">TRENDISE / WAREHOUSE</div><h1>Warehouse <em>login.</em></h1><p>Match the pick-list code with the same order-line code on the physical label before mock dispatch.</p><label>Demo warehouse PIN<input value={pin} type="password" placeholder="Enter 1234" onChange={e=>P(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}/></label><button className="button button-dark full" onClick={login} disabled={busy}>Sign in ↗</button>{error&&<p className="error-box" role="alert">{error}</p>}</div></main>;
 const expectedLine=order?resolvePickLine(order,pickCode):null;
 const active=order&&pickable(order.status);
 const orderedUnits=order?.items.reduce((sum,item)=>sum+item.qty,0)??0;
 const verifiedUnits=order?.items.reduce((sum,item)=>sum+Math.min(item.qty,order.verified?.[item.sku]||0),0)??0;
 const verified=orderedUnits>0&&verifiedUnits===orderedUnits;
 const held=Date.now()<dispatchAfter;
 const pendingLabel=held?'Dispatch pending · cancellation hold':'Ready to dispatch';
 return <main className="staff-shell operations-workspace operations-warehouse">
  <div className="staff-page-header"><div><div className="eyebrow">WAREHOUSE / DEVELOPMENT</div><h1>Warehouse <em>operations.</em></h1><p>Pick and dispatch orders, receive returns and check shared stock.</p></div><div className="button-row"><button className="small-outline" disabled={busy} onClick={()=>R(n=>n+1)}>Refresh</button><button className="small-outline" disabled={busy} onClick={()=>{sessionStorage.removeItem('trd_warehouse_token');T('');openSection('orders');O(null);S('');D(null);PC('');BC('');M('');E('');QE('');}}>Sign out</button></div></div>
  <StaffTabs label="Warehouse sections" tabs={warehouseTabs} active={view} onChange={openSection}/>
  {view==='inventory'?<WarehouseInventory token={token} onSessionExpired={expireSession}/>:<div className="warehouse-layout"><section className="staff-panel warehouse-list"><div className="panel-heading"><h2>{returnsView?'Return queue':'Order queue'}</h2><span>{queue?.length??'—'} orders</span></div>
   <p className="hint">New orders appear automatically. Most recent first.</p>
   {queueError&&<p className="error-box" role="alert">{queueError}</p>}
   {!orders&&!queueError?<p role="status">Loading orders…</p>:queue?.length===0?<p>{returnsView?'No returns yet.':'No orders yet.'}</p>:queue?.map(o=><button key={o.id} className={`warehouse-order ${selected===o.id?'active':''}`} aria-pressed={selected===o.id} disabled={busy} onClick={()=>{if(selected!==o.id)D(null);S(o.id);setFeedbackAt('');E('');M('');PC('');BC('');}}><span><strong>{o.id}</strong><small>{o.lineCount} lines / {o.units} units</small>{!returnsView&&pickable(o.status)&&<small>{o.verifiedUnits===o.units?(Date.now()<Date.parse(o.placedAt)+cancellationMs?'Dispatch pending':'Ready to dispatch'):`${o.verifiedUnits??0} / ${o.units} verified`}</small>}</span><span className="order-status">{o.status.toUpperCase()}</span></button>)}
  </section><section className="staff-panel warehouse-detail">
   {!feedbackAt&&<ActionFeedback error={error}/>}
   {!order||(returnsView&&!queue?.some(row=>row.id===order.id))?<div className="pos-empty"><h3>{returnsView?'Select a return':selected&&!error?'Loading order…':'Select an order'}</h3><p>{returnsView?'Open a return to review approval and record receipt.':'Open the pick list to see product images, quantities and barcodes.'}</p></div>:<>
    <div className="panel-heading"><div><h2>{order.id}</h2><p className="hint">Placed {formatTime(order.placedAt)}</p>{order.deliveredAt&&<p className="hint">Delivered {formatTime(order.deliveredAt)} · Customer return deadline {formatTime(orderEligibility(order).returnUntil)}</p>}</div><span className="order-status">{order.status.toUpperCase()}</span></div>
    {!returnsView&&(active||['shipped','delivered','cancelled'].includes(order.status))&&<section className="warehouse-progress" aria-label="Picking and dispatch status">
     <h3>{active?(verified?pendingLabel:'Picking in progress'):order.status==='shipped'?'Dispatched':order.status==='delivered'?'Delivered':'Cancelled'}</h3>
     {active&&<>
      <p><strong>{verifiedUnits} of {orderedUnits} pieces verified</strong></p>
      <p>{verified?(held?`All scans complete. Dispatch opens ${formatTime(dispatchAfter)} when the cancellation window closes.`:'All scans complete. This order can be dispatched now.'):'Verify each remaining piece to complete picking.'}</p>
      <button className="button button-dark" disabled={busy||held||!verified} onClick={dispatch}>Complete mock dispatch ↗</button>
     </>}
     {feedback('dispatch')}
     {order.status==='shipped'&&<button className="button button-line" disabled={busy} onClick={deliver}>Mark mock delivered</button>}{feedback('deliver')}
    </section>}
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
      },key+'-inspect');
     }}>
      <h3>Inspect received return</h3>
      <ul>{returnConditions.map(condition=><li key={condition}>{condition}</li>)}</ul>
      <label>Inspection result<select name="decision" required defaultValue=""><option value="" disabled>Choose a result</option><option value="pass">Pass · restock and record eligible mock refund</option><option value="fail">Fail · quarantine outside sellable stock</option></select></label>
      <label>Reason shown to customer<textarea name="reason" placeholder="e.g. Tags intact and no visible wear." required minLength={5} maxLength={500}/></label>
      <button className="button button-dark" disabled={busy}>Record final inspection</button>
     </form>}{feedback(key+'-inspect')}
     {kind==='return'&&request.status==='approved'&&!request.receivedAt&&<form className="stack" onSubmit={e=>{
      e.preventDefault();
      const form=new FormData(e.currentTarget);
      run(async()=>{D(await action('return-receipt',{sku:request.sku,barcode:form.get('returnBarcode'),quantity:form.get('returnQuantity')}));M('Mock return received for inspection.');},key+'-receive');
     }}>
      <label>Returned garment barcode<input name="returnBarcode" placeholder="Scan the barcode printed on the returned tag" required autoComplete="off"/></label>
      <label>Units received (expected {order.items.find(item=>item.sku===request.sku)?.qty})<input name="returnQuantity" placeholder="e.g. 1" type="number" min="1" required/></label>
      <button className="button button-dark" disabled={busy}>Record mock return receipt</button>
     </form>}{feedback(key+'-receive')}
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
       <dl><div><dt>Colour</dt><dd>{item.color}</dd></div><div><dt>Size</dt><dd>{item.size}</dd></div><div><dt>Quantity</dt><dd>{item.qty}</dd></div><div><dt>SKU</dt><dd>{item.sku}</dd></div><div><dt>Inventory barcode (SKU tag)</dt><dd>{item.barcode}</dd></div><div><dt>Line total</dt><dd>{cash(item.lineTotal)}</dd></div></dl>
       <p className="hint">Pick from: {order.allocations.filter(a=>a.sku===item.sku).map(a=>a.locationName+' × '+a.qty).join(' · ')||'Not recorded'}</p>
       <span className="verified-count">{order.verified[item.sku]||0} / {item.qty} matched</span>
       <div className="warehouse-pick-label"><strong>1 · Order-line barcode</strong><PickBarcode value={warehousePickCode(order.id,index)}/>{active&&(order.verified[item.sku]||0)<item.qty&&<button type="button" className="small-outline warehouse-use-pick-code" disabled={busy} onClick={()=>{
        PC(warehousePickCode(order.id,index));BC('');E('');M('');
        requestAnimationFrame(()=>garmentInput.current?.focus());
       }}>Use this order line</button>}<small>2 · Scan the same order-line code on the physical label.</small></div>
      </div>
     </article>)}
    </div>
    {!returnsView&&active&&!verified&&<form className="warehouse-scanner" onSubmit={scan}><h3>Dual barcode verification</h3><p>Scan the order-line code from the pick list in field 1. Scan the same code from the physical label in field 2.</p>
     <label>1 / Order-line barcode<input ref={pickInput} value={pickCode} onChange={e=>{PC(e.target.value);BC('');E('');}} autoComplete="off" placeholder={warehousePickCode(order.id,0)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(pickCode.trim())garmentInput.current?.focus();}}}/></label>
     {expectedLine&&<div className="notice-box" id="warehouse-expected-tag">
      <strong>Selected: {expectedLine.name} · {expectedLine.color} / {expectedLine.size}</strong>
      <p>Expected physical label <code>{pickCode.trim()}</code> · SKU {expectedLine.sku} · {order.verified[expectedLine.sku]||0} of {expectedLine.qty} verified</p>
     </div>}
     <label>2 / Physical order-line barcode<input ref={garmentInput} aria-describedby={expectedLine?'warehouse-expected-tag':undefined} value={barcode} onChange={e=>{BC(e.target.value);E('');}} autoComplete="off" placeholder="Scan the matching order-line label" disabled={!pickCode.trim()}/></label>
     <button className="button button-dark" disabled={busy||!pickCode.trim()||!barcode.trim()||!!(expectedLine&&(order.verified[expectedLine.sku]||0)>=expectedLine.qty)}>Verify barcode match ↗</button>
     {feedback('scan')}
     {feedbackAt==='scan'&&error&&expectedLine&&barcode.trim()&&<p className="hint">Scanner read: <code>{barcode.trim()}</code></p>}
    </form>}
    <ShipmentTracking shipment={order.shiprocketOrder} staff/>
    {order.shipment&&<p className="shipment-label">Mock AWB: {order.shipment.awb}</p>}

   </>}
  </section></div>}
 </main>;
}
