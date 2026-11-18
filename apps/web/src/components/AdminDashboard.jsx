import {useState} from 'react';
import PurchaseChannel from './PurchaseChannel';
import {cash} from '../lib/api';
import {paymentLabels} from '../../../../shared/order-policy.mjs';

const statuses={confirmed:'Confirmed',picking:'Processing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled'};
const dayLabel=value=>new Date(value+'T12:00:00+05:30').toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short'});
export default function AdminDashboard({data,onOpenOrders}){
 const [channel,setChannel]=useState('orders');
 const {status,requests,payments,days}=data;
 const returnTotal=Object.values(requests.return).reduce((sum,value)=>sum+value,0);
 const received=data.returnsReceived??0;
 const inspections=data.inspections??{passed:0,failed:0,quarantinedUnits:0,refunds:0};
 const peak=Math.max(1,...days.map(d=>d.orders));
 return <section className="staff-panel admin-dashboard" id="admin-dashboard" aria-labelledby="admin-dashboard-title">
  <div className="panel-heading"><div><h2 id="admin-dashboard-title">Operations dashboard</h2><p className="hint">Website orders and Store POS sales · Development figures only</p></div></div>
  <div className="admin-dashboard-content">
   <PurchaseChannel channel={channel} onChange={setChannel}/>
   {channel==='sales'?<section aria-labelledby="dashboard-pos">
    <h3 id="dashboard-pos">Store POS</h3>
    <div className="metric-row">
     {Object.entries({'Bills':data.pos.bills,'Customers':data.pos.customers,'Gross sales':cash(data.pos.gross),'Mock refunds':cash(data.pos.refunded),'Net sales':cash(data.pos.net),'Exchanges':data.pos.exchanges}).map(([label,value])=><div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <h4>Recent Store POS bills</h4>
    {data.pos.recentSales.length?<ul className="admin-dashboard-recent">{data.pos.recentSales.map(sale=><li key={sale.id}><strong>{sale.id}</strong><span>{sale.method} · {cash(sale.total)}</span></li>)}</ul>:<p>No Store POS bills in this period.</p>}
   </section>:<section aria-labelledby="dashboard-website"><h3 id="dashboard-website">Customer website</h3>
   <section className="admin-return-summary"  aria-labelledby="admin-return-heading">
    <div><h3 id="admin-return-heading">Exchanges</h3><button className="small-outline" onClick={()=>onOpenOrders('returns')}>Open exchanges ↗</button></div>
    <dl>{[['Total requests',returnTotal],['Awaiting review',requests.return.requested],['Approved, awaiting receipt',requests.return.approved-received],['Awaiting inspection',received-inspections.passed-inspections.failed],['Inspection passed',inspections.passed],['Inspection failed',inspections.failed],['Quarantined units',inspections.quarantinedUnits],['Declined',requests.return.rejected]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   </section>
   <div className="metric-row">{[['Website orders',data.orders],['Non-cancelled order value',cash(data.orderValue)],['Simulated payments collected',cash(data.collected)],['Cash due on delivery',cash(data.cashDue)],['Delivery issues awaiting review',requests.issue.requested],['Customer profiles',data.customers]].map(([label,value])=><div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
   <div className="admin-dashboard-grid">
    <section><h3>Order status</h3><dl>{Object.entries(statuses).map(([key,label])=><div key={key}><dt><button className="small-outline" onClick={()=>onOpenOrders(key)}>{label}</button></dt><dd>{status[key]}</dd></div>)}</dl></section>
    <section><h3>Payment methods</h3><dl>{Object.entries(payments).map(([key,value])=><div key={key}><dt>{paymentLabels[key]}</dt><dd>{value}</dd></div>)}</dl><p className="hint">Non-cancelled orders</p></section>
    <section><h3>Orders placed · last 7 days</h3><ol className="admin-dashboard-trend">{days.map(d=><li key={d.date}><span>{dayLabel(d.date)}</span><span className="admin-dashboard-bar" aria-hidden="true"><span style={{width:`${d.orders/peak*100}%`}}/></span><strong>{d.orders}</strong></li>)}</ol></section>
    <section><h3>Delivery issue decisions</h3><dl>{[['Issues approved',requests.issue.approved],['Issues declined',requests.issue.rejected]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="hint">Approval means follow-up, not a refund or pickup.</p></section>
   </div>
   <section><h3>Recent website orders</h3>{data.recentOrders.length?<ul className="admin-dashboard-recent">{data.recentOrders.map(o=><li key={o.id}><strong>{o.id}</strong><span>{o.status} · {cash(o.total)}</span></li>)}</ul>:<p>No website orders yet.</p>}<button className="small-outline" onClick={()=>onOpenOrders()}>Open Orders &amp; Returns ↗</button></section>
   </section>}
   <section aria-labelledby="dashboard-central-stock"><h3 id="dashboard-central-stock">Central warehouse inventory</h3>
    <p className="hint">Current stock shared by the customer website and Store POS.</p>
    <div className="metric-row">{[['On hand',data.onHand],['Reserved',data.reserved],['Available',data.available],['Products',data.products],['Variants',data.variants],['Product approvals pending',data.pendingApprovals],['Stock movements',data.stockEvents],['Audit events',data.auditEvents]].map(([label,value])=><div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
   </section>
  </div>
 </section>;
}
