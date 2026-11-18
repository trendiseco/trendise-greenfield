'use client';
import AdminProductEditor,{AdminProductList,createProductDraft} from '../../components/AdminProductEditor';
import {useStaff} from '../../components/StaffPortal';
import StaffAccessEditor from '../../components/StaffAccessEditor';
import ActionFeedback from '../../components/ActionFeedback';
import {useEffect,useRef,useState} from 'react';
import {api,uniqueKey} from '../../lib/api';
import AdminDashboard from '../../components/AdminDashboard';
import ShippingRates from '../../components/ShippingRates';
import CustomerExtract from '../../components/CustomerExtract';
import PosHistory from '../../components/PosHistory';
import PosTerms from '../../components/PosTerms';
import PosPromotions from '../../components/PosPromotions';
import AdminOrders from '../../components/AdminOrders';
import WebsiteAdmin from '../../components/WebsiteAdmin';
import {orderListLabels} from '../../../../../shared/admin-orders.mjs';
import {StaffTabs,useStaffSection} from '../../components/StaffWorkspace';
const sections=[
 ['admin-dashboard','Dashboard',['reports.read']],
 ['admin-orders','Orders & exchanges',['orders.read']],
 ['admin-customers','Customer search',['customers.read']],
 ['admin-customer-extract','Data extract',['customers.export']],
 ['admin-products','Products',['catalog.read']],
 ['admin-shipping','Shipping',['shipping.rates','shipping.export']],
 ['website-controls','Website & offers',['website.read','offers.read','offers.pricing.read','rewards.read']],
 ['admin-inventory','Inventory',['inventory.read']],
 ['admin-pos-promotions','Store POS promotions',['pos.pricing.read']],
 ['admin-pos-terms','Store POS Terms & Conditions',['pos.terms']],
 ['admin-categories','Categories',['categories.manage']],
 ['admin-approvals','Approvals',['approvals.decide']],
 ['admin-staff','Staff & roles',['users.manage']],
];

export default function AdminWorkspace({defaultSection='admin-dashboard'}) {
 const {token,profile,logout}=useStaff();
 const {role,permissions:grants}=profile;
 const can=permission=>grants.includes(permission);
 const [requestedSection,openSection]=useStaffSection(defaultSection);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [catalog,setCatalog]=useState({products:[],drafts:{},approvals:[]});
 const [summary,setSummary]=useState(null);
 const [editor,setEditor]=useState(null);
 const [preview,setPreview]=useState(null);
 const [access,setAccess]=useState(null);
 const [inventory,setInventory]=useState(null);
 const [receipt,setReceipt]=useState({sku:'',qty:1,reason:'Fictional opening stock'});
 const [period,setPeriod]=useState('today'),[filteredSummary,setFilteredSummary]=useState(null);
 useEffect(()=>{
  if(!token||!summary)return;
  const controller=new AbortController();
  api('/api/admin/summary?period='+period,{token,signal:controller.signal})
   .then(data=>{if(!controller.signal.aborted)setFilteredSummary({period,data});})
   .catch(error=>{if(!controller.signal.aborted)setError(error.message);});
  return ()=>controller.abort();
 },[token,period,summary]);
 const [categoryName,setCategoryName]=useState('');
 const [productBusy,setProductBusy]=useState('');
 const [saving,setSaving]=useState('');
 const saveInProgress=useRef(false);
 const [feedbackAt,setFeedbackAt]=useState('');
 const feedback=key=>feedbackAt===key&&<ActionFeedback error={error} success={notice} pending={saving}/>;
 const closeEditor=()=>{setEditor(null);setPreview(null);};

 const run=async(fn)=>{setError('');setNotice('');try{await fn();}catch(e){setError(e.message);}};
 const runSave=async(key,message,fn)=>{
  if(saveInProgress.current)return;
  saveInProgress.current=true;
  setFeedbackAt(key);
  setSaving(message);
  try{await run(fn);}
  finally{saveInProgress.current=false;setSaving('');}
 };

 const refresh=async()=>{
  const options={token};
  await Promise.all([
   can('catalog.read')?api('/api/admin/catalog',options).then(setCatalog):
    can('website.read')&&api('/api/products',options).then(data=>setCatalog(previous=>({...previous,products:data.products}))),
   can('reports.read')&&api('/api/admin/summary',options).then(setSummary),
   can('inventory.read')&&api('/api/admin/inventory',options).then(setInventory),
   can('users.manage')&&api('/api/admin/access',options).then(setAccess),
  ]);
 };
 useEffect(()=>{run(refresh);},[token,grants.join(',')]);
 const post=(path,body)=>api(path,{token,method:'POST',body:JSON.stringify(body)});
 const saveAccess=(key,pending,path,body,success,onDone)=>runSave(key,pending,async()=>{
  await post(path,body);
  onDone?.();
  await refresh();
  setNotice(success);
 });
 const edit=p=>{const d=catalog.drafts[p.id];setEditor(d&&d.status!=='published'?{...structuredClone(d.product),revision:d.revision}:d?{...structuredClone(p),revision:d.revision}:structuredClone(p));setPreview(null);};
 const tabs=sections.filter(([, , keys])=>keys.some(can));
 const orderFilter=requestedSection.startsWith('admin-orders-')?requestedSection.slice('admin-orders-'.length):'all';
 const isOrderList=Object.hasOwn(orderListLabels,orderFilter)&&requestedSection.startsWith('admin-orders-')&&can('orders.read');
 const section=isOrderList?'admin-orders':tabs.some(([id])=>id===requestedSection)?requestedSection:tabs[0]?.[0];
 const openOrders=(filter='all')=>openSection(filter==='all'?'admin-orders':'admin-orders-'+filter);
 return <main className="staff-shell m02-management operations-workspace operations-admin">
 <div className="staff-page-header"><div><div className="eyebrow">SIGNED IN AS {profile.userId} · {role}</div>
 <h1>{defaultSection==='admin-staff'?'Super Admin':'Admin'} <em>portal.</em></h1></div>
 <div className="button-row"><button onClick={()=>{setFeedbackAt('');run(refresh);}}>Refresh</button>
 <button disabled={!!saving||!!productBusy} onClick={logout}>Sign out</button></div></div>
 {!feedbackAt&&<ActionFeedback error={error} success={notice}/>}
 <StaffTabs label="Management sections" tabs={tabs} active={section} onChange={openSection}/>
 <div className="operations-pane" hidden={section!=='admin-dashboard'}><label>Dashboard period<select value={period} onChange={event=>setPeriod(event.target.value)}>
   {Object.entries({today:'Today',week:'This week',month:'This month',year:'This year',fiveYears:'Past 5 years'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}
  </select></label>{filteredSummary?.period===period?<AdminDashboard data={filteredSummary.data} onOpenOrders={openOrders}/>:<p role="status">Loading dashboard…</p>}</div>
 {section==='admin-customer-extract'&&<CustomerExtract key={token} token={token}/>}
 {section==='admin-customers'&&<PosHistory key={token} token={token} showChannels/>}
 {section==='admin-pos-terms'&&<PosTerms key={token} token={token}/>}
 {section==='admin-pos-promotions'&&<PosPromotions token={token} canImport={can('pos.prices')} canPromote={can('pos.promotions')}/>}
 {can('orders.read')&&<div className="operations-pane" hidden={section!=='admin-orders'}><AdminOrders key={token+orderFilter} token={token} filter={isOrderList?orderFilter:'all'} onFilter={openOrders} canReview={can('orders.review')} onReviewed={()=>{if(can('reports.read'))api('/api/admin/summary',{token}).then(setSummary).catch(()=>{});}}/></div>}
 <div className="operations-pane" hidden={section!=='admin-shipping'}><ShippingRates token={token} canQuote={can('shipping.rates')} canExport={can('shipping.export')}/></div>
 {section==='website-controls'&&<div className="operations-pane"><WebsiteAdmin token={token} grants={grants} products={catalog.products} onOpenProducts={()=>openSection('admin-products')}/></div>}
 <div className="operations-pane" hidden={section!=='admin-products'}>
  <AdminProductList catalog={catalog} hidden={!!editor} onCreate={()=>{setEditor(createProductDraft());setPreview(null);}} onEdit={edit} canCreate={can('catalog.edit')}/>
  {editor&&<AdminProductEditor catalog={catalog} editor={editor} onChange={setEditor} preview={preview} onPreview={setPreview}
   post={post} onSaved={()=>run(()=>refresh())} onClose={closeEditor}
   productBusy={productBusy} setProductBusy={setProductBusy} saving={!!saving} canEdit={can('catalog.edit')} canSubmit={can('catalog.submit')}/>}
 </div>
 {can('categories.manage')&&<section className="staff-panel operations-pane" id="admin-categories" hidden={section!=='admin-categories'}>
  <h2>Product categories</h2>
  <form className="m02-grid" onSubmit={event=>{
   event.preventDefault();
   runSave('category-add','Adding category…',async()=>{
    const {categories}=await post('/api/admin/categories',{name:categoryName});
    setCatalog(previous=>({...previous,categories}));
    localStorage.setItem('trd_categories_updated',String(Date.now()));
    setCategoryName('');
    setNotice('Category added.');
   });
  }}>
   <label>Category name<input required maxLength={80} placeholder="e.g. Jackets" value={categoryName} onChange={event=>setCategoryName(event.target.value)}/></label>
   <button type="submit" disabled={!!saving||!categoryName.trim()}>Add category</button>{feedback('category-add')}
  </form>
  <p>Hide a category to take its products off both the website and Store POS. Move any assigned products or drafts before removing it.</p>
  <ul>{catalog.categories?.map(name=>{
   const hidden=catalog.hiddenCategories?.includes(name);
   const assigned=catalog.products.some(product=>product.category===name)||Object.values(catalog.drafts).some(draft=>draft.product.category===name);
   const update=action=>runSave(name+':'+action,'Updating category…',async()=>{
    const result=await post('/api/admin/categories/update',{name,action});
    setCatalog(previous=>({...previous,...result}));
    localStorage.setItem('trd_categories_updated',String(Date.now()));
    setNotice('Category updated.');
   });
   return <li key={name} className="m02-row"><span>{name} · {hidden?'Hidden':'Visible'}</span>
    <div><button disabled={!!saving} onClick={()=>update(hidden?'show':'hide')}>{hidden?'Show':'Hide'}</button>{feedback(name+':hide')}{feedback(name+':show')}</div>
    <div><button disabled={!!saving||assigned} onClick={()=>update('remove')}>Remove</button>{feedback(name+':remove')}</div>
   </li>;
  })}</ul>{notice&&feedbackAt.endsWith(':remove')&&<ActionFeedback success={notice}/>}
 </section>}
 {can('approvals.decide')&&<section className="staff-panel operations-pane" hidden={section!=='admin-approvals'} id="admin-approvals"><h2>Approval queue</h2>{Object.values(catalog.drafts).filter(d=>d.status==='pending').map(d=><div className="m02-row" key={d.product.id}><span>{d.product.name} · revision {d.revision} · submitted by {d.submittedBy}</span><button onClick={()=>{setEditor({...structuredClone(d.product),revision:d.revision});setPreview(structuredClone(d.product));openSection('admin-products');}}>Inspect</button>{['publish','reject'].map(action=><div key={action}><button disabled={!!saving} onClick={()=>runSave('approval:'+d.product.id+':'+action,action==='publish'?'Publishing product…':'Rejecting submission…',async()=>{await post(`/api/admin/products/${d.product.id}/decide`,{revision:d.revision,action});await refresh();setNotice(action==='publish'?'Product published.':'Submission rejected and returned to drafts.');})}>{action}</button>{feedback('approval:'+d.product.id+':'+action)}</div>)}</div>)}{notice&&feedbackAt.startsWith('approval:')&&<ActionFeedback success={notice}/>}<h3>Decision history</h3>{catalog.approvals.slice(-10).reverse().map((a,i)=><p key={i}>{a.id} · revision {a.revision} · {a.action} by {a.actor}</p>)}</section>}
 {section==='admin-staff'&&access&&<StaffAccessEditor access={access} token={token} save={saveAccess} feedback={feedback} busy={!!saving}/>}
 <section className="staff-panel operations-pane" hidden={section!=='admin-inventory'} id="admin-inventory">
  <h2>Central warehouse inventory</h2>
  <p>Customer website and Store POS sales draw from this shared stock.</p>
  {inventory&&<div className="m02-scroll"><table>
   <thead><tr><th>SKU</th><th>On hand</th><th>Reserved</th><th>Available</th></tr></thead>
   <tbody>{Object.entries(inventory.stock).map(([sku,balance])=><tr key={sku}><td>{sku}</td><td>{balance.onHand}</td><td>{balance.reserved}</td><td>{balance.available}</td></tr>)}</tbody>
  </table></div>}
  {can('inventory.receive')&&<>
   <h3>Receive mock stock</h3>
   <div className="m02-grid">
    <label>SKU<select value={receipt.sku} onChange={e=>setReceipt({...receipt,sku:e.target.value})}><option value="">Choose variant</option>{Object.keys(inventory?.stock||{}).map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Quantity<input type="number" min="1" value={receipt.qty} placeholder="e.g. 12" onChange={e=>setReceipt({...receipt,qty:Number(e.target.value)})}/></label>
    <label>Reason<input value={receipt.reason} placeholder="e.g. Supplier delivery received" onChange={e=>setReceipt({...receipt,reason:e.target.value})}/></label>
   </div>
   <button disabled={!!saving||!receipt.sku} onClick={()=>runSave('receive','Receiving stock…',async()=>{
    await post('/api/admin/inventory/receive',{...receipt,key:uniqueKey()});
    localStorage.setItem('trd_stock_updated',String(Date.now()));
    await refresh();
    setNotice('Mock stock received into the central warehouse.');
   })}>Receive mock stock</button>{feedback('receive')}
  </>}
  <h3>Recent stock movements</h3>
  {inventory?.ledger.slice(-10).reverse().map(l=><p key={l.id}>{l.sku} · {l.delta} · {l.reason}</p>)}
 </section></main>;
}
