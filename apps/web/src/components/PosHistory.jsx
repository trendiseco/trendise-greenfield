'use client';
import {posExchangeTerms,returnMs} from '../../../../shared/order-policy.mjs';
import ActionFeedback from './ActionFeedback';
import {useRef,useState} from 'react';
import {api,cash,uniqueKey} from '../lib/api';
import '../app/pos/register.css';
import PurchaseChannel from './PurchaseChannel';

export const saleDate = at => new Date(at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'});

export {default as PosReceipt} from './PosReceipt';

function BillItems({items}) {
 return <ul>{items.map(line=><li key={line.sku}><strong>{line.name}</strong> · {line.color} / {line.size} · {line.sku}{line.barcode&&` · Barcode ${line.barcode}`} · {line.qty} × {cash(line.unitPrice)}</li>)}</ul>;
}

function ReturnEntries({sale}) {
 return sale.returns?.length>0&&<ul>{sale.returns.map(entry=><li key={entry.id}>{saleDate(entry.at)} · {entry.sku} × {entry.qty} · {entry.reason} · {entry.replacement?<>Exchange → {entry.replacement.color} / {entry.replacement.size} · {entry.replacement.sku}</>:<>Historical refund · {cash(entry.refund)}</>}{entry.exchange?.lines[1]&&` + ${entry.exchange.lines[1].name} (${entry.exchange.lines[1].sku})`}{entry.payment&&` · Difference ${cash(entry.payment.amount)} (${entry.payment.method}, simulated)`} · Received at {entry.locationId}</li>)}</ul>;
}

function PosExchange({sale,token,onReturned}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [choices,setChoices]=useState(null),[quote,setQuote]=useState(null);
 const attempt=useRef(null),inProgress=useRef(false);
 const [originalBarcode,setOriginalBarcode]=useState('');
 const original=sale.items.find(item=>item.barcode===originalBarcode.trim());
 const remaining=original?original.qty-(sale.returns||[]).filter(entry=>entry.sku===original.sku).reduce((sum,entry)=>sum+entry.qty,0):0;
 function scanEnter(event,action){
  if(event.key!=='Enter')return;
  event.preventDefault();
  const form=event.currentTarget.form;
  form.requestSubmit(form.querySelector('button[value="'+action+'"]'));
 }
 async function submit(event) {
  event.preventDefault();
  if(inProgress.current)return;
  const form=event.currentTarget,fields=new FormData(form);
  const action=event.nativeEvent.submitter?.value||'options';
  if(!original||remaining<1){setError('Scan a garment from this bill with pieces remaining for exchange.');return;}
  if(Number(fields.get('qty'))>remaining){setError('Exchange quantity exceeds the remaining pieces on this bill.');return;}
  inProgress.current=true;
  const body=JSON.stringify({
   action,barcode:fields.get('barcode'),qty:Number(fields.get('qty')),replacementBarcode:fields.get('replacementBarcode'),
   addOnBarcode:fields.get('addOnBarcode'),reason:fields.get('reason'),sellable:fields.get('sellable')==='on',
   ...(action==='complete'?{expectedDifference:quote?.difference,paymentMethod:fields.get('paymentMethod')}:{}),
  });
  if(attempt.current?.body!==body)attempt.current={body,key:uniqueKey()};
  setBusy(true);setError('');setNotice('');
  try {
   const result=await api(`/api/pos/sales/${sale.id}/returns`,{token,method:'POST',body,headers:{'x-idempotency-key':attempt.current.key}});
   if(action==='options'){setChoices(result);setQuote(null);return;}
   if(action==='quote'){setQuote(result);return;}
   onReturned(result.sale);form.reset();setOriginalBarcode('');attempt.current=null;setChoices(null);setQuote(null);
   setNotice(`Exchange saved. ${result.return.payment?`${cash(result.return.payment.amount)} recorded as simulated payment.`:'No price difference.'}`);
  } catch(error) {setError(error.message);}
  finally {inProgress.current=false;setBusy(false);}
 }
 function resetOptions(){setChoices(null);setQuote(null);setError('');setNotice('');}
 return <form onSubmit={submit}>
  <fieldset className="m02-grid" disabled={busy}>
  <legend>Scan original garment</legend>
  <label>Barcode on the garment being exchanged<input name="barcode" required autoComplete="off" value={originalBarcode} onKeyDown={event=>scanEnter(event,'options')} onChange={event=>{setOriginalBarcode(event.target.value);resetOptions();}}/></label>
  {original&&<p>{original.name} · {original.color} / {original.size} · {remaining} piece(s) remaining on this bill.</p>}
  <label>Quantity<input name="qty" type="number" min="1" max={Math.min(25,remaining||25)} required defaultValue="1" onChange={resetOptions}/></label>
  <button value="options" formNoValidate disabled={busy||!original||remaining<1}>Check available replacements</button>
  {choices&&<><h3>Scan new garment</h3><p>{choices.sameProduct?'Choose another size or colour of the original product.':
   `The original product has no available replacement for this quantity. Exchange credit ${cash(choices.credit)}.`}</p>
  {choices.options.length>0?<><label>Replacement barcode<input name="replacementBarcode" list={`exchange-${sale.id}`} autoComplete="off" required onKeyDown={event=>scanEnter(event,'quote')} onChange={()=>{setQuote(null);setError('');}}/></label>
  <datalist id={`exchange-${sale.id}`}>{choices.options.map(option=><option value={option.barcode} key={option.sku}>{option.name} · {option.color} / {option.size} · {cash(option.unitPrice)}</option>)}</datalist>
  {!choices.sameProduct&&<label>Additional item barcode<input name="addOnBarcode" list={`add-on-${sale.id}`} autoComplete="off" onKeyDown={event=>scanEnter(event,'quote')} onChange={()=>{setQuote(null);setError('');}}/></label>}
  {!choices.sameProduct&&<datalist id={`add-on-${sale.id}`}>{choices.addOns.map(option=><option value={option.barcode} key={option.sku}>{option.name} · {option.color} / {option.size} · {cash(option.unitPrice)}</option>)}</datalist>}
  <button value="quote" formNoValidate disabled={busy}>Check price difference</button>
  {quote&&<><h3>Review exchange</h3><BillItems items={quote.lines}/><p>Exchange credit {cash(quote.credit)} · Replacement total {cash(quote.subtotal)}</p><p role="status">{quote.shortfall?`Add another product to cover the remaining ${cash(quote.shortfall)} credit.`:`Difference due: ${cash(quote.difference)}.`}</p></>}
  {quote&&!quote.shortfall&&<>
  {quote.difference>0&&<label>Simulated payment method<select name="paymentMethod" required defaultValue=""><option value="">Choose a method</option><option>Cash</option><option>UPI</option><option>Card</option></select></label>}
  <label>Exchange reason<input name="reason" required maxLength={240} placeholder="e.g. Wrong size"/></label>
  <label><input name="sellable" type="checkbox" required/> Tags and condition checked. Item is sellable and ready for warehouse restock.</label>
  <button value="complete" disabled={busy}>{busy?"Saving exchange…":"Complete exchange"}</button></>}</>:<p>No replacement is currently available.</p>}</>}
  </fieldset><ActionFeedback error={error} success={notice} pending={busy?'Checking exchange…':''}/>
 </form>;
}

export function PosSaleList({sales,token,onReceipt,onReturned}) {
 const eligible=sale=>!sale.example&&Date.now()>=Date.parse(sale.at)&&Date.now()-Date.parse(sale.at)<returnMs&&sale.items.some(item=>item.qty>(sale.returns||[]).filter(entry=>entry.sku===item.sku).reduce((sum,entry)=>sum+entry.qty,0));
 return sales.length ? sales.map(sale=><details key={sale.id} className="pos-history-bill">
  <summary>{sale.example&&'Sample · '}{sale.id} · {saleDate(sale.at)} · {sale.customer ? `${sale.customer.name} · ${sale.customer.phone}` : 'Older bill'} · {cash(sale.quote.total)}</summary>
  <p>{sale.payment.method} · {sale.locationName||sale.locationId}{sale.staffId&&` · Cashier ${sale.staffId}`}</p>
  {sale.example&&<p>{sale.example}</p>}<BillItems items={sale.items}/><ReturnEntries sale={sale}/>
  {onReceipt&&<button onClick={()=>onReceipt(sale)}>View / print bill</button>}
  {onReturned&&eligible(sale)&&<PosExchange sale={sale} token={token} onReturned={onReturned}/>}
  {onReturned&&!eligible(sale)&&<p className="hint">{sale.example?'Sample bills support receipt previews. Use an actual POS bill to exchange.':Date.now()-Date.parse(sale.at)>=returnMs?'The 3-day exchange window for this bill has closed.':'No pieces remain eligible for exchange on this bill.'}</p>}
 </details>) : <p>No store bills found.</p>;
}

export function WebsiteOrderList({orders}) {
 return orders.length ? orders.map(order=><details className="pos-history-bill" key={order.id}>
  <summary>{order.id} · {saleDate(order.at)} · {order.status} · {cash(order.total)}</summary>
  <p>{[order.name,order.phone,order.payment].filter(Boolean).join(' · ')}</p>
  <BillItems items={order.items}/>
 </details>) : <p>No website orders found.</p>;
}

export default function PosHistory({token,onReceipt,onInventoryChanged,showChannels=false,exchangeOnly=false}) {
 const [phone,setPhone]=useState(''),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [channel,setChannel]=useState('sales'),[notice,setNotice]=useState('');
 async function search(event) {
  event.preventDefault();
  await loadHistory(phone);
 }
 async function loadHistory(mobile) {
  setError('');setNotice('');setResult(null);setBusy(true);
  try {setResult(await api('/api/pos/customers/search',{token,method:'POST',body:JSON.stringify({phone:mobile})}));}
  catch(error) {setError(error.message);}
  finally {setBusy(false);}
 }
 function returned(sale) {
  setResult(previous=>({...previous,sales:previous.sales.map(bill=>bill.id===sale.id?sale:bill)}));
  setNotice('Exchange saved successfully. The original bill history and central stock have been updated.');
  onInventoryChanged();
 }
 return <section className="staff-panel pos-history"><h2>{exchangeOnly?'Exchange':'Customer search'}{showChannels&&' · '+(channel==='sales'?'Store POS':'Website')}</h2>
  {exchangeOnly&&<p>Find the customer by mobile number and open the original bill. Scan the garment being exchanged, check available replacements, then scan the new garment and review any price difference. Exchanges are available within 3 days of purchase, with the original receipt and tags.</p>}
  {showChannels&&<PurchaseChannel channel={channel} onChange={setChannel}/>}
  <form className={showChannels?'m02-grid':'scanner-row'} onSubmit={search}>
   <label>Mobile number<input required type="tel" value={phone} onChange={event=>{setPhone(event.target.value);setResult(null);}} disabled={busy} placeholder="e.g. 9999900001"/></label>
   <div className="button-row"><button type="submit" className="button button-dark" disabled={busy}>{busy?'Searching…':'Search'}</button>
    {showChannels&&<button type="button" disabled={busy} onClick={()=>{setPhone('9999900001');loadHistory('9999900001');}}>Search sample customer</button>}
   </div>
  </form>
  <ActionFeedback error={error} success={notice}/>
  {result&&<>
   <h3>{result.name||'Customer'} · {result.phone}</h3>
   {(!showChannels||channel==='sales')&&<><h4>Store purchases</h4>
    <PosSaleList sales={result.sales} token={token} onReceipt={onReceipt} onReturned={onInventoryChanged?returned:undefined}/>
   </>}
   {!exchangeOnly&&(!showChannels||channel==='orders')&&<><h4>Website orders</h4>
    <WebsiteOrderList orders={result.orders}/>
   </>}
  </>}
 </section>;
}
