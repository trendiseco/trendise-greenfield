'use client';
import CancellationReturn from './CancellationReturn';
import ActionFeedback from './ActionFeedback';
import {useState} from 'react';
import ReturnOutcome from './ReturnOutcome';
import {orderRequestStatus} from '../../../../shared/admin-orders.mjs';
import StoreDialog from './StoreDialog';
import {api,cash} from '../lib/api';
import {returnConditions,returnReasons} from '../../../../shared/order-policy.mjs';
export default function OrderActions({order,refresh}){
 const [mode,M]=useState(''),[reason,R]=useState('fit'),[sku,S]=useState(order.items[0]?.sku||''),[note,N]=useState(''),[checked,C]=useState(false),[busy,B]=useState(false),[error,E]=useState(''),[success,SS]=useState('');
 const [replacementSku,setReplacementSku]=useState(''),[addOnSku,setAddOnSku]=useState('');
 const requests=order.returnRequests||[order.returnRequest].filter(Boolean);
 const exchangeItems=order.items.filter(item=>item.exchange?.options.length&&!requests.some(request=>request.sku===item.sku));
 const choices=exchangeItems.find(item=>item.sku===sku)?.exchange;
 const replacement=choices?.options.find(option=>option.sku===replacementSku);
 const addOn=choices?.addOns.find(option=>option.sku===addOnSku);
 const balance=choices?.sameProduct||!replacement?0:
  Math.round(replacement.unitPrice*100*replacement.qty+(addOn?.unitPrice??0)*100-choices.credit*100)/100;
 const open=value=>{E('');SS('');S((value==='return'?exchangeItems[0]:order.items[0])?.sku||'');R(value==='issue'?'damaged':'fit');C(false);N('');setReplacementSku('');setAddOnSku('');M(value);};
 const send=async()=>{B(true);E('');try{await api('/api/orders/'+order.id+'/'+(mode==='cancel'?'cancel':'return'),{method:'POST',token:sessionStorage.getItem('trd_customer_token'),body:JSON.stringify({reason,sku,replacementSku,addOnSku,expectedDifference:Math.max(0,balance),note,conditionConfirmed:checked})});SS(mode==='cancel'?'Order cancelled.':mode==='issue'?'Delivery issue reported.':'Exchange request submitted.');M('');refresh();}catch(e){E(e.message);}finally{B(false);}};
 const time=value=>new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST';
 const returnWindowOpen=!!order.returnUntil&&Date.now()<Date.parse(order.returnUntil);
 return <div className="order-actions">{order.deliveredAt&&!order.exchangeFor&&<section className="customer-return-window" aria-label="3-day exchange window"><strong>3-day exchange window</strong><p>Delivered {time(order.deliveredAt)}.</p><p>{returnWindowOpen?<>Request a change-of-mind exchange by <strong>{time(order.returnUntil)}</strong>.</>:<>The change-of-mind exchange window closed on <strong>{time(order.returnUntil)}</strong>.</>}</p><p className="hint">Keep original tags attached and the item unused, unwashed and unmarked. Report wrong, damaged or defective items separately.</p></section>}<div className="button-row">{order.canCancel&&<button className="button button-line" onClick={()=>open('cancel')}>Cancel order</button>}{order.canReturn&&returnWindowOpen&&exchangeItems.length>0&&<button className="button button-line" onClick={()=>open('return')}>Request exchange</button>}{order.canReportIssue&&<button className="button button-line" onClick={()=>open('issue')}>Report delivery issue</button>}</div>{order.canReturn&&returnWindowOpen&&!exchangeItems.length&&<p className="hint">No exchange replacement is currently available.</p>}
 {order.exchangeFor&&<p>Replacement for {order.exchangeFor.orderId} · {order.quote.total>0?(order.payment.status==='mock_collected'?`${cash(order.quote.total)} collected at mock delivery`:`${cash(order.quote.total)} due at mock delivery`):'No additional payment due.'}</p>}
 <ActionFeedback success={success}/><CancellationReturn order={order}/>{order.canCancel&&<p className="hint">Cancel before {time(order.cancelUntil)}.</p>}{requests.map(r=><div key={r.sku}><p>{r.replacement?'Exchange':'Earlier request'}: {r.sku}{r.replacement&&<> → {(r.exchange?.lines??[r.replacement]).map(line=>[line.name,line.color+' / '+line.size].filter(Boolean).join(' · ')).join(' + ')}{r.exchange?.difference>0&&` · ${cash(r.exchange.difference)} due at mock delivery`}</>} · {returnReasons[r.reason]} · {orderRequestStatus(r)}.{r.review&&!r.inspection&&<> {r.review.note}</>}</p><ReturnOutcome inspection={r.inspection}/></div>)}{order.issueReport&&<p>Issue reported: {returnReasons[order.issueReport.reason]} · {orderRequestStatus(order.issueReport)}.{order.issueReport.review&&<> {order.issueReport.review.note}</>}</p>}{order.status==='cancelled'&&<p>{order.payment.status==='mock_refunded'?'Cancelled · simulated refund recorded.':'Cancelled · no payment collected.'}</p>}
 {mode&&<StoreDialog title={mode==='cancel'?'Cancel order':mode==='return'?'Request an exchange':'Report a delivery issue'} onClose={()=>{if(!busy)M('');}}>
 {mode==='cancel'?<p>Cancel {order.id}? All items in this order will be cancelled. {order.status==='shipped'&&'If the courier attempts delivery, refuse the parcel so it can be returned to the warehouse.'}</p>:<div className="stack"><label>Item<select value={sku} onChange={e=>{S(e.target.value);setReplacementSku('');setAddOnSku('');}}>{(mode==='issue'?order.items:exchangeItems).map(i=><option key={i.sku} value={i.sku}>{i.name} · {i.color} / {i.size} × {i.qty}</option>)}</select></label><label>Reason<select value={reason} onChange={e=>R(e.target.value)}>{Object.entries(returnReasons).filter(([key])=>['fit','preference'].includes(key)===(mode==='return')).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Details {mode==='issue'?'(required)':'(optional)'}<textarea placeholder={mode==='issue'?'e.g. The parcel arrived with a torn sleeve.':'e.g. The shoulders felt too narrow.'} maxLength={1000} value={note} onChange={e=>N(e.target.value)}/></label>{mode==='return'&&<><p>{choices?.sameProduct?'Choose another size or colour of the original product.':
 'The original product has no available replacement for this quantity. Choose another product.'}</p>
 <label>Replacement<select value={replacementSku} onChange={e=>{setReplacementSku(e.target.value);setAddOnSku('');}}>
 <option value="">Choose a replacement</option>{choices?.options.map(option=><option value={option.sku} key={option.sku}>{option.name} · {option.color} / {option.size}{!choices.sameProduct&&` · ${cash(option.unitPrice*option.qty)}`}</option>)}
 </select></label>{replacement&&!choices.sameProduct&&<>
 <p>Exchange credit {cash(choices.credit)}</p>
 {replacement.unitPrice*replacement.qty<choices.credit&&<label>Additional item<select value={addOnSku} onChange={e=>setAddOnSku(e.target.value)}>
 <option value="">Choose another product</option>{choices.addOns.filter(option=>option.sku!==replacementSku).map(option=><option value={option.sku} key={option.sku}>{option.name} · {option.color} / {option.size} · {cash(option.unitPrice)}</option>)}
 </select></label>}
 <p role="status">{balance<0?`Add an item to cover the remaining ${cash(-balance)} credit.`:balance>0?`Difference due at mock delivery: ${cash(balance)}.`:'No difference due.'}</p>
 </>}<p>Exchange request deadline: {time(order.returnUntil)}. A request does not guarantee approval.</p><ul>{returnConditions.map(condition=><li key={condition}>{condition}</li>)}</ul><label className="checkbox-row"><input type="checkbox" checked={checked} onChange={e=>C(e.target.checked)}/>The item meets the exchange conditions.</label></>}</div>}
 <button className="button button-dark full" onClick={send} disabled={busy||(mode==='return'&&(!checked||!replacementSku||balance<0))||(mode==='issue'&&note.trim().length<5)}>{busy?'Submitting…':mode==='cancel'?'Confirm cancellation':'Submit request'}</button><ActionFeedback error={error} pending={busy?'Submitting…':''}/></StoreDialog>}</div>;
}
