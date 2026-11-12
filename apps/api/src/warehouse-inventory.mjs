import {DomainError} from './errors.mjs';

export function warehouseInventory(session,query){
 this.permit(session,'warehouse.fulfill');
 const location=query.get('location')||'all',category=query.get('category')||'all';
 if(location!=='all'&&!this.locations.some(l=>l.id===location))throw new DomainError(400,'Unknown stock location');
 const search=(query.get('q')||'').trim().toLowerCase().slice(0,100);
 const stockFilter=query.get('stock')||'all';
 if(!['all','available','unavailable'].includes(stockFilter))throw new DomainError(400,'Invalid stock filter');
 const held=new Map(),now=Date.now();
 for(const r of this.reservations.values()){
  if(r.status!=='active'||r.expiresAt<=now)continue;
  for(const a of r.allocations){
   const key=a.sku+'|'+a.locationId;
   held.set(key,(held.get(key)||0)+a.qty);
  }
 }
 const locations=this.locations.map(({id,name,type})=>({id,name,type}));
 const categories=[...new Set(this.products.map(p=>p.category))].sort();
 const rows=[];
 for(const product of this.products){
  if(category!=='all'&&category!==product.category)continue;
  for(const variant of product.variants){
   if(search&&![product.name,product.category,variant.sku,variant.barcode,variant.color,variant.size].some(v=>String(v).toLowerCase().includes(search)))continue;
   const active=variant.active!==false;
   const balances=locations.filter(l=>location==='all'||l.id===location).map(l=>{
    const onHand=this.stock[variant.sku]?.[l.id]??0,reserved=held.get(variant.sku+'|'+l.id)||0;
    return {id:l.id,name:l.name,onHand,reserved,available:active?Math.max(0,onHand-reserved):0};
   });
   const totals=balances.reduce((sum,b)=>({onHand:sum.onHand+b.onHand,reserved:sum.reserved+b.reserved,available:sum.available+b.available}),{onHand:0,reserved:0,available:0});
   if(stockFilter==='available'&&totals.available===0||stockFilter==='unavailable'&&totals.available>0)continue;
   rows.push({product,variant,active,balances,totals});
  }
 }
 const pageSize=24,pageCount=Math.max(1,Math.ceil(rows.length/pageSize));
 const page=Math.max(1,Math.min(pageCount,Math.floor(Number(query.get('page'))||1)));
 const items=rows.slice((page-1)*pageSize,page*pageSize).map(({product,variant,active,balances,totals})=>{
  const photo=product.images?.find(im=>im.kind!=='tryon'&&(im.color||product.variants[0]?.color)===variant.color);
  return {name:product.name,slug:product.slug,category:product.category,fabric:product.fabric,fit:product.fit,websiteVisible:product.websiteVisible!==false,sku:variant.sku,barcode:variant.barcode,color:variant.color,size:variant.size,price:variant.price,active,balances,totals,photo:photo?{src:photo.src,alt:photo.alt}:null};
 });
 return {items,page,pageCount,total:rows.length,productCount:new Set(rows.map(row=>row.product.id)).size,locations,categories};
}
