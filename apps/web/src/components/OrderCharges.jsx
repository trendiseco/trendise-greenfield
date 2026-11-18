import {cash} from '../lib/api';
export default function OrderCharges({quote}){
 return <>{Number.isFinite(quote.exchangeCredit)&&<div className="summary-row"><span>Exchange credit</span><strong>{cash(quote.exchangeCredit)}</strong></div>}{Number.isFinite(quote.gstAmount)&&<div className="summary-row"><span>GST ({quote.gstRate}%, included)</span><strong>{cash(quote.gstAmount)}</strong></div>}<div className="summary-row"><span>Shipping</span><strong>{cash(quote.shipping)}</strong></div></>;
}
