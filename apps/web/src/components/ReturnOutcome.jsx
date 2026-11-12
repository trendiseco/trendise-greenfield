import {cash} from '../lib/api';

export default function ReturnOutcome({inspection,staff=false}){
 if(!inspection)return null;
 const {reason,at,quantity,locationName,disposition,refund,points}=inspection;
 return <div className="notice-box">
  <p><strong>Inspection reason</strong> · {reason}</p>
  {staff&&<p>{quantity} {quantity===1?'unit':'units'} · {disposition==='restocked'?'Restocked':'Quarantined outside sellable stock'} · {locationName} · {new Date(at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})} IST</p>}
  <p>{refund.status==='mock_recorded'?<>Mock refund recorded · <strong>{cash(refund.amount)}</strong>{staff&&<> · {refund.reference}</>}</>:'No refund due.'}</p>
  {(points.restored>0||points.reversed>0)&&<p>Loyalty points · {points.restored} restored · {points.reversed} reversed</p>}
  {staff&&points.unrecovered>0&&<p>{points.unrecovered} earned points were unavailable for reversal.</p>}
 </div>;
}
