import {useState} from 'react';
import {cash} from '../lib/api';
import ActionFeedback from './ActionFeedback';
import LocalStylePreview from './LocalStylePreview';
import ProductVisual from './ProductVisual';
import SizeChart from './SizeChart';
import SizeChartEditor from './SizeChartEditor';

const productExamples={name:'Oxford Formal Shirt',description:'A cotton shirt with a button-down collar.',fabric:'100% cotton',fit:'Regular fit',care:'Machine wash cold. Line dry.',label:'New arrival',swatch:'#acc3d0'};
const variantExamples={sku:'SH-OXF-SKY-M',barcode:'0012345678905',color:'Sky Blue',size:'M',price:'1499',posPrice:'1399'};
const createVariant=()=>({sku:'',barcode:'',color:'',size:'',price:1499});
export const createProductDraft=()=>({name:'',category:'',description:'',fabric:'',fit:'',images:[],variants:[createVariant()]});

export function AdminProductList({catalog,onCreate,onEdit,hidden,canCreate}) {
 const publishedIds=new Set(catalog.products.map(product=>product.id));
 const unpublished=Object.values(catalog.drafts)
  .map(draft=>draft.product)
  .filter(product=>!publishedIds.has(product.id));
 return <section className="staff-panel" id="admin-products" hidden={hidden}>
  <div className="panel-heading"><h2>Products</h2>{canCreate&&<button onClick={onCreate}>Create product</button>}</div>
  {[...catalog.products,...unpublished].map(product=><div className="m02-row" key={product.id}>
   <strong>{product.name}<small style={{display:'block',fontWeight:400}}>Product ID: {product.id}</small></strong>
   <span>{catalog.drafts[product.id]?.status||'published'} · {product.variants.length} variants</span>
   <button onClick={()=>onEdit(product)}>Edit / preview</button>
  </div>)}
 </section>;
}

async function validateCutout(image) {
 if(!image.color||!/^data:image\/(png|webp);/.test(image.src)){
  throw new Error('Select a variant color and use a transparent PNG or WebP cutout.');
 }
 const bitmap=await new Promise((resolve,reject)=>{
  const preview=new Image();
  preview.onload=()=>resolve(preview);
  preview.onerror=()=>reject(new Error('Unable to open cutout'));
  preview.src=image.src;
 });
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=80;
 const context=canvas.getContext('2d');
 context.drawImage(bitmap,0,0,80,80);
 const {data}=context.getImageData(0,0,80,80);
 let transparentPixels=0;
 for(let alpha=3;alpha<data.length;alpha+=4){
  if(data[alpha]<240)transparentPixels++;
 }
 if(transparentPixels<64||transparentPixels>6336){
  throw new Error('Cutout must contain a visible garment with a transparent background. Remove the background before uploading.');
 }
}

export default function AdminProductEditor({catalog,editor,onChange,preview,onPreview,post,onSaved,onClose,productBusy,setProductBusy,saving,canEdit,canSubmit}) {
 const [productFeedback,setProductFeedback]=useState(null);
 const [productAction,setProductAction]=useState('');
 const productResult=key=>productAction===key&&<ActionFeedback error={productFeedback?.error?productFeedback.message:''} success={!productFeedback?.error?productFeedback?.message:''} pending={productBusy}/>;
 const runProduct=async(key,progress,action,fn)=>{
  setProductAction(key);
  setProductFeedback(null);
  setProductBusy(progress);
  try{await fn();}
  catch(error){setProductFeedback({error:true,message:action+': '+error.message});}
  finally{setProductBusy('');}
 };
 const field=name=><label key={name}>
  {name==='swatch'?'Swatch (optional)':name.toUpperCase()}
  <input required={name!=='swatch'} placeholder={productExamples[name]?'e.g. '+productExamples[name]:undefined}
   value={editor[name]||''} onChange={e=>onChange({...editor,[name]:e.target.value})}/>
 </label>;
 const updateImage=(index,patch)=>onChange({
  ...editor,images:editor.images.map((image,i)=>i===index?{...image,...patch}:image)
 });
 const setImageKind=async(index,kind)=>{
  if(kind==='tryon')await validateCutout(editor.images[index]);
  updateImage(index,{kind});
 };
 const upload=async file=>{
  if(file.size>500000||!['image/png','image/jpeg','image/webp'].includes(file.type)){
   throw new Error('Choose PNG, JPEG or WebP up to 500 KB');
  }
  if(editor.images?.length>=20)throw new Error('Maximum twenty images');
  const src=await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(reader.result);
   reader.onerror=()=>reject(new Error('Unable to read photograph'));
   reader.readAsDataURL(file);
  });
  const image={src,alt:editor.name||'Product photograph',color:editor.variants[0]?.color||'',label:'Product photo'};
  onChange({...editor,images:[...(editor.images||[]),image]});
 };
 return <section className="staff-panel">
 <div className="panel-heading"><h2>Product editor</h2><button disabled={!!productBusy||saving} onClick={onClose}>Back to products</button></div>
 <fieldset disabled={!!productBusy||saving} style={{border:0,padding:0,margin:0,minWidth:0}}>
  <div className="m02-grid">
   {['name','description','fabric','fit','care','label','swatch'].map(field)}
   {editor.slug&&<p className="hint">Product URL: /product/{editor.slug}</p>}
   <label>Category
    <select required value={editor.category} onChange={e=>onChange({...editor,category:e.target.value})}>
     <option value="">Select a category (e.g. Shirts)</option>
     {catalog.categories?.map(name=><option key={name} value={name}>{name}</option>)}
    </select>
   </label>
   </div>
 <div className="m02-grid">{['featured','websiteVisible'].map(k=>
   <label key={k}>{k==='featured'?'Featured product':'Visible on website'}<input type="checkbox" checked={k==='featured'?!!editor[k]:editor[k]!==false} onChange={e=>onChange({...editor,[k]:e.target.checked})}/></label>
   )}</div>
 <h3>Product photographs</h3><p>Up to twenty local images, 500 KB each. For every product color, add a front-facing transparent PNG or WebP cutout and choose the try-on purpose. Remove all model, background and accessories; tightly crop the garment. Images are stored with the draft and published only after approval.</p>
 <small>Example file: oxford-sky-blue-front.webp</small>
 <input aria-label="Upload photograph" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{
 const file=e.target.files[0];
 e.target.value='';
 if(file)runProduct('upload','Uploading photograph…','Unable to upload photograph',()=>upload(file));
}}/>{productResult('upload')}<div className="m02-grid">{editor.images?.map((im,i)=><div key={i}><img src={im.src} alt={im.alt} width="120"/>
   <label>Image description<input value={im.alt} placeholder="e.g. Sky Blue shirt viewed from the front" onChange={e=>updateImage(i,{alt:e.target.value})}/></label>

   <label>Image color<select value={im.color||''} onChange={e=>updateImage(i,{color:e.target.value})}><option value="">First color (legacy)</option>{[...new Set(editor.variants.map(v=>v.color))].map(c=><option key={c}>{c}</option>)}</select></label>

   <label>Image purpose<select value={im.kind||'photo'} onChange={e=>runProduct('image-'+i,'Updating image purpose…','Unable to change image purpose',()=>setImageKind(i,e.target.value))}><option value="photo">Product photograph</option><option value="tryon">Transparent garment-only try-on cutout</option></select></label>
   {productResult('image-'+i)}<label>Development-generated image<input type="checkbox" checked={!!im.generated} onChange={e=>updateImage(i,{generated:e.target.checked})}/></label>

   <label>View label<input value={im.label||''} placeholder="e.g. Front view" onChange={e=>updateImage(i,{label:e.target.value})}/></label>
   <button onClick={()=>onChange({...editor,images:editor.images.filter((_,n)=>n!==i)})}>Remove image</button></div>)}</div>
 <h3>Variants · barcode is mandatory for every size and color</h3><p className="hint">Leave Store POS Price blank to use the website price. Click the barcode field for the matching size and color, then scan the printed tag with a USB or Bluetooth scanner in keyboard mode. You can also type or paste the barcode value.</p>
 <p className="hint">Enter the opening quantity for each new size and color. Blank means 0 pieces. On publication, stock is added to Hyderabad Warehouse and is available to both the customer website and Store POS. Use Inventory for later stock receipts or to record physical transfers.</p>
 {editor.variants.map((v,i)=>{
  const published=catalog.products.some(p=>p.id===editor.id&&p.variants.some(x=>x.sku===v.sku));
  const updateVariant=patch=>onChange({...editor,variants:editor.variants.map((variant,index)=>index===i?{...variant,...patch}:variant)});
  return <div className="m02-grid m02-variant" key={i}>
   {['sku','barcode','color','size','price','posPrice'].map(k=>{
    const isPrice=k==='price'||k==='posPrice';
    return <label key={k}>{k==='posPrice'?'STORE POS PRICE':k.toUpperCase()}
     <input aria-label={`Variant ${i+1} ${k}`} readOnly={published&&(k==='sku'||k==='barcode')} type={isPrice?'number':'text'} min={isPrice?0.01:undefined} step={isPrice?0.01:undefined} placeholder={'e.g. '+variantExamples[k]} autoComplete={k==='barcode'?'off':undefined} onKeyDown={k==='barcode'?e=>{if(e.key==='Enter')e.preventDefault();}:undefined} value={v[k]??''} onChange={e=>updateVariant({[k]:k==='posPrice'&&e.target.value===''?null:isPrice?Number(e.target.value):e.target.value})}/>
    </label>;
   })}
   {!published&&<label>Opening quantity (pcs)
    <input aria-label={`Variant ${i+1} opening quantity (pcs)`} type="number" min="0" max="100000" step="1" placeholder="e.g. 12" value={v.openingQty??''} onChange={e=>updateVariant({openingQty:e.target.value===''?undefined:Number(e.target.value)})}/>
   </label>}
   <label>Active variant<input type="checkbox" checked={v.active!==false} onChange={e=>updateVariant({active:e.target.checked})}/></label>

   {!published&&<button onClick={()=>onChange({...editor,variants:editor.variants.filter((_,n)=>n!==i)})}>Remove</button>}
  </div>;
 })}
 <button onClick={()=>onChange({...editor,variants:[...editor.variants,createVariant()]})}>Add variant</button>
 <SizeChartEditor product={editor} onChange={sizeChart=>onChange({...editor,sizeChart})}/>
 <div className="button-row">
  <div><button className="button button-dark" disabled={!canEdit} onClick={()=>runProduct('save','Saving draft…','Unable to save draft',async()=>{
   if(!editor.category)throw new Error('Select a product category.');
   const draft=await post('/api/admin/products',editor);
   onChange({...draft.product,revision:draft.revision});
   onPreview(null);
   setProductFeedback({message:'Draft saved. Open Preview before submitting.'});
   await onSaved();
  })}>Save draft</button>{productResult('save')}</div>
  <button onClick={()=>onPreview(structuredClone(editor))}>Preview</button>
  <div><button disabled={!canSubmit} onClick={()=>runProduct('submit','Submitting draft…','Unable to submit draft',async()=>{
   if(!editor.revision)throw new Error('Save the draft first, then open Preview.');
   if(!preview||JSON.stringify(preview)!==JSON.stringify(editor))throw new Error('Open Preview for the current draft before submitting.');
   await post(`/api/admin/products/${editor.id}/submit`,{revision:editor.revision});
   setProductFeedback({message:'Submitted for Super Admin approval.'});
   await onSaved();
  })}>Submit for approval</button>{productResult('submit')}</div>
  <button onClick={onClose}>Close editor</button>
 </div></fieldset>
 {preview&&<div className="m02-preview">
  <div className="eyebrow">DRAFT PREVIEW · NOT LIVE</div>
  <ProductVisual product={preview}/>
  <h2>{preview.name}</h2><p>{preview.description}</p><p>{preview.fabric} · {preview.fit}</p>
  <details><summary>Preview garment overlay before approval</summary>
  {[...new Set(preview.variants.map(v=>v.color))].map(color=><details key={color}><summary>{color}</summary><LocalStylePreview product={preview} variant={preview.variants.find(v=>v.color===color)}/></details>)}</details>
  <SizeChart product={preview} selectedSize={preview.variants[0]?.size}/>
  {preview.variants.map((v,i)=><p key={i}>{v.color} / {v.size} · {cash(v.price)} · Barcode: {v.barcode||'MISSING'}{v.openingQty>0&&` · Opening warehouse stock: ${v.openingQty} pcs`}</p>)}</div>}</section>;
}
