export default function CancellationReturn({order,staff=false}) {
 const returned=order.cancellationReturn;
 if(!returned)return null;
 return <section className="notice-box" aria-label="Cancellation return">
  <strong>{returned.status==='received'?'Cancellation return received':'Cancelled · return to warehouse pending'}</strong>
  {returned.status==='pending'&&<p>{staff
   ? returned.courierFollowUp
    ? 'Check the Shiprocket shipment. Stop handover if the parcel is still onsite, or follow up with the courier for return to origin. Warehouse can record receipt after physically checking the pieces.'
    : 'Record receipt after the simulated return reaches the warehouse and the pieces are inspected.'
   : 'If the courier attempts delivery, refuse the parcel. TRENDISE will update this order after the warehouse receives it.'}</p>}
  {staff&&returned.receipts.map(receipt=><p key={receipt.sku}>{receipt.sku} · {receipt.sellable} restocked · {receipt.quarantined} quarantined · {receipt.reason}</p>)}
 </section>;
}
