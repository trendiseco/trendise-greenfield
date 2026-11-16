'use client';
import {useRef,useState} from 'react';
import {api,cash,uniqueKey} from '../lib/api';
import '../app/pos/register.css';
import PurchaseChannel from './PurchaseChannel';

export const saleDate = at => new Date(at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'});

export function PosReceipt({sale,onClose}) {
 const {quote}=sale;
 return <section className="staff-panel pos-receipt" aria-label="Saved receipt">
  <div className="panel-heading"><h2>TRENDISE · Store receipt</h2><div className="button-row pos-print-hide"><button onClick={()=>window.print()}>Print bill</button><button onClick={onClose}>Close receipt</button></div></div>
  <p>{sale.example&&'Sample bill · '}{sale.id} · {sale.locationName||sale.locationId} · {saleDate(sale.at)}</p>
  <p>{sale.customer ? `${sale.customer.name} · ${sale.customer.phone}` : 'Customer details unavailable on this older bill'}{sale.staffId&&` · Cashier ${sale.staffId}`}</p>
  <BillItems items={sale.items}/>
  <dl><dt>Subtotal</dt><dd>{cash(quote.subtotal)}</dd><dt>Discount</dt><dd>{cash(quote.discount)}</dd>
   {quote.gstRate&&<><dt>Taxable value</dt><dd>{cash(quote.taxable)}</dd><dt>Included GST ({quote.gstRate}%)</dt><dd>{cash(quote.gst)}</dd></>}
   <dt>Total</dt><dd>{cash(quote.total)}</dd><dt>Payment</dt><dd>{sale.payment.method} · simulated</dd>
  </dl>
  <h3>Terms & conditions</h3>{typeof sale.terms==='string'?<p className="pos-receipt-terms">{sale.terms}</p>:<ul>{(sale.terms||['Keep the original bill and product tags for return verification.','Development receipt. Payment and refund records are simulated.']).map(term=><li key={term}>{term}</li>)}</ul>}
  <ReturnEntries sale={sale}/>
 </section>;
}

function BillItems({items}) {
 return <ul>{items.map(line=><li key={line.sku}><strong>{line.name}</strong> · {line.color} / {line.size} · {line.sku}{line.barcode&&` · Barcode ${line.barcode}`} · {line.qty} × {cash(line.unitPrice)}</li>)}</ul>;
}

function ReturnEntries({sale}) {
 return sale.returns?.length>0&&<ul>{sale.returns.map(entry=><li key={entry.id}>{saleDate(entry.at)} · {entry.sku} × {entry.qty} · {entry.reason} · {cash(entry.refund)} mock refund · Restocked at {entry.locationId}</li>)}</ul>;
}

function PosReturn({sale,token,onReturned}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const attempt=useRef(null);
 async function submit(event) {
  event.preventDefault();
  const form=event.currentTarget,fields=new FormData(form);
  const body=JSON.stringify({barcode:fields.get('barcode'),qty:Number(fields.get('qty')),reason:fields.get('reason'),sellable:fields.get('sellable')==='on'});
  if(attempt.current?.body!==body)attempt.current={body,key:uniqueKey()};
  setBusy(true);setError('');setNotice('');
  try {
   const result=await api(`/api/pos/sales/${sale.id}/returns`,{token,method:'POST',body,headers:{'x-idempotency-key':attempt.current.key}});
   onReturned(result.sale);form.reset();attempt.current=null;
   setNotice(`Restocked ${result.return.qty} at Hyderabad Warehouse. Mock refund ${cash(result.return.refund)}.`);
  } catch(error) {setError(error.message);}
  finally {setBusy(false);}
 }
 return <form onSubmit={submit} className="m02-grid">
  <label>Scan returned garment<input name="barcode" required autoComplete="off" placeholder="e.g. 0012345678905" onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.form.elements.qty.focus();}}}/></label>
  <label>Quantity<input name="qty" type="number" min="1" max="25" required defaultValue="1"/></label>
  <label>Return reason<input name="reason" required maxLength={240} placeholder="e.g. Wrong size"/></label>
  <label><input name="sellable" type="checkbox" required/> Tags and condition checked. Item is sellable and ready for warehouse restock.</label>
  <button disabled={busy}>{busy?"Saving return…":"Accept return & restock"}</button>
  {error&&<p role="alert" className="error-box">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </form>;
}

export function PosSaleList({sales,token,onReceipt,onReturned}) {
 return sales.length ? sales.map(sale=><details key={sale.id} className="pos-history-bill">
  <summary>{sale.example&&'Sample · '}{sale.id} · {saleDate(sale.at)} · {sale.customer ? `${sale.customer.name} · ${sale.customer.phone}` : 'Older bill'} · {cash(sale.quote.total)}</summary>
  <p>{sale.payment.method} · {sale.locationName||sale.locationId}{sale.staffId&&` · Cashier ${sale.staffId}`}</p>
  {sale.example&&<p>{sale.example}</p>}<BillItems items={sale.items}/><ReturnEntries sale={sale}/>
  {onReceipt&&<button onClick={()=>onReceipt(sale)}>View / print bill</button>}
  {onReturned&&!sale.example&&sale.items.some(item=>item.qty>(sale.returns||[]).filter(entry=>entry.sku===item.sku).reduce((sum,entry)=>sum+entry.qty,0))&&<PosReturn sale={sale} token={token} onReturned={onReturned}/>}
 </details>) : <p>No store bills found.</p>;
}

export function WebsiteOrderList({orders}) {
 return orders.length ? orders.map(order=><details className="pos-history-bill" key={order.id}>
  <summary>{order.id} · {saleDate(order.at)} · {order.status} · {cash(order.total)}</summary>
  <p>{[order.name,order.phone,order.payment].filter(Boolean).join(' · ')}</p>
  <BillItems items={order.items}/>
 </details>) : <p>No website orders found.</p>;
}

export default function PosHistory({token,onReceipt,onInventoryChanged,showChannels=false}) {
 const [phone,setPhone]=useState(''),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [channel,setChannel]=useState('sales');
 async function search(event) {
  event.preventDefault();
  await loadHistory(phone);
 }
 async function loadHistory(mobile) {
  setError('');setResult(null);setBusy(true);
  try {setResult(await api('/api/pos/customers/search',{token,method:'POST',body:JSON.stringify({phone:mobile})}));}
  catch(error) {setError(error.message);}
  finally {setBusy(false);}
 }
 function returned(sale) {
  setResult(previous=>({...previous,sales:previous.sales.map(bill=>bill.id===sale.id?sale:bill)}));
  onInventoryChanged();
 }
 return <section className="staff-panel pos-history"><h2>Customer search{showChannels&&' · '+(channel==='sales'?'Store POS':'Website')}</h2>
  {showChannels&&<PurchaseChannel channel={channel} onChange={setChannel}/>}
  <form className={showChannels?'m02-grid':'scanner-row'} onSubmit={search}>
   <label>Mobile number<input required type="tel" value={phone} onChange={event=>{setPhone(event.target.value);setResult(null);}} disabled={busy} placeholder="e.g. 9999900001"/></label>
   <div className="button-row"><button type="submit" className="button button-dark" disabled={busy}>{busy?'Searching…':'Search'}</button>
    {showChannels&&<button type="button" disabled={busy} onClick={()=>{setPhone('9999900001');loadHistory('9999900001');}}>Search sample customer</button>}
   </div>
  </form>
  {error&&<p role="alert" className="error-box">{error}</p>}
  {result&&<>
   <h3>{result.name||'Customer'} · {result.phone}</h3>
   {(!showChannels||channel==='sales')&&<><h4>Store purchases</h4>
    <PosSaleList sales={result.sales} token={token} onReceipt={onReceipt} onReturned={onInventoryChanged?returned:undefined}/>
   </>}
   {(!showChannels||channel==='orders')&&<><h4>Website orders</h4>
    <WebsiteOrderList orders={result.orders}/>
   </>}
  </>}
 </section>;
}
