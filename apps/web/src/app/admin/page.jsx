'use client';
import {useEffect,useRef,useState} from 'react';
import {api,cash,uniqueKey} from '../../lib/api';
import LocalStylePreview from '../../components/LocalStylePreview';
import SizeChartEditor from '../../components/SizeChartEditor';
import SizeChart from '../../components/SizeChart';
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
import ProductVisual from '../../components/ProductVisual';
const productExamples={name:'Oxford Formal Shirt',description:'A cotton shirt with a button-down collar.',fabric:'100% cotton',fit:'Regular fit',care:'Machine wash cold. Line dry.',label:'New arrival',swatch:'#acc3d0'};
const variantExamples={sku:'SH-OXF-SKY-M',barcode:'0012345678905',color:'Sky Blue',size:'M',price:'1499',posPrice:'1399'};
const fresh=()=>({name:'',category:'',description:'',fabric:'',fit:'',images:[],variants:[{sku:'',barcode:'',color:'',size:'',price:1499}]});
const managementTabs=[
 ['admin-dashboard','Dashboard'],['admin-orders','Orders & returns'],
 ['admin-customers','Customer search'],['admin-customer-extract','Data extract'],['admin-products','Products'],['admin-shipping','Shipping'],['website-controls','Website & offers'],['admin-inventory','Inventory']
];
const governanceTabs=[['admin-pos-promotions','Store POS promotions'],['admin-pos-terms','Store POS Terms & Conditions'],['admin-categories','Categories'],['admin-approvals','Approvals'],['admin-staff','Staff & roles']];

export default function Admin(){
 const [requestedSection,openSection]=useStaffSection('admin-dashboard');
 const [token,T]=useState(''),[role,R]=useState('admin'),[pin,P]=useState(''),[userId,U]=useState(''),[error,E]=useState(''),[notice,N]=useState(''),[catalog,C]=useState({products:[],drafts:{},approvals:[]}),[summary,S]=useState(null),[editor,D]=useState(null),[preview,V]=useState(null),[access,A]=useState(null),[inventory,I]=useState(null),[userForm,F]=useState({id:'',name:'',role:'admin',active:true,locationId:'store-hyd-01'}),[roleName,RN]=useState(''),[permissions,PS]=useState([]),[receipt,RC]=useState({sku:'',locationId:'warehouse-hyd',qty:1,reason:'Fictional opening stock'}),[transfer,ST]=useState({sku:'',from:'warehouse-hyd',to:'store-hyd-01',qty:1});
 const [period,setPeriod]=useState('today'),[filteredSummary,setFilteredSummary]=useState(null);
 useEffect(()=>{
  if(!token||!summary)return;
  const controller=new AbortController();
  api('/api/admin/summary?period='+period,{token,signal:controller.signal})
   .then(data=>{if(!controller.signal.aborted)setFilteredSummary({period,data});})
   .catch(error=>{if(!controller.signal.aborted)E(error.message);});
  return ()=>controller.abort();
 },[token,period,summary]);
 const [categoryName,setCategoryName]=useState('');
 const [productFeedback,setProductFeedback]=useState(null);
 const [productBusy,setProductBusy]=useState(false);
 const productAlert=useRef(null);
 useEffect(()=>{
  if(productFeedback?.error)productAlert.current?.focus();
 },[productFeedback]);
 const runProduct=async(action,fn)=>{
  setProductFeedback(null);
  setProductBusy(true);
  try{await fn();}
  catch(error){setProductFeedback({error:true,message:action+': '+error.message});}
  finally{setProductBusy(false);}
 };
 const closeEditor=()=>{D(null);V(null);setProductFeedback(null);};

 const run=async(fn)=>{E('');N('');try{await fn();}catch(e){E(e.message);}};
 const refresh=async(t=token)=>{const [c,s,i]=await Promise.all([api('/api/admin/catalog',{token:t}),api('/api/admin/summary',{token:t}),api('/api/admin/inventory',{token:t})]);C(c);S(s);I(i);const me=await api('/api/me',{token:t});R(me.role);if(me.role==='superadmin')A(await api('/api/admin/access',{token:t}));else A(null);};
 useEffect(()=>{const t=sessionStorage.getItem('trd_admin_token');if(t){
  T(t);
  run(async()=>{
   try{await refresh(t);}
   catch(error){
    if(error.status!==401)throw error;
    sessionStorage.removeItem('trd_admin_token');
    T('');
    if(new URLSearchParams(window.location.search).get('role')==='superadmin')R('superadmin');
    E('Your session expired. Sign in again to load the dashboard.');
   }
  });
 }else if(new URLSearchParams(window.location.search).get('role')==='superadmin')R('superadmin');},[]);
 const post=(path,body)=>api(path,{token,method:'POST',body:JSON.stringify(body)});
 const login=()=>run(async()=>{const r=await api('/api/auth/staff',{method:'POST',body:JSON.stringify({role,pin,userId:userId||role})});sessionStorage.setItem('trd_admin_token',r.token);T(r.token);await refresh(r.token);});
 const switchRole=next=>{sessionStorage.removeItem('trd_admin_token');T('');setFilteredSummary(null);R(next);U('');P('');A(null);S(null);C({products:[],drafts:{},approvals:[]});I(null);closeEditor();E('');N('');};
 const field=(name)=> <label key={name}>{name==='swatch'?'Swatch (optional)':name.toUpperCase()}<input required={name!=='swatch'} placeholder={productExamples[name]?'e.g. '+productExamples[name]:undefined} value={editor[name]||''} onChange={e=>D({...editor,[name]:e.target.value})}/></label>;
 const edit=p=>{setProductFeedback(null);const d=catalog.drafts[p.id];D(d&&d.status!=='published'?{...structuredClone(d.product),revision:d.revision}:d?{...structuredClone(p),revision:d.revision}:structuredClone(p));V(null);};
 const setImageKind=async(i,kind)=>{const im=editor.images[i];if(kind==='tryon'){if(!im.color||!/^data:image\/(png|webp);/.test(im.src))throw new Error('Select a variant color and use a transparent PNG or WebP cutout.');const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Unable to open cutout'));image.src=im.src;});const c=document.createElement('canvas');c.width=80;c.height=80;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,80,80);const pixels=ctx.getImageData(0,0,80,80).data;let transparent=0;for(let n=3;n<pixels.length;n+=4)if(pixels[n]<240)transparent++;if(transparent<64||transparent>6336)throw new Error('Cutout must contain a visible garment with a transparent background. Remove the background before uploading.');}D({...editor,images:editor.images.map((x,n)=>n===i?{...x,kind}:x)});};
 const upload=async file=>{if(!file)return;if(file.size>500000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose PNG, JPEG or WebP up to 500 KB');if(editor.images?.length>=20)throw new Error('Maximum twenty images');const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});D({...editor,images:[...(editor.images||[]),{src,alt:editor.name||'Product photograph',color:editor.variants[0]?.color||'',label:'Product photo'}]});};
 const tabs=access?[...managementTabs,...governanceTabs]:managementTabs;
 const orderFilter=requestedSection.startsWith('admin-orders-')?requestedSection.slice('admin-orders-'.length):'all';
 const isOrderList=Object.hasOwn(orderListLabels,orderFilter)&&requestedSection.startsWith('admin-orders-');
 const section=isOrderList?'admin-orders':tabs.some(([id])=>id===requestedSection)?requestedSection:'admin-dashboard';
 const openOrders=(filter='all')=>openSection(filter==='all'?'admin-orders':'admin-orders-'+filter);
 if(!token)return <main className="container staff-login-page operations-login operations-admin"><div className="staff-login-card"><div className="eyebrow">MILESTONE 02 · MOCK ONLY</div><h1>Management access</h1><p>Choose Admin for daily operations or Super Admin for approvals, staff access and stock adjustments.</p><label>Role<select value={role} onChange={e=>R(e.target.value)}><option value="admin">Admin</option><option value="superadmin">Super Admin</option></select></label><label>User ID (optional for default demo accounts)<input value={userId} placeholder="e.g. warehouse-hyd" onChange={e=>U(e.target.value)}/></label><label>Demo PIN<input type="password" value={pin} onChange={e=>P(e.target.value)} placeholder="1234"/></label><button className="button button-dark" onClick={login}>SIGN IN</button>{error&&<p role="alert" className="error-box">{error}</p>}</div></main>;
 return <main className="staff-shell m02-management operations-workspace operations-admin"><div className="staff-page-header"><div><div className="eyebrow">SIGNED IN AS {role==='superadmin'?'SUPER ADMIN':'ADMIN'} · DEVELOPMENT</div><h1>{role==='superadmin'?'Super Admin':'Admin'} <em>portal.</em></h1><p>Manage orders, products, inventory and the storefront.</p></div><div className="button-row"><button onClick={()=>run(()=>refresh())}>Refresh</button><button onClick={()=>switchRole(role==='superadmin'?'admin':'superadmin')}>Switch to {role==='superadmin'?'Admin':'Super Admin'}</button><button onClick={()=>switchRole('admin')}>Sign out</button></div></div>
 {error&&<div className="modal-overlay"><div className="modal-card" role="alertdialog" aria-modal="true" aria-label="Validation error"><h2>Unable to complete</h2><p>{error}</p><button autoFocus onClick={()=>E('')}>Close</button></div></div>}{notice&&<p role="status">{notice}</p>}

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
 <section className="staff-panel" id="admin-products" hidden={!!editor}><div className="panel-heading"><h2>Products</h2><button onClick={()=>{D(fresh());V(null);setProductFeedback(null);}}>Create product</button></div>{[...catalog.products,...Object.values(catalog.drafts).filter(d=>!catalog.products.some(p=>p.id===d.product.id)).map(d=>d.product)].map(p=><div className="m02-row" key={p.id}><strong>{p.name}<small style={{display:'block',fontWeight:400}}>Product ID: {p.id}</small></strong><span>{catalog.drafts[p.id]?.status||'published'} · {p.variants.length} variants</span><button onClick={()=>edit(p)}>Edit / preview</button></div>)}</section>
 {editor&&<section className="staff-panel"><div className="panel-heading"><h2>Product editor</h2><button disabled={productBusy} onClick={closeEditor}>Back to products</button></div>{productFeedback&&(productFeedback.error?<p ref={productAlert} tabIndex={-1} role="alert" className="error-box">{productFeedback.message}</p>:<p role="status">{productFeedback.message}</p>)}<fieldset disabled={productBusy} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="m02-grid">{['name','description','fabric','fit','care','label','swatch'].map(field)}{editor.slug&&<p className="hint">Product URL: /product/{editor.slug}</p>}<label>Category<select required value={editor.category} onChange={e=>D({...editor,category:e.target.value})}><option value="">Select a category (e.g. Shirts)</option>{catalog.categories?.map(name=><option key={name} value={name}>{name}</option>)}</select></label></div><div className="m02-grid">{['featured','websiteVisible'].map(k=><label key={k}>{k==='featured'?'Featured product':'Visible on website'}<input type="checkbox" checked={k==='featured'?!!editor[k]:editor[k]!==false} onChange={e=>D({...editor,[k]:e.target.checked})}/></label>)}</div><h3>Product photographs</h3><p>Up to twenty local images, 500 KB each. For every product color, add a front-facing transparent PNG or WebP cutout and choose the try-on purpose. Remove all model, background and accessories; tightly crop the garment. Images are stored with the draft and published only after approval.</p><small>Example file: oxford-sky-blue-front.webp</small><input aria-label="Upload photograph" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{
 const file=e.target.files[0];
 e.target.value='';
 if(file)runProduct('Unable to upload photograph',()=>upload(file));
}}/><div className="m02-grid">{editor.images?.map((im,i)=><div key={i}><img src={im.src} alt={im.alt} width="120"/><label>Image description<input value={im.alt} placeholder="e.g. Sky Blue shirt viewed from the front" onChange={e=>D({...editor,images:editor.images.map((x,n)=>n===i?{...x,alt:e.target.value}:x)})}/></label><label>Image color<select value={im.color||''} onChange={e=>D({...editor,images:editor.images.map((x,n)=>n===i?{...x,color:e.target.value}:x)})}><option value="">First color (legacy)</option>{[...new Set(editor.variants.map(v=>v.color))].map(c=><option key={c}>{c}</option>)}</select></label><label>Image purpose<select value={im.kind||'photo'} onChange={e=>runProduct('Unable to change image purpose',()=>setImageKind(i,e.target.value))}><option value="photo">Product photograph</option><option value="tryon">Transparent garment-only try-on cutout</option></select></label><label>Development-generated image<input type="checkbox" checked={!!im.generated} onChange={e=>D({...editor,images:editor.images.map((x,n)=>n===i?{...x,generated:e.target.checked}:x)})}/></label><label>View label<input value={im.label||''} placeholder="e.g. Front view" onChange={e=>D({...editor,images:editor.images.map((x,n)=>n===i?{...x,label:e.target.value}:x)})}/></label><button onClick={()=>D({...editor,images:editor.images.filter((_,n)=>n!==i)})}>Remove image</button></div>)}</div>
 <h3>Variants · barcode is mandatory for every size and color</h3><p className="hint">Leave Store POS Price blank to use the website price. Click the barcode field for the matching size and color, then scan the printed tag with a USB or Bluetooth scanner in keyboard mode. You can also type or paste the barcode value.</p>{editor.variants.map((v,i)=><div className="m02-grid m02-variant" key={i}>{['sku','barcode','color','size','price','posPrice'].map(k=><label key={k}>{k==='posPrice'?'STORE POS PRICE':k.toUpperCase()}<input aria-label={`Variant ${i+1} ${k}`} readOnly={['sku','barcode'].includes(k)&&catalog.products.some(p=>p.id===editor.id&&p.variants.some(x=>x.sku===v.sku))} type={['price','posPrice'].includes(k)?'number':'text'} min={['price','posPrice'].includes(k)?0.01:undefined} step={['price','posPrice'].includes(k)?0.01:undefined} placeholder={'e.g. '+variantExamples[k]} autoComplete={k==='barcode'?'off':undefined} onKeyDown={k==='barcode'?e=>{if(e.key==='Enter')e.preventDefault();}:undefined} value={v[k]??''} onChange={e=>D({...editor,variants:editor.variants.map((x,n)=>n===i?{...x,[k]:k==='posPrice'&&e.target.value===''?null:['price','posPrice'].includes(k)?Number(e.target.value):e.target.value}:x)})}/></label>)}<label>Active variant<input type="checkbox" checked={v.active!==false} onChange={e=>D({...editor,variants:editor.variants.map((x,n)=>n===i?{...x,active:e.target.checked}:x)})}/></label>{!catalog.products.some(p=>p.id===editor.id&&p.variants.some(x=>x.sku===v.sku))&&<button onClick={()=>D({...editor,variants:editor.variants.filter((_,n)=>n!==i)})}>Remove</button>}</div>)}
 {<button onClick={()=>D({...editor,variants:[...editor.variants,{sku:'',barcode:'',color:'',size:'',price:1499}]})}>Add variant</button>}
 <SizeChartEditor product={editor} onChange={sizeChart=>D({...editor,sizeChart})}/>
 <div className="button-row">
  <button className="button button-dark" onClick={()=>runProduct('Unable to save draft',async()=>{
   if(!editor.category)throw new Error('Select a product category.');
   const draft=await post('/api/admin/products',editor);
   D({...draft.product,revision:draft.revision});
   V(null);
   setProductFeedback({message:'Draft saved. Open Preview before submitting.'});
   await run(()=>refresh());
  })}>Save draft</button>
  <button onClick={()=>V(structuredClone(editor))}>Preview</button>
  <button onClick={()=>runProduct('Unable to submit draft',async()=>{
   if(!editor.revision)throw new Error('Save the draft first, then open Preview.');
   if(!preview||JSON.stringify(preview)!==JSON.stringify(editor))throw new Error('Open Preview for the current draft before submitting.');
   await post(`/api/admin/products/${editor.id}/submit`,{revision:editor.revision});
   setProductFeedback({message:'Submitted for Super Admin approval.'});
   await run(()=>refresh());
  })}>Submit for approval</button>
  <button onClick={closeEditor}>Close editor</button>
 </div></fieldset>
 {preview&&<div className="m02-preview"><div className="eyebrow">DRAFT PREVIEW · NOT LIVE</div><ProductVisual product={preview}/><h2>{preview.name}</h2><p>{preview.description}</p><p>{preview.fabric} · {preview.fit}</p><details><summary>Preview garment overlay before approval</summary>{[...new Set(preview.variants.map(v=>v.color))].map(color=><details key={color}><summary>{color}</summary><LocalStylePreview product={preview} variant={preview.variants.find(v=>v.color===color)}/></details>)}</details><SizeChart product={preview} selectedSize={preview.variants[0]?.size}/>{preview.variants.map((v,i)=><p key={i}>{v.color} / {v.size} · {cash(v.price)} · Barcode: {v.barcode||'MISSING'}</p>)}</div>}</section>}
 </div>
 {access&&<section className="staff-panel operations-pane" id="admin-categories" hidden={section!=='admin-categories'}>
  <h2>Product categories</h2>
  <form className="m02-grid" onSubmit={event=>{
   event.preventDefault();
   run(async()=>{
    const {categories}=await post('/api/admin/categories',{name:categoryName});
    C(previous=>({...previous,categories}));
    localStorage.setItem('trd_categories_updated',String(Date.now()));
    setCategoryName('');
    N('Category added.');
   });
  }}>
   <label>Category name<input required maxLength={80} placeholder="e.g. Jackets" value={categoryName} onChange={event=>setCategoryName(event.target.value)}/></label>
   <button type="submit" disabled={!categoryName.trim()}>Add category</button>
  </form>
  <p>Hide a category to take its products off both the website and Store POS. Move any assigned products or drafts before removing it.</p>
  <ul>{catalog.categories?.map(name=>{
   const hidden=catalog.hiddenCategories?.includes(name);
   const assigned=catalog.products.some(product=>product.category===name)||Object.values(catalog.drafts).some(draft=>draft.product.category===name);
   const update=action=>run(async()=>{
    const result=await post('/api/admin/categories/update',{name,action});
    C(previous=>({...previous,...result}));
    localStorage.setItem('trd_categories_updated',String(Date.now()));
    N('Category updated.');
   });
   return <li key={name} className="m02-row"><span>{name} · {hidden?'Hidden':'Visible'}</span>
    <button onClick={()=>update(hidden?'show':'hide')}>{hidden?'Show':'Hide'}</button>
    <button disabled={assigned} onClick={()=>update('remove')}>Remove</button>
   </li>;
  })}</ul>
 </section>}
 {access&&<><section className="staff-panel operations-pane" hidden={section!=='admin-approvals'} id="admin-approvals"><h2>Approval queue</h2>{Object.values(catalog.drafts).filter(d=>d.status==='pending').map(d=><div className="m02-row" key={d.product.id}><span>{d.product.name} · revision {d.revision} · submitted by {d.submittedBy}</span><button onClick={()=>{setProductFeedback(null);D({...structuredClone(d.product),revision:d.revision});V(structuredClone(d.product));openSection('admin-products');}}>Inspect</button>{['publish','reject'].map(action=><button key={action} onClick={()=>run(async()=>{await post(`/api/admin/products/${d.product.id}/decide`,{revision:d.revision,action});await refresh();N(`Product ${action} complete.`);})}>{action}</button>)}</div>)}<h3>Decision history</h3>{catalog.approvals.slice(-10).reverse().map((a,i)=><p key={i}>{a.id} · revision {a.revision} · {a.action} by {a.actor}</p>)}</section>
 <section className="staff-panel operations-pane" hidden={section!=='admin-staff'} id="admin-staff"><h2>Staff access · demo PIN 1234</h2>{access.users.map(u=><div className="m02-row" key={u.id}><span>{u.name} ({u.id}) · {u.role} · {u.active?'Active':'Disabled'}</span><button onClick={()=>F({...u})}>Edit</button></div>)}<div className="m02-grid">{['id','name'].map(k=><label key={k}>{k}<input placeholder={k==='id'?'e.g. warehouse-hyd':'e.g. Warehouse operator'} value={userForm[k]} onChange={e=>F({...userForm,[k]:e.target.value})}/></label>)}<label>Role<select value={userForm.role} onChange={e=>F({...userForm,role:e.target.value})}>{Object.keys(access.roles).map(r=><option key={r}>{r}</option>)}</select></label><label>Location<select value={userForm.locationId} onChange={e=>F({...userForm,locationId:e.target.value})}>{inventory?.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label><input type="checkbox" checked={userForm.active} onChange={e=>F({...userForm,active:e.target.checked})}/>Active</label></div><button onClick={()=>run(async()=>{await post('/api/admin/users',userForm);await refresh();N('Staff access saved.');})}>Save user</button>
 <h3>Roles & permissions</h3><label>Role name<input value={roleName} placeholder="e.g. warehouse-assistant" onChange={e=>RN(e.target.value)}/></label><select aria-label="Load role" value="" onChange={e=>{RN(e.target.value);PS(access.roles[e.target.value]);}}><option value="">Load existing role</option>{Object.keys(access.roles).filter(r=>r!=='superadmin').map(r=><option key={r}>{r}</option>)}</select>{['catalog.edit','catalog.submit','inventory.read','pos.sell','warehouse.fulfill','website.manage','offers.manage','rewards.manage'].map(p=><label key={p}><input type="checkbox" checked={permissions.includes(p)} onChange={e=>PS(e.target.checked?[...permissions,p]:permissions.filter(x=>x!==p))}/>{p}</label>)}<button onClick={()=>run(async()=>{await post('/api/admin/roles',{name:roleName,permissions});await refresh();N('Role permissions saved.');})}>Save role</button><p>Super Admin permissions are fixed. Staff changes take effect on the next API request.</p></section></>}
 <section className="staff-panel operations-pane" hidden={section!=='admin-inventory'} id="admin-inventory"><h2>Shared inventory</h2><div className="m02-scroll"><table><thead><tr><th>SKU</th>{inventory?.locations.map(l=><th key={l.id}>{l.name}</th>)}</tr></thead><tbody>{Object.entries(inventory?.stock||{}).map(([sku,balances])=><tr key={sku}><td>{sku}</td>{inventory.locations.map(l=><td key={l.id}>{balances[l.id]||0}</td>)}</tr>)}</tbody></table></div>{access&&<><h3>Receive fictional stock</h3><div className="m02-grid"><label>SKU<select value={receipt.sku} onChange={e=>RC({...receipt,sku:e.target.value})}><option value="">Choose variant</option>{Object.keys(inventory?.stock||{}).map(s=><option key={s}>{s}</option>)}</select></label><label>Location<select value={receipt.locationId} onChange={e=>RC({...receipt,locationId:e.target.value})}>{inventory?.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>Quantity<input type="number" min="1" value={receipt.qty} placeholder="e.g. 12" onChange={e=>RC({...receipt,qty:Number(e.target.value)})}/></label><label>Reason<input value={receipt.reason} placeholder="e.g. Supplier delivery received" onChange={e=>RC({...receipt,reason:e.target.value})}/></label></div><button onClick={()=>run(async()=>{await post('/api/admin/inventory/receive',{...receipt,key:uniqueKey()});await refresh();N('Mock stock received.');})}>Receive mock stock</button><h3>Transfer unreserved stock</h3><div className="m02-grid"><label>SKU<select value={transfer.sku} onChange={e=>ST({...transfer,sku:e.target.value})}><option value="">Choose variant</option>{Object.keys(inventory?.stock||{}).map(s=><option key={s}>{s}</option>)}</select></label>{['from','to'].map(k=><label key={k}>{k}<select value={transfer[k]} onChange={e=>ST({...transfer,[k]:e.target.value})}>{inventory?.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>)}<label>Quantity<input type="number" min="1" value={transfer.qty} placeholder="e.g. 3" onChange={e=>ST({...transfer,qty:Number(e.target.value)})}/></label></div><button onClick={()=>run(async()=>{await post('/api/admin/inventory/transfer',{...transfer,key:uniqueKey()});await refresh();N('Stock transferred.');})}>Transfer</button></>}<h3>Recent stock movements</h3>{inventory?.ledger.slice(-10).reverse().map(l=><p key={l.id}>{l.sku} · {l.locationId} · {l.delta} · {l.reason}</p>)}</section></main>;
}
