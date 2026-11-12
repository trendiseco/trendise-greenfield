import {cash} from '../lib/api';
import {paymentLabels} from '../../../../shared/order-policy.mjs';

const statuses={confirmed:'Confirmed',picking:'Processing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled'};
const dayLabel=value=>new Date(value+'T12:00:00+05:30').toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short'});
export default function AdminDashboard({data,onOpenOrders}){
 const {status,requests,payments,days}=data;
 const returnTotal=Object.values(requests.return).reduce((sum,value)=>sum+value,0);
 const received=data.returnsReceived??0;
 const inspections=data.inspections??{passed:0,failed:0,quarantinedUnits:0,refunds:0};
 const peak=Math.max(1,...days.map(d=>d.orders));
 return <section className="staff-panel admin-dashboard" id="admin-dashboard" aria-labelledby="admin-dashboard-title">
  <div className="panel-heading"><div><h2 id="admin-dashboard-title">Operations dashboard</h2><p className="hint">Website orders and shared stock · Development figures only</p></div></div>
  <div className="admin-dashboard-content">
   <section className="admin-return-summary" aria-labelledby="admin-return-heading">
    <div><h3 id="admin-return-heading">Returns</h3><button className="small-outline" onClick={()=>onOpenOrders('returns')}>Open returns ↗</button></div>
    <dl>{[['Total requests',returnTotal],['Awaiting review',requests.return.requested],['Approved, awaiting receipt',requests.return.approved-received],['Awaiting inspection',received-inspections.passed-inspections.failed],['Inspection passed',inspections.passed],['Inspection failed',inspections.failed],['Quarantined units',inspections.quarantinedUnits],['Mock return refunds',cash(inspections.refunds)],['Declined',requests.return.rejected]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   </section>
   <div className="metric-row">{[['Website orders',data.orders],['Non-cancelled order value',cash(data.orderValue)],['Simulated payments collected',cash(data.collected)],['Cash due on delivery',cash(data.cashDue)],['Delivery issues awaiting review',requests.issue.requested],['Available units',data.available],['Product approvals pending',data.pendingApprovals]].map(([label,value])=><div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
   <div className="admin-dashboard-grid">
    <section><h3>Order status</h3><dl>{Object.entries(statuses).map(([key,label])=><div key={key}><dt><button className="small-outline" onClick={()=>onOpenOrders(key)}>{label}</button></dt><dd>{status[key]}</dd></div>)}</dl></section>
    <section><h3>Payment methods</h3><dl>{Object.entries(payments).map(([key,value])=><div key={key}><dt>{paymentLabels[key]}</dt><dd>{value}</dd></div>)}</dl><p className="hint">Non-cancelled orders</p></section>
    <section><h3>Orders placed · last 7 days</h3><ol className="admin-dashboard-trend">{days.map(d=><li key={d.date}><span>{dayLabel(d.date)}</span><span className="admin-dashboard-bar" aria-hidden="true"><span style={{width:`${d.orders/peak*100}%`}}/></span><strong>{d.orders}</strong></li>)}</ol></section>
    <section><h3>Catalogue & stock</h3><dl>{[['Products',data.products],['Variants',data.variants],['System on hand',data.onHand],['Checkout reservations',data.reserved],['Customer profiles',data.customers],['Stock movements',data.stockEvents],['Audit events',data.auditEvents]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <section><h3>Stock by location</h3>{data.locations.map(l=><p key={l.id}><strong>{l.name}</strong><br/>{l.onHand} on hand · {l.reserved} reserved · {l.available} available</p>)}</section>
    <section><h3>Delivery issue decisions</h3><dl>{[['Issues approved',requests.issue.approved],['Issues declined',requests.issue.rejected]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="hint">Approval means follow-up, not a refund or pickup.</p></section>
   </div>
   <section><h3>Recent website orders</h3>{data.recentOrders.length?<ul className="admin-dashboard-recent">{data.recentOrders.map(o=><li key={o.id}><strong>{o.id}</strong><span>{o.status} · {cash(o.total)}</span></li>)}</ul>:<p>No website orders yet.</p>}<button className="small-outline" onClick={()=>onOpenOrders()}>Open Orders &amp; Returns ↗</button></section>
  </div>
 </section>;
}
