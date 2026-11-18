'use client';
import AdminProductEditor,{AdminProductList,createProductDraft} from '../../components/AdminProductEditor';
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
const managementTabs=[
 ['admin-dashboard','Dashboard'],['admin-orders','Orders & returns'],
 ['admin-customers','Customer search'],['admin-customer-extract','Data extract'],['admin-products','Products'],['admin-shipping','Shipping'],['website-controls','Website & offers'],['admin-inventory','Inventory']
];
const governanceTabs=[['admin-pos-promotions','Store POS promotions'],['admin-pos-terms','Store POS Terms & Conditions'],['admin-categories','Categories'],['admin-approvals','Approvals'],['admin-staff','Staff & roles']];

export default function Admin(){
 const [requestedSection,openSection]=useStaffSection('admin-dashboard');
 const [token,setToken]=useState('');
 const [role,setRole]=useState('admin');
 const [pin,setPin]=useState('');
 const [userId,setUserId]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [catalog,setCatalog]=useState({products:[],drafts:{},approvals:[]});
 const [summary,setSummary]=useState(null);
 const [editor,setEditor]=useState(null);
 const [preview,setPreview]=useState(null);
 const [access,setAccess]=useState(null);
 const [inventory,setInventory]=useState(null);
 const [userForm,setUserForm]=useState({id:'',name:'',role:'admin',active:true,locationId:'store-hyd-01'});
 const [roleName,setRoleName]=useState('');
 const [permissions,setPermissions]=useState([]);
 const [receipt,setReceipt]=useState({sku:'',locationId:'warehouse-hyd',qty:1,reason:'Fictional opening stock'});
 const [transfer,setTransfer]=useState({sku:'',from:'warehouse-hyd',to:'store-hyd-01',qty:1});
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

 const refresh=async(activeToken=token)=>{
  const options={token:activeToken};
  const [catalogData,summaryData,inventoryData]=await Promise.all([
   api('/api/admin/catalog',options),
   api('/api/admin/summary',options),
   api('/api/admin/inventory',options),
  ]);
  setCatalog(catalogData);
  setSummary(summaryData);
  setInventory(inventoryData);
  const {role:currentRole}=await api('/api/me',options);
  setRole(currentRole);
  setAccess(currentRole==='superadmin'?await api('/api/admin/access',options):null);
 };
 useEffect(()=>{const t=sessionStorage.getItem('trd_admin_token');if(t){
  setToken(t);
  run(async()=>{
   try{await refresh(t);}
   catch(error){
    if(error.status!==401)throw error;
    sessionStorage.removeItem('trd_admin_token');
    setToken('');
    if(new URLSearchParams(window.location.search).get('role')==='superadmin')setRole('superadmin');
    setError('Your session expired. Sign in again to load the dashboard.');
   }
  });
 }else if(new URLSearchParams(window.location.search).get('role')==='superadmin')setRole('superadmin');},[]);
 const post=(path,body)=>api(path,{token,method:'POST',body:JSON.stringify(body)});
 const login=()=>run(async()=>{const r=await api('/api/auth/staff',{method:'POST',body:JSON.stringify({role,pin,userId:userId||role})});sessionStorage.setItem('trd_admin_token',r.token);setToken(r.token);await refresh(r.token);});
 const switchRole=next=>{setFeedbackAt('');sessionStorage.removeItem('trd_admin_token');setToken('');setFilteredSummary(null);setRole(next);setUserId('');setPin('');setAccess(null);setSummary(null);setCatalog({products:[],drafts:{},approvals:[]});setInventory(null);closeEditor();setError('');setNotice('');};
 const edit=p=>{const d=catalog.drafts[p.id];setEditor(d&&d.status!=='published'?{...structuredClone(d.product),revision:d.revision}:d?{...structuredClone(p),revision:d.revision}:structuredClone(p));setPreview(null);};
 const tabs=access?[...managementTabs,...governanceTabs]:managementTabs;
 const orderFilter=requestedSection.startsWith('admin-orders-')?requestedSection.slice('admin-orders-'.length):'all';
 const isOrderList=Object.hasOwn(orderListLabels,orderFilter)&&requestedSection.startsWith('admin-orders-');
 const section=isOrderList?'admin-orders':tabs.some(([id])=>id===requestedSection)?requestedSection:'admin-dashboard';
 const openOrders=(filter='all')=>openSection(filter==='all'?'admin-orders':'admin-orders-'+filter);
 if(!token)return <main className="container staff-login-page operations-login operations-admin"><div className="staff-login-card"><div className="eyebrow">MILESTONE 02 · MOCK ONLY</div><h1>Management access</h1><p>Choose Admin for daily operations or Super Admin for approvals, staff access and stock adjustments.</p><label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="admin">Admin</option><option value="superadmin">Super Admin</option></select></label><label>User ID (optional for default demo accounts)<input value={userId} placeholder="e.g. warehouse-hyd" onChange={e=>setUserId(e.target.value)}/></label><label>Demo PIN<input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="1234"/></label><button className="button button-dark" onClick={login}>SIGN IN</button>{error&&<p role="alert" className="error-box">{error}</p>}</div></main>;
 return <main className="staff-shell m02-management operations-workspace operations-admin"><div className="staff-page-header"><div><div className="eyebrow">SIGNED IN AS {role==='superadmin'?'SUPER ADMIN':'ADMIN'} · DEVELOPMENT</div><h1>{role==='superadmin'?'Super Admin':'Admin'} <em>portal.</em></h1><p>Manage orders, products, inventory and the storefront.</p></div><div className="button-row"><button onClick={()=>{setFeedbackAt('');run(()=>refresh());}}>Refresh</button><button disabled={!!saving||!!productBusy} onClick={()=>switchRole(role==='superadmin'?'admin':'superadmin')}>Switch to {role==='superadmin'?'Admin':'Super Admin'}</button><button disabled={!!saving||!!productBusy} onClick={()=>switchRole('admin')}>Sign out</button></div></div>
 {!feedbackAt&&<ActionFeedback error={error} success={notice}/>}
 <StaffTabs label="Management sections" tabs={tabs} active={section} onChange={openSection}/>
 <div className="operations-pane" hidden={section!=='admin-dashboard'}><label>Dashboard period<select value={period} onChange={event=>setPeriod(event.target.value)}>
   {Object.entries({today:'Today',week:'This week',month:'This month',year:'This year',fiveYears:'Past 5 years'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}
  </select></label>{filteredSummary?.period===period?<AdminDashboard data={filteredSummary.data} onOpenOrders={openOrders}/>:<p role="status">Loading dashboard…</p>}</div>
 {section==='admin-customer-extract'&&<CustomerExtract key={token} token={token}/>}
 {section==='admin-customers'&&<PosHistory key={token} token={token} showChannels/>}
 {access&&section==='admin-pos-terms'&&<PosTerms key={token} token={token}/>}
 {access&&section==='admin-pos-promotions'&&<PosPromotions token={token}/>}
 <div className="operations-pane" hidden={section!=='admin-orders'}><AdminOrders key={token+orderFilter} token={token} filter={isOrderList?orderFilter:'all'} onFilter={openOrders} onReviewed={()=>api('/api/admin/summary',{token}).then(S).catch(()=>{})}/></div>
 <div className="operations-pane" hidden={section!=='admin-shipping'}><ShippingRates token={token}/></div>
 <div className="operations-pane" hidden={section!=='website-controls'}><WebsiteAdmin token={token} products={catalog.products} onOpenProducts={()=>openSection('admin-products')}/></div>
 <div className="operations-pane" hidden={section!=='admin-products'}>
  <AdminProductList catalog={catalog} hidden={!!editor} onCreate={()=>{setEditor(createProductDraft());setPreview(null);}} onEdit={edit}/>
  {editor&&<AdminProductEditor catalog={catalog} editor={editor} onChange={D} preview={preview} onPreview={V}
   post={post} onSaved={()=>run(()=>refresh())} onClose={closeEditor}
   productBusy={productBusy} setProductBusy={setProductBusy} saving={!!saving}/>}
 </div>
 {access&&<section className="staff-panel operations-pane" id="admin-categories" hidden={section!=='admin-categories'}>
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
 {access&&<><section className="staff-panel operations-pane" hidden={section!=='admin-approvals'} id="admin-approvals"><h2>Approval queue</h2>{Object.values(catalog.drafts).filter(d=>d.status==='pending').map(d=><div className="m02-row" key={d.product.id}><span>{d.product.name} · revision {d.revision} · submitted by {d.submittedBy}</span><button onClick={()=>{setEditor({...structuredClone(d.product),revision:d.revision});setPreview(structuredClone(d.product));openSection('admin-products');}}>Inspect</button>{['publish','reject'].map(action=><div key={action}><button disabled={!!saving} onClick={()=>runSave('approval:'+d.product.id+':'+action,action==='publish'?'Publishing product…':'Rejecting submission…',async()=>{await post(`/api/admin/products/${d.product.id}/decide`,{revision:d.revision,action});await refresh();setNotice(action==='publish'?'Product published.':'Submission rejected and returned to drafts.');})}>{action}</button>{feedback('approval:'+d.product.id+':'+action)}</div>)}</div>)}{notice&&feedbackAt.startsWith('approval:')&&<ActionFeedback success={notice}/>}<h3>Decision history</h3>{catalog.approvals.slice(-10).reverse().map((a,i)=><p key={i}>{a.id} · revision {a.revision} · {a.action} by {a.actor}</p>)}</section>
 <section className="staff-panel operations-pane" hidden={section!=='admin-staff'} id="admin-staff"><h2>Staff access · demo PIN 1234</h2>{access.users.map(u=><div className="m02-row" key={u.id}><span>{u.name} ({u.id}) · {u.role} · {u.active?'Active':'Disabled'}</span><button onClick={()=>setUserForm({...u})}>Edit</button></div>)}<div className="m02-grid">{['id','name'].map(k=><label key={k}>{k}<input placeholder={k==='id'?'e.g. warehouse-hyd':'e.g. Warehouse operator'} value={userForm[k]} onChange={e=>setUserForm({...userForm,[k]:e.target.value})}/></label>)}<label>Role<select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}>{Object.keys(access.roles).map(r=><option key={r}>{r}</option>)}</select></label><label>Location<select value={userForm.locationId} onChange={e=>setUserForm({...userForm,locationId:e.target.value})}>{inventory?.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label><input type="checkbox" checked={userForm.active} onChange={e=>setUserForm({...userForm,active:e.target.checked})}/>Active</label></div><button disabled={!!saving} onClick={()=>runSave('user','Saving staff user…',async()=>{await post('/api/admin/users',userForm);await refresh();setNotice('Staff access saved.');})}>Save user</button>{feedback('user')}
 <h3>Roles & permissions</h3><label>Role name<input value={roleName} placeholder="e.g. warehouse-assistant" onChange={e=>setRoleName(e.target.value)}/></label><select aria-label="Load role" value="" onChange={e=>{setRoleName(e.target.value);setPermissions(access.roles[e.target.value]);}}><option value="">Load existing role</option>{Object.keys(access.roles).filter(r=>r!=='superadmin').map(r=><option key={r}>{r}</option>)}</select>{['catalog.edit','catalog.submit','inventory.read','pos.sell','warehouse.fulfill','website.manage','offers.manage','rewards.manage'].map(p=><label key={p}><input type="checkbox" checked={permissions.includes(p)} onChange={e=>setPermissions(e.target.checked?[...permissions,p]:permissions.filter(x=>x!==p))}/>{p}</label>)}<button disabled={!!saving} onClick={()=>runSave('role','Saving role…',async()=>{await post('/api/admin/roles',{name:roleName,permissions});await refresh();setNotice('Role permissions saved.');})}>Save role</button>{feedback('role')}<p>Super Admin permissions are fixed. Staff changes take effect on the next API request.</p></section></>}
 <section className="staff-panel operations-pane" hidden={section!=='admin-inventory'} id="admin-inventory"><h2>Shared inventory</h2><p>Website and Store POS sales use the Hyderabad Warehouse balance. Other locations show their recorded physical stock.</p><div className="m02-scroll"><table><thead><tr><th>SKU</th>{inventory?.locations.map(l=><th key={l.id}>{l.name}</th>)}</tr></thead><tbody>{Object.entries(inventory?.stock||{}).map(([sku,balances])=><tr key={sku}><td>{sku}</td>{inventory.locations.map(l=><td key={l.id}>{balances[l.id]||0}</td>)}</tr>)}</tbody></table></div>{access&&<><h3>Receive fictional stock</h3><div className="m02-grid"><label>SKU<select value={receipt.sku} onChange={e=>setReceipt({...receipt,sku:e.target.value})}><option value="">Choose variant</option>{Object.keys(inventory?.stock||{}).map(s=><option key={s}>{s}</option>)}</select></label><label>Location<select value={receipt.locationId} onChange={e=>setReceipt({...receipt,locationId:e.target.value})}>{inventory?.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>Quantity<input type="number" min="1" value={receipt.qty} placeholder="e.g. 12" onChange={e=>setReceipt({...receipt,qty:Number(e.target.value)})}/></label><label>Reason<input value={receipt.reason} placeholder="e.g. Supplier delivery received" onChange={e=>setReceipt({...receipt,reason:e.target.value})}/></label></div><button disabled={!!saving} onClick={()=>runSave('receive','Receiving stock…',async()=>{await post('/api/admin/inventory/receive',{...receipt,key:uniqueKey()});await refresh();setNotice('Mock stock received.');})}>Receive mock stock</button>{feedback('receive')}<h3>Transfer unreserved stock</h3><div className="m02-grid"><label>SKU<select value={transfer.sku} onChange={e=>setTransfer({...transfer,sku:e.target.value})}><option value="">Choose variant</option>{Object.keys(inventory?.stock||{}).map(s=><option key={s}>{s}</option>)}</select></label>{['from','to'].map(k=><label key={k}>{k}<select value={transfer[k]} onChange={e=>setTransfer({...transfer,[k]:e.target.value})}>{inventory?.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>)}<label>Quantity<input type="number" min="1" value={transfer.qty} placeholder="e.g. 3" onChange={e=>setTransfer({...transfer,qty:Number(e.target.value)})}/></label></div><button disabled={!!saving} onClick={()=>runSave('transfer','Transferring stock…',async()=>{await post('/api/admin/inventory/transfer',{...transfer,key:uniqueKey()});localStorage.setItem('trd_stock_transferred',String(Date.now()));await refresh();setNotice('Stock transferred.');})}>Transfer</button>{feedback('transfer')}</>}<h3>Recent stock movements</h3>{inventory?.ledger.slice(-10).reverse().map(l=><p key={l.id}>{l.sku} · {l.locationId} · {l.delta} · {l.reason}</p>)}</section></main>;
}
