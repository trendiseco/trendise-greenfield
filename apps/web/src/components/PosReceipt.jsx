'use client';
import {receiptLines} from '../../../../shared/pos-receipt.mjs';
import {posExchangeTerms} from '../../../../shared/order-policy.mjs';
import './pos-receipt.css';
const amount=value=>Number(value||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function PosReceipt({sale,onClose,canPrint=true}){
 const {quote}=sale,business=sale.receipt||{},lines=receiptLines(sale);
 const date=new Date(sale.at),quantity=lines.reduce((sum,line)=>sum+line.qty,0);
 const terms=typeof sale.terms==='string'?sale.terms:Array.isArray(sale.terms)?sale.terms.join('\n'):posExchangeTerms;
 return <section className="pos-receipt" aria-label="Saved receipt">
  <div className="pos-receipt-toolbar pos-print-hide">{canPrint&&<button onClick={()=>window.print()}>Print bill</button>}<button onClick={onClose}>Close receipt</button><small>80 mm receipt layout · choose your receipt printer and actual size / 100% scale.</small></div>
  <article className="thermal-receipt">
   <header className="thermal-heading"><img src="/media/brand/trendise-logo.svg" alt="TRENDISE" width="150" height="80"/><h2>{business.businessName||'TRENDISE'}</h2>
    <p>{sale.locationName||sale.locationId}</p>{business.address&&<p className="thermal-address">{business.address}</p>}
    {business.phone&&<p>Ph: {business.phone}</p>}{business.email&&<p>Email: {business.email}</p>}{business.gstin&&<p>GSTIN: {business.gstin}</p>}
   </header>
   <div className="thermal-divider"/><h3 className="thermal-title">Sale receipt</h3>
   <div className="thermal-meta"><div><strong>{sale.customer?.name||'Customer details unavailable'}</strong>{sale.customer?.phone&&<p>Ph: {sale.customer.phone}</p>}</div><div><p>Date: {date.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}</p><p>Time: {date.toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})}</p></div></div>
   <p className="thermal-right">Bill No: {sale.id}</p>{sale.staffId&&<p>Cashier: {sale.staffId}</p>}
   <div className="thermal-divider"/><div className="thermal-item-head"><b># Item name / HSN</b><div><span>Qty</span><span>Price</span><span>Amount</span></div></div><div className="thermal-divider"/>
   {lines.map((line,index)=><section className="thermal-item" key={line.sku}><p>{index+1}. <strong>{line.name}</strong>{line.hsn&&` (${line.hsn})`}</p><p>{line.color} / {line.size}</p><p className="thermal-code">SKU: {line.sku}{line.barcode&&<><br/>Barcode: {line.barcode}</>}</p><div className="thermal-item-values"><span>{line.qty} Pcs</span><span>{amount(line.netUnit??line.unitPrice)}</span><span>{amount(line.taxable??line.lineTotal)}</span></div>
    {Number.isFinite(line.gst)&&<div className="thermal-row thermal-indent"><span>GST {quote.gstRate||5}%</span><span>{amount(line.gst)}</span></div>}<div className="thermal-row thermal-indent"><span>Final amount</span><strong>{amount(line.lineTotal)}</strong></div>
   </section>)}
   <div className="thermal-divider"/><div className="thermal-row"><b>Qty: {quantity}</b><span>INR {amount(quote.total)}</span></div>
   {quote.discount>0&&<><div className="thermal-row"><span>Regular subtotal</span><span>{amount(quote.subtotal)}</span></div><div className="thermal-row"><span>Discount</span><span>−{amount(quote.discount)}</span></div></>}
   <div className="thermal-row thermal-total"><b>Total</b><b>{amount(quote.total)}</b></div><div className="thermal-row"><span>Payment method</span><span>{sale.payment.method}</span></div>
   <p className="thermal-centre thermal-demo">{sale.example?'SAMPLE BILL · ':''}DEVELOPMENT · PAYMENT SIMULATED<br/>No actual payment was collected.</p>
   {Number.isFinite(quote.gst)&&<><div className="thermal-divider"/><h3>Tax details (included)</h3><div className="thermal-row"><span>Taxable value</span><span>{amount(quote.taxable)}</span></div><div className="thermal-row"><span>GST @ {quote.gstRate||5}%</span><span>{amount(quote.gst)}</span></div></>}
   {Object.values({bankName:business.bankName,accountName:business.accountName,accountNumber:business.accountNumber,ifsc:business.ifsc}).some(Boolean)&&<><div className="thermal-divider"/><h3>Bank details</h3>{[['Bank name',business.bankName],['Account holder',business.accountName],['Account no.',business.accountNumber],['IFSC',business.ifsc]].filter(([,value])=>value).map(([label,value])=><p key={label}>{label}: {value}</p>)}</>}
   <div className="thermal-divider"/><h3>Terms & conditions</h3><p className="thermal-terms">{terms}</p>
   {sale.returns?.length>0&&<><div className="thermal-divider"/><h3>Exchange / adjustment history</h3>{sale.returns.map(entry=><p key={entry.id}>{entry.sku} × {entry.qty} · {entry.reason}{entry.replacement&&` → ${entry.replacement.sku}`}{entry.payment&&` · Difference INR ${amount(entry.payment.amount)} (simulated)`}</p>)}</>}
   <div className="thermal-divider"/><p className="thermal-centre">Thank you. Please visit again.</p>
  </article>
 </section>;
}
