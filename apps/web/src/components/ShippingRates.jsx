'use client';
import ActionFeedback from './ActionFeedback';
import {useState} from 'react';
import {api,cash} from '../lib/api';

export default function ShippingRates({token,canQuote,canExport}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState(''),[shipment,setShipment]=useState(null);
 async function exportOrder(event){
  event.preventDefault();
  const values=new FormData(event.currentTarget);
  const order=String(values.get('order')).trim().toUpperCase();
  if(!/^TRD-\d+$/.test(order)){setExportError('Enter a TRENDISE order number.');return;}
  setExporting(true);setExportError('');setShipment(null);
  try {
   const dimensions=Object.fromEntries(['weight','length','breadth','height'].map(key=>[key,Number(values.get(key))]));
   const data=await api('/api/admin/shipping/orders/'+order,{token,method:'POST',
    body:JSON.stringify({...dimensions,pickupLocation:values.get('pickupLocation')})});
   setShipment(data);
  } catch(error){setExportError(error.message);}
  finally{setExporting(false);}
 }
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
  {canQuote&&<><h2>Shiprocket courier lookup</h2>
  <p>Check courier availability and estimated rates for a sample parcel. Shipment booking and checkout charges stay mocked.</p>
  <form className="m02-grid" onSubmit={check}>
   <label>Delivery PIN<input name="deliveryPin" placeholder="e.g. 110001" inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required/></label>
   <label>Package weight (kg) <small>Example: 0.85 kg for a packed parcel</small><input name="weightKg" type="number" min="0.01" max="30" step="0.01" defaultValue="0.5" required/></label>
   <label>Payment type<select name="payment"><option value="cod">Cash on delivery</option><option value="prepaid">Prepaid</option></select></label>
   <button className="button button-dark" disabled={busy}>{busy?'Checking…':'Check courier rates'}</button>
   <ActionFeedback error={error} success={result?'Courier lookup completed.':''} pending={busy?'Checking courier rates…':''}/>
  </form>
  {result&&<div aria-live="polite">
   <p>{result.environment==='production'?'Production rate lookup':'Sandbox rate lookup'}</p>
   <p>Pickup {result.pickupPin} → Delivery {result.deliveryPin} · {result.weightKg} kg</p>
   {result.couriers.length?<ul>{result.couriers.map((courier,index)=><li key={index}>
    {courier.name} · {courier.rate===null?'Rate unavailable':cash(courier.rate)}{courier.estimatedDays&&' · Estimated days: '+courier.estimatedDays}
   </li>)}</ul>:<p>No couriers were returned for this route.</p>}
  </div>}</>}
  {canExport&&<>
   <h2>Export eligible COD order</h2>
   <p>Creates a Shiprocket order when production access is configured. Enter the saved pickup location and packed parcel dimensions.</p>
   <form onSubmit={exportOrder} className="m02-grid">
    <label>TRENDISE order number<input name="order" placeholder="TRD-10001" required/></label>
    <label>Shiprocket pickup location<input name="pickupLocation" required/></label>
    {Object.entries({weight:'Weight (kg)',length:'Length (cm)',breadth:'Breadth (cm)',height:'Height (cm)'}).map(([key,label])=>
     <label key={key}>{label}<input type="number" name={key} required min=".01" step=".01"/></label>
    )}
    <button className="button button-dark" disabled={exporting}>Export to Shiprocket</button>
    <ActionFeedback error={exportError} success={shipment?`Shiprocket order ${shipment.orderId} · Shipment ${shipment.shipmentId}`:''}
     pending={exporting?'Exporting order…':''}/>
   </form>
  </>}
 </section>;
}
