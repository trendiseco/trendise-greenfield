export default function ShipmentTracking({shipment,staff=false}){
 if(!shipment)return null;
 const {status,awb,updatedAt,events=[]}=shipment;
 const date=value=>new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
 return <section className="notice-box">
  <strong>Shiprocket tracking · {status}</strong>
  {awb&&<p>AWB {awb} · <a href="https://www.shiprocket.in/shipment-tracking/" target="_blank" rel="noreferrer">Track on Shiprocket ↗</a> (enter this AWB)</p>}
  {!awb&&<p>Tracking will be available once an AWB is assigned.</p>}
  {staff&&<p>Order {shipment.orderId} · Shipment {shipment.shipmentId} · <a href="https://app.shiprocket.in/seller/orders/new" target="_blank" rel="noreferrer">Open Shiprocket orders ↗</a></p>}
  {updatedAt&&<p>Updated {date(updatedAt)} IST</p>}
  {events.length>0&&<details><summary>Shipment updates</summary><ul>{events.slice().reverse().map((event,index)=><li key={index}>{date(event.at)} IST · {event.status}{event.activity&&' · '+event.activity}</li>)}</ul></details>}
 </section>;
}
