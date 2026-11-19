'use client';
import ActionFeedback from '../../components/ActionFeedback';
import CustomerAuth from '../../components/CustomerAuth';
import {signOutCustomer} from '../../lib/customer-auth';
import {useEffect,useState,useRef} from 'react';
import Link from 'next/link';
import DemoPaymentDetails from '../../components/DemoPaymentDetails';
import OrderCharges from '../../components/OrderCharges';
import {websiteCharges} from '../../../../../shared/website-charges.mjs';
import OrderTerms from '../../components/OrderTerms';
import StoreDialog from '../../components/StoreDialog';
import {splitAmounts,splitEligible,codEligible} from '../../../../../shared/split-payment.mjs';
import {paymentLabels} from '../../../../../shared/order-policy.mjs';
import OfferPrice from '../../components/OfferPrice';
import {useCart} from '../../components/CartProvider';
import {api,cash,skuList,uniqueKey} from '../../lib/api';
const initialAddress={name:'',phone:'',line1:'',line2:'',city:'',district:'',state:'',pincode:''};
const pinMocks=[{label:'Hyderabad (demo)',city:'Hyderabad',district:'Hyderabad',state:'Telangana',pincode:'500001',line1:'Demo location near Abids'},{label:'Bengaluru (demo)',city:'Bengaluru',district:'Bengaluru Urban',state:'Karnataka',pincode:'560001',line1:'Demo location near MG Road'},{label:'Mumbai (demo)',city:'Mumbai',district:'Mumbai',state:'Maharashtra',pincode:'400001',line1:'Demo location near Fort'}];
export default function Checkout(){
 const [paymentChoice,setPaymentMethod]=useState('card'),[quoteRetry,setQuoteRetry]=useState(0);
 const cart=useCart();const [token,setToken]=useState(''),[address,setAddress]=useState(initialAddress),[addressMode,setAddressMode]=useState('manual'),[policy,setPolicy]=useState(null),[policyOpen,setPolicyOpen]=useState(false),[accepted,setAccepted]=useState(false),[coupon,setCoupon]=useState(''),[couponEdited,setCouponEdited]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[order,setOrder]=useState(null);
 useEffect(()=>{try{setToken(sessionStorage.getItem('trd_customer_token')||'');}catch{}api('/api/policy').then(setPolicy).catch(e=>setError(e.message));},[]);
 const [quote,setQuote]=useState(null),[quoteError,setQuoteError]=useState(''),[redeemPoints,setRedeemPoints]=useState(0),[rewards,setRewards]=useState(null);const pending=useRef(null);
 const quoteSignature=JSON.stringify({items:skuList(cart.items),coupon:coupon.trim().toUpperCase(),redeemPoints,displayedSubtotal:cart.subtotal});
 useEffect(()=>{let live=true;if(!token||!cart.items.length){setQuote(null);return;}setQuote(null);setQuoteError('');const timer=setTimeout(()=>{api('/api/checkout/quote',{token,method:'POST',body:quoteSignature}).then(q=>{if(live)setQuote({...q,signature:quoteSignature});}).catch(e=>{if(live){if(e.status===401){sessionStorage.removeItem('trd_customer_token');setToken('');setAccepted(false);setRewards(null);setError('Your session expired. Sign in again to continue.');}else setQuoteError(e.message);}});api('/api/account',{token}).then(r=>{if(live){setRewards(r);setAddress(a=>({...a,phone:a.phone||r.profile.phone,name:a.name||r.profile.name,email:r.profile.email||a.email}));}}).catch(()=>{});},300);return()=>{live=false;clearTimeout(timer);};},[token,quoteSignature,quoteRetry]);
 useEffect(()=>{if(!couponEdited)setCoupon(cart.offer?.code||'');},[cart.offer?.code,couponEdited]);
 const previewOffer=!couponEdited?cart.offer:null;
 const estimate={subtotal:cart.subtotal,...websiteCharges(cart.subtotal,previewOffer?.discount),coupon:previewOffer?.code,couponDiscount:previewOffer?.discount};
 const [pinLookup,setPinLookup]=useState(null);
 const pin=address.pincode;
 useEffect(()=>{
   if(!/^[1-9]\d{5}$/.test(pin))return;
   const controller=new AbortController();
   setPinLookup({pin,status:'loading'});
   fetch('/data/india-pins/'+pin[0]+'.json',{signal:controller.signal})
    .then(response=>{if(!response.ok)throw new Error('PIN directory unavailable');return response.json();})
    .then(directory=>{
      if(controller.signal.aborted)return;
      const match=directory[pin];
      if(!match){setPinLookup({pin,status:'missing'});return;}
      setAddress(current=>current.pincode===pin?{...current,district:current.district||match[0],state:current.state||match[1]}:current);
      setPinLookup({pin,status:'found',splitAvailable:splitEligible(match),codAvailable:codEligible(match)});
    })
    .catch(()=>{if(!controller.signal.aborted)setPinLookup({pin,status:'error'});});
   return()=>controller.abort();
 },[pin]);
 const pinStatus=pinLookup?.pin===pin?pinLookup.status:null;
 const canSplit=pinStatus==='found'&&pinLookup.splitAvailable;
 const canCod=pinStatus==='found'&&pinLookup.codAvailable;
 const paymentMethod=(paymentChoice==='split'&&!canSplit)||(paymentChoice==='cod'&&!canCod)?'card':paymentChoice;
 const currentQuote=quote?.signature===quoteSignature?quote:null;
 const paymentSplit=splitAmounts(currentQuote?.total??estimate.total);
 const pinHint={loading:'Looking up district and state…',missing:'PIN not found in the directory. Check it or enter your district and state manually.',found:'Postal area found. Review the district and state, then enter your city or town.',error:'PIN lookup is unavailable. Enter your district and state manually.'}[pinStatus]||'Enter a six-digit Indian PIN to suggest your district and state.';
 const update=(key,value)=>{if(key==='pincode'&&value!==pin)setPaymentMethod(method=>method==='split'?'card':method);setAddress(prev=>{
   if(key!=='pincode')return {...prev,[key]:value};
   const nextPin=value.replace(/\D/g,'').slice(0,6);
   const changed=/^\d{6}$/.test(prev.pincode)&&prev.pincode!==nextPin;
   return {...prev,pincode:nextPin,...(changed?{district:'',state:''}:{})};
 });};
 const acceptCustomer=result=>{
  sessionStorage.setItem('trd_customer_token',result.token);setToken(result.token);
  setAddress(previous=>({...previous,phone:previous.phone||result.phone,name:previous.name||result.name||''}));
 };
 const applyDemoLocation=demo=>{setPaymentMethod(method=>method==='split'?'card':method);setAddress(a=>({...a,...demo}));};
 const addressComplete=['name','line1','city','district','state'].every(k=>address[k].trim())&&/^[6-9]\d{9}$/.test(address.phone.trim())&&/^\d{6}$/.test(address.pincode.trim());
 const blocker=!cart.items.length?'Add a product to your bag.':!token?'Sign in or create an account in step 1.':!address.city.trim()?'Enter your city or town in step 2.':!addressComplete?'Complete the address, 10-digit contact number and 6-digit PIN in step 2.':!policy?'Terms could not load. Reload them in step 4.':!accepted?'Accept the Terms & Conditions in step 4.':quoteError?'Resolve the price check below before placing the order.':quote?.signature!==quoteSignature?'Checking the current price and offers…':'';
 const reloadPolicy=async()=>{setAccepted(false);try{setPolicy(await api('/api/policy'));setError('');}catch(e){setError(e.message);}};
 const place=async()=>{setBusy(true);setError('');try{
    if(!token)throw new Error('Sign in first.');
    if(!accepted||!policy)throw new Error('Read and accept the Terms & Conditions before continuing.');
    if(blocker)throw new Error(blocker);
    const fingerprint=JSON.stringify({items:skuList(cart.items),address:{...address,phone:address.phone.trim(),pincode:address.pincode.trim()},acceptedPolicyVersion:policy.version,coupon:coupon.trim().toUpperCase(),redeemPoints,paymentMethod});
    if(!pending.current||pending.current.fingerprint!==fingerprint||pending.current.token!==token)pending.current={fingerprint,token,key:uniqueKey()};
    const receipt=await api('/api/checkout/place',{method:'POST',token,headers:{'x-idempotency-key':pending.current.key},body:fingerprint});
    setOrder(receipt.order);pending.current=null;cart.clear();
  }catch(e){if(e.status===401){sessionStorage.removeItem('trd_customer_token');setToken('');setAccepted(false);setRewards(null);}if(e.code==='TERMS_REQUIRED'){await reloadPolicy();}setError(e.message);}finally{setBusy(false);}};
 if(order)return <main className="container section-pad checkout-confirm"><div className="success-circle">✓</div><div className="eyebrow">DEMO ORDER CONFIRMED</div><h1>Consider it <em>ordered.</em></h1><p>Your sample order <strong>{order.id}</strong> was placed. {order.payment.method==='cod'?'Cash is due only in the simulated delivery flow.':order.payment.method==='split'?'The upfront payment was simulated; the balance is due at mock delivery.':'The prepaid payment was simulated.'} No money was charged.</p><div className="confirmation-card"><div><span>ORDER NUMBER</span><strong>{order.id}</strong></div><div><span>DEMO TOTAL</span><OfferPrice quote={order.quote}/><OrderCharges quote={order.quote}/></div><div><span>PAYMENT</span><strong>{paymentLabels[order.payment.method]}</strong>{order.payment.split&&<p>{cash(order.payment.split.upfront)} upfront · {cash(order.payment.split.remaining)} on delivery</p>}</div></div><div className="button-row"><Link className="button button-dark" href="/orders">VIEW YOUR ORDER ↗</Link><Link className="button button-line" href="/shop">KEEP SHOPPING</Link></div></main>;
 return <main className="container section-pad checkout-page"><div className="eyebrow">SECURE CHECKOUT / DEVELOPMENT SIMULATION</div><h1>Almost <em>yours.</em></h1><div className="checkout-grid"><section className="checkout-steps">
    <div className="checkout-step"><div className="step-heading"><span>01</span><h2>YOUR ACCOUNT</h2>{token&&<b>SIGNED IN ✓</b>}</div>
    {token?<p className="verified-line">You’re signed in. <button className="text-button" onClick={async()=>{try{await signOutCustomer(token);setToken('');setAccepted(false);setRewards(null);}catch(error){setError(error.message);}}}>Use another account</button></p>:<CustomerAuth onSignedIn={acceptCustomer} next="/checkout"/>}
    </div><div className="checkout-step"><div className="step-heading"><span>02</span><h2>DELIVERY ADDRESS</h2></div><p className="hint">Choose a method. Live maps and geolocation are intentionally simulated during Development.</p><div className="method-row"><button className={addressMode==='manual'?'chosen':''} onClick={()=>setAddressMode('manual')}>✎ MANUAL</button><button className={addressMode==='location'?'chosen':''} onClick={()=>setAddressMode('location')}>◎ MOCK LIVE LOCATION</button><button className={addressMode==='pin'?'chosen':''} onClick={()=>setAddressMode('pin')}>⌖ MOCK MAP PIN</button></div>{addressMode!=='manual'&&<div className="location-demo"><p>{addressMode==='pin'?'Select a demonstration map pin (no map provider connected).':'Choose a simulated location (device GPS is not accessed).'}</p><div className="chip-row">{pinMocks.map(d=><button className="selection-chip" key={d.pincode} onClick={()=>applyDemoLocation(d)}>{d.label}</button>)}</div></div>}
      <div className="form-grid"><label>FULL NAME * <input value={address.name} onChange={e=>update('name',e.target.value)} placeholder="e.g. Asha Sharma"/></label><label>CONTACT NUMBER * <input value={address.phone} onChange={e=>update('phone',e.target.value)} placeholder="e.g. 9876543210" inputMode="tel"/></label><label className="full-span">HOUSE / STREET * <input value={address.line1} onChange={e=>update('line1',e.target.value)} placeholder="e.g. Flat 4B, Lotus Apartments, Park Road"/></label><label className="full-span">LANDMARK / ADDRESS LINE 2 <input value={address.line2} onChange={e=>update('line2',e.target.value)} placeholder="e.g. Opposite the community park"/></label><label className="full-span">CITY * <input required value={address.city} onChange={e=>update('city',e.target.value)} placeholder="e.g. Hyderabad" autoComplete="address-level2"/></label><div className="full-span"><label>PIN CODE * <input value={address.pincode} onChange={e=>update('pincode',e.target.value)} placeholder="e.g. 500001" maxLength="6" inputMode="numeric" autoComplete="postal-code" aria-describedby="checkout-pin-hint"/></label><p id="checkout-pin-hint" className="hint" role="status">{pinHint}</p></div><label>DISTRICT * <input required value={address.district} onChange={e=>update('district',e.target.value)} placeholder="e.g. Hyderabad"/></label><label>STATE / UNION TERRITORY * <input value={address.state} onChange={e=>update('state',e.target.value)} placeholder="e.g. Telangana" autoComplete="address-level1"/></label></div>
    </div><div className="checkout-step"><div className="step-heading"><span>03</span><h2>PAYMENT METHOD</h2></div><fieldset className="checkout-methods"><legend>Choose a test payment method</legend>{Object.entries(paymentLabels).filter(([key])=>key!=='exchange'&&(key!=='split'||canSplit)).map(([key,label])=><label className="checkbox-row" key={key}><input type="radio" disabled={key==='cod'&&!canCod} name="payment-method" value={key} checked={paymentMethod===key} onChange={()=>setPaymentMethod(key)}/>{label}</label>)}</fieldset>{!canCod&&<p className="hint">Cash on delivery is available only within 1,000 km of PIN 501505. Enter a recognised delivery PIN to check eligibility.</p>}<DemoPaymentDetails method={paymentMethod} split={paymentSplit} estimated={!currentQuote}/></div><div className="checkout-step"><div className="step-heading"><span>04</span><h2>REVIEW & CONSENT</h2></div><p>Cancel an undelivered order within 12 hours of placement. For change of mind, request an exchange within 3 days of delivery. Keep the tags attached and the item unused and unmarked.</p>{!policy&&<button className="text-button" onClick={reloadPolicy}>Reload Terms & Conditions</button>}<label className="checkbox-row"><input type="checkbox" disabled={!policy} checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>I have read and agree to the <button className="policy-link" onClick={e=>{e.preventDefault();setPolicyOpen(true);}}>Terms & Conditions</button> ({policy?.version||'loading'}). This acceptance is required to continue.</span></label><p className="hint">Marketing consent is not part of this mandatory checkbox. Payment and shipping use mock providers only.</p></div>
   </section><aside className="summary-box checkout-summary"><div className="eyebrow">YOUR ORDER / {cart.count} ITEMS</div><h2>Order summary.</h2>{!cart.items.length?<p>Your bag is empty. <Link href="/shop">Shop now →</Link></p>:cart.items.map(x=><div className="checkout-item" key={x.sku}><div><strong>{x.name}</strong><span>{x.color} / {x.size} × {x.qty}</span></div><strong>{cash(x.qty*x.price)}</strong></div>)}<div className="summary-row"><span>SUBTOTAL</span><strong>{cash(cart.subtotal)}</strong></div><label className="coupon-field">ONLINE COUPON <input value={coupon} onChange={e=>{setCouponEdited(true);setCoupon(e.target.value);}} placeholder="e.g. BIRTHDAY"/></label>{!couponEdited&&cart.offer&&<p className="hint">{cart.offer.code} automatically selected. {!token&&'Sign in to confirm eligibility. '}You can replace or remove this code.</p>}{token&&rewards&&<div className="checkout-rewards"><label>LOYALTY POINTS TO REDEEM<input type="number" min="0" step="1" value={redeemPoints} onChange={e=>setRedeemPoints(Number(e.target.value))}/><small>For example, enter 10 to redeem 10 points.</small></label><p className="hint">{rewards.availablePoints} available · minimum {rewards.rules.minRedeem} · max {rewards.rules.maxRedeemPercent}% of the order after coupon.</p><Link href="/account">Birthday & points details ↗</Link></div>}{quoteError&&<div className="error-box" role="alert"><p>{quoteError}</p>{coupon&&<button className="text-button" onClick={()=>{setCouponEdited(true);setCoupon('');}}>Remove coupon</button>}{redeemPoints>0&&<button className="text-button" onClick={()=>setRedeemPoints(0)}>Remove points redemption</button>}<button className="text-button" onClick={()=>setQuoteRetry(n=>n+1)}>Retry price check</button></div>}{quote&&<><div className="summary-row"><span>COUPON DISCOUNT</span><strong>−{cash(quote.couponDiscount)}</strong></div><div className="summary-row"><span>POINTS DISCOUNT</span><strong>−{cash(quote.pointsDiscount)}</strong></div><p className="hint">Earn {quote.earnPoints} points after mock payment.</p></>}<OrderCharges quote={currentQuote||estimate}/><div className="summary-total"><span>{paymentMethod==='split'?'ORDER TOTAL (MOCK)':'PAYABLE (MOCK)'}</span>{currentQuote?<OfferPrice quote={currentQuote}/>:!token?<OfferPrice quote={estimate}/>:<strong>{quoteError?'Price unavailable':'Checking price…'}</strong>}</div><p className="hint" role="status">{blocker}</p><button onClick={place} disabled={busy||!!blocker} className="button button-dark full">{busy?'PLACING DEMO ORDER…':'PLACE MOCK ORDER'} <span>↗</span></button><ActionFeedback error={error} pending={busy?'Placing order…':''}/><p className="summary-help">No real money is charged. Test coupons and fake orders are not production transactions.</p></aside></div>
 {policyOpen&&<StoreDialog title="Terms & Conditions" className="size-chart-dialog" onClose={()=>setPolicyOpen(false)}><OrderTerms policy={policy}/><button className="button button-dark full" onClick={()=>setPolicyOpen(false)}>BACK TO CHECKOUT</button></StoreDialog>}

 </main>;
}
