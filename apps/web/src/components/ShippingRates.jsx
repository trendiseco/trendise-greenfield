'use client';
import {useState} from 'react';
import {api,cash} from '../lib/api';

export default function ShippingRates({token}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 async function check(event){
  event.preventDefault();
  const values=new FormData(event.currentTarget);
  setBusy(true);setError('');setResult(null);
  try{
   setResult(await api('/api/admin/shipping/rates',{token,method:'POST',body:JSON.stringify({
    deliveryPin:values.get('deliveryPin'),weightKg:Number(values.get('weightKg')),cod:values.get('payment')==='cod'
   })}));
  }catch(error){setError(error.message);}
  finally{setBusy(false);}
 }
 return <section className="staff-panel" id="admin-shipping">
  <h2>Shiprocket courier lookup</h2>
  <p>Check courier availability and estimated rates for a sample parcel. Shipment booking and checkout charges stay mocked.</p>
  <form className="m02-grid" onSubmit={check}>
   <label>Delivery PIN<input name="deliveryPin" inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required/></label>
   <label>Package weight (kg)<input name="weightKg" type="number" min="0.01" max="30" step="0.01" defaultValue="0.5" required/></label>
   <label>Payment type<select name="payment"><option value="cod">Cash on delivery</option><option value="prepaid">Prepaid</option></select></label>
   <button className="button button-dark" disabled={busy}>{busy?'Checking…':'Check courier rates'}</button>
  </form>
  {error&&<p role="alert" className="error-box">{error}</p>}
  {result&&<div aria-live="polite">
   <p>Pickup {result.pickupPin} → Delivery {result.deliveryPin} · {result.weightKg} kg</p>
   {result.couriers.length?<ul>{result.couriers.map((courier,index)=><li key={index}>
    {courier.name} · {courier.rate===null?'Rate unavailable':cash(courier.rate)}{courier.estimatedDays&&' · Estimated days: '+courier.estimatedDays}
   </li>)}</ul>:<p>No couriers were returned for this route.</p>}
  </div>}
 </section>;
}
