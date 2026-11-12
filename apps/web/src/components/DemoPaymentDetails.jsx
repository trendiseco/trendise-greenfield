import {QRCodeSVG} from 'qrcode.react';
import {cash} from '../lib/api';

export default function DemoPaymentDetails({method,split,estimated}){
 if(method==='split')return <section className="demo-payment-details" aria-label="Partial payment breakdown">
  <h3>{estimated?'Estimated partial payment':'Partial payment breakdown'}</h3>
  <div className="summary-row"><span>Pay upfront (30%)</span><strong>{cash(split.upfront)}</strong></div>
  <div className="summary-row"><span>Cash on delivery (70%)</span><strong>{cash(split.remaining)}</strong></div>
  <p className="hint">Available for eligible postal areas at least 1,000 km from PIN 501505 by straight-line distance. The upfront payment and delivery collection are simulated.</p>
 </section>;
 if(method==='card')return <section className="demo-payment-details" aria-label="Sample card details">
  <h3>Test card details</h3>
  <p className="hint">These sample details are already filled in. No real card information is needed.</p>
  <div className="form-grid">
   <label>Cardholder name<input value="TRENDISE TEST CUSTOMER" readOnly autoComplete="off"/></label>
   <label>Expiry date<input value="12/30" readOnly autoComplete="off"/></label>
   <label className="full-span">Card number<input value="4111 1111 1111 1111" readOnly autoComplete="off"/></label>
  </div>
 </section>;
 if(method==='phonepe')return <section className="demo-payment-details demo-payment-qr" aria-label="PhonePe demo QR">
  <div><h3>PhonePe QR preview</h3><p>This is a demo QR, not a UPI payment code. No scan is needed to place a mock order.</p></div>
  <QRCodeSVG value="TRENDISE DEMO — PhonePe preview only. No payment can be made." title="PhonePe demo QR — no payment" size={128} marginSize={3}/>
 </section>;
 return <p className="hint">No payment details needed. Cash collection is simulated at delivery.</p>;
}
