'use client';
import ActionFeedback from './ActionFeedback';
import {useEffect,useState} from 'react';
import {api,cash} from '../lib/api';
import {orderCases,orderListLabels,orderStatusLabels,orderRequestStatus} from '../../../../shared/admin-orders.mjs';
import {paymentLabels,returnReasons,orderEligibility} from '../../../../shared/order-policy.mjs';
import ReturnOutcome from './ReturnOutcome';
import ShipmentTracking from './ShipmentTracking';
import OrderCharges from './OrderCharges';

const date=value=>value?new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST':'—';
export default function AdminOrders({token,filter,onFilter,onReviewed}){
 const categories=['all','returns','cancelled','shipped','picking'];
 const [search,S]=useState(''),[query,Q]=useState(''),[page,P]=useState(1),[list,L]=useState(null),[selected,SEL]=useState(''),[detail,D]=useState(null),[reload,R]=useState(0),[listError,LE]=useState(''),[detailError,DE]=useState(''),[notice,N]=useState(''),[review,V]=useState(null),[busy,B]=useState(false);
 useEffect(()=>{
  const control=new AbortController();L(null);LE('');
  api('/api/admin/orders?'+new URLSearchParams({q:query,status:filter,page:String(page)}),{token,signal:control.signal}).then(data=>{if(!control.signal.aborted)L(data);}).catch(e=>{if(!control.signal.aborted)LE(e.message);});
  return()=>control.abort();
 },[token,query,filter,page,reload]);
 useEffect(()=>{
  if(!selected)return;
  const control=new AbortController();D(null);DE('');
  api('/api/admin/orders/'+selected,{token,signal:control.signal}).then(data=>{if(!control.signal.aborted)D(data);}).catch(e=>{if(!control.signal.aborted)DE(e.message);});
  return()=>control.abort();
 },[token,selected,reload]);
 useEffect(()=>{
  if(!selected||!detail?.shiprocketOrder)return;
  const controller=new AbortController();
  const timer=setInterval(()=>{
   if(!document.hidden)api('/api/admin/orders/'+selected,{token,signal:controller.signal}).then(D).catch(()=>{});
  },15000);
  return()=>{controller.abort();clearInterval(timer);};
 },[selected,token,detail?.shiprocketOrder?.orderId]);
 const [decisionKey,setDecisionKey]=useState('');
 const submit=async e=>{
  e.preventDefault();if(busy||!detail||!review)return;setDecisionKey(review.caseKey);B(true);DE('');N('');
  try{
   const updated=await api('/api/admin/orders/'+detail.id+'/review',{token,method:'POST',body:JSON.stringify(review)});
   D(updated);V(null);N('Decision saved. The customer can see it in My Orders.');R(n=>n+1);onReviewed();
  }catch(e){DE(e.message);}finally{B(false);}
 };
 return <section className="staff-panel admin-orders" id="admin-orders">
  <div className="panel-heading"><div><h2>Orders & returns</h2><p>Find orders, check payments and review customer requests.</p></div><button className="small-outline" disabled={busy} onClick={()=>R(n=>n+1)}>Refresh orders</button></div>
  <nav className="operations-tabs admin-order-categories" aria-label="Order lists">
   {categories.map(key=><button className="admin-order-category" key={key} type="button" aria-pressed={filter===key} disabled={busy} onClick={()=>onFilter(key)}>{orderListLabels[key]}</button>)}
  </nav>
  <div className="admin-orders-grid"><div>
   <form className="admin-order-filters" onSubmit={e=>{e.preventDefault();Q(search.trim());P(1);}}>
    <label>Search orders<input type="search" value={search} maxLength={100} onChange={e=>S(e.target.value)} placeholder="e.g. TRD-10002 or Asha Sharma"/></label>
    <button className="button button-dark" type="submit">Search</button>
    <label>Order list<select value={filter} disabled={busy} onChange={e=>onFilter(e.target.value)}>{Object.entries(orderListLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   </form>
   {listError?<p className="error-box" role="alert">{listError}</p>:!list?<p role="status">Loading orders…</p>:!list.orders.length?<p>{filter==='returns'?'No returns match this search.':'No orders match these filters.'}</p>:<>
    <p className="hint">{list.total} {list.total===1?'order':'orders'}</p>
    {list.orders.map(row=><button type="button" className={`warehouse-order ${selected===row.id?'active':''}`} aria-pressed={selected===row.id} key={row.id} disabled={busy} onClick={()=>{SEL(row.id);V(null);N('');}}><span><strong>{row.id}</strong><small>{date(row.placedAt)} · {row.itemCount} items</small><small>{paymentLabels[row.paymentMethod]} · {cash(row.total)}</small></span><span><span className="order-status">{orderStatusLabels[row.status]||row.status}</span>{filter==='returns'&&[...new Set(row.returns.map(orderRequestStatus))].map(status=><small key={status}>{status}</small>)}{row.pending>0&&<small>{row.pending} to review</small>}</span></button>)}
    {list.pageCount>1&&<div className="button-row"><button className="small-outline" disabled={list.page<=1} onClick={()=>P(list.page-1)}>Previous</button><span>Page {list.page} of {list.pageCount}</span><button className="small-outline" disabled={list.page>=list.pageCount} onClick={()=>P(list.page+1)}>Next</button></div>}
   </>}
  </div><div className="admin-order-detail">
   {!review&&<ActionFeedback error={detailError}/>}
   {!selected?<p>Select an order to view its details.</p>:!detail?!detailError&&<p role="status">Loading order…</p>:<>
    <h3>{detail.id} · {orderStatusLabels[detail.status]||detail.status}</h3>
    <p><strong>{detail.address.name}</strong> · {detail.address.phone}</p>
    <p>{[detail.address.line1,detail.address.line2,detail.address.city,detail.address.district,detail.address.state,detail.address.pincode].filter(Boolean).join(', ')}</p>
    <p>{paymentLabels[detail.payment.method||'card']} · {detail.payment.status.replaceAll('_',' ')} · <strong>{cash(detail.quote.total)}</strong></p>
    {detail.payment.split&&<p>{cash(detail.payment.split.upfront)} upfront · {cash(detail.payment.split.remaining)} delivery balance</p>}
    {detail.payment.mockRefundAmount!==undefined&&<p>Simulated upfront refund: {cash(detail.payment.mockRefundAmount)}</p>}
    <ShipmentTracking shipment={detail.shiprocketOrder} staff/>
    <OrderCharges quote={detail.quote}/>
    <p className="hint">Placed {date(detail.placedAt)}{detail.deliveredAt&&` · Delivered ${date(detail.deliveredAt)}`}</p>
    <p className="hint">Terms: {detail.acceptedPolicyVersion||'Not recorded'}{detail.acceptedAt&&` · Accepted ${date(detail.acceptedAt)}`}</p>
    <h4>Items</h4><ul>{detail.items.map(item=><li key={item.sku}>{item.name} · {item.color} / {item.size} × {item.qty} <small>({item.sku})</small></li>)}</ul>
    {detail.deliveredAt&&<p className="notice-box">Customer 3-day return deadline: {date(orderEligibility(detail).returnUntil)}</p>}<h4>Customer requests</h4>
    {!orderCases(detail).length&&<p>No return requests or delivery issues.</p>}
    {orderCases(detail).map(({kind,key,request})=><article className="admin-order-case" key={key}>
     <strong>{kind==='return'?'Return request':'Delivery issue'} · {request.sku}</strong>
     <p>{returnReasons[request.reason]||request.reason} · {orderRequestStatus(request)}</p>
     <ReturnOutcome inspection={request.inspection} staff/>
     {request.note&&<p>{request.note}</p>}
     {request.review&&<p><strong>Decision:</strong> {request.review.note} <small>({date(request.review.decidedAt)})</small></p>}
     {request.status==='requested'&&review?.caseKey!==key&&<button className="small-outline" disabled={busy} onClick={()=>{V({caseKey:key,decision:'approved',note:''});DE('');N('');}}>Review request</button>}
     {review?.caseKey===key&&<form className="admin-order-review" onSubmit={submit}>
      <label>Decision<select value={review.decision} onChange={e=>V({...review,decision:e.target.value})}><option value="approved">Approve for follow-up</option><option value="rejected">Decline</option></select></label>
      <label>Reason shown to customer<textarea required minLength={5} placeholder="e.g. Approved for inspection because the item arrived damaged." maxLength={500} value={review.note} onChange={e=>V({...review,note:e.target.value})}/></label>
      <p className="hint">A decision does not book a pickup, issue a refund, or restore stock.</p>
      <div className="button-row"><button className="button button-dark" disabled={busy||review.note.trim().length<5}>{busy?'Saving…':'Save decision'}</button><button className="small-outline" type="button" disabled={busy} onClick={()=>V(null)}>Back</button></div>
      <ActionFeedback error={detailError} pending={busy?'Saving decision…':''}/>
     </form>}{decisionKey===key&&!review&&<ActionFeedback success={notice}/>}
    </article>)}
   </>}
  </div></div>
 </section>;
}
