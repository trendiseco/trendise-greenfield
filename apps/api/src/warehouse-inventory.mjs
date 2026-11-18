import {DomainError} from './errors.mjs';

import {centralWarehouseId} from './seed.mjs';

export function centralBalances(core){
 const held=new Map(),now=Date.now();
 for(const reservation of core.reservations.values()){
  if(reservation.status!=='active'||reservation.expiresAt<=now)continue;
  for(const {sku,qty} of reservation.allocations)held.set(sku,(held.get(sku)||0)+qty);
 }
 return Object.fromEntries(core.products.flatMap(product=>product.variants.map(variant=>{
  const onHand=core.stock[variant.sku]?.[centralWarehouseId]??0;
  const reserved=held.get(variant.sku)??0;
  return [variant.sku,{onHand,reserved,available:variant.active===false?0:Math.max(0,onHand-reserved)}];
 })));
}

export function warehouseInventory(session,query){
 this.permit(session,'warehouse.inventory');
 const category=query.get('category')||'all';
 const search=(query.get('q')||'').trim().toLowerCase().slice(0,100);
 const stockFilter=query.get('stock')||'all';
 if(!['all','available','unavailable'].includes(stockFilter))throw new DomainError(400,'Invalid stock filter');
 const balances=centralBalances(this);
 const categories=[...new Set(this.products.map(p=>p.category))].sort();
 const rows=[];
 for(const product of this.products){
  if(category!=='all'&&category!==product.category)continue;
  for(const variant of product.variants){
   if(search&&![product.name,product.category,variant.sku,variant.barcode,variant.color,variant.size].some(v=>String(v).toLowerCase().includes(search)))continue;
   const active=variant.active!==false;
   const totals=balances[variant.sku];
   if(stockFilter==='available'&&totals.available===0||stockFilter==='unavailable'&&totals.available>0)continue;
   rows.push({product,variant,active,totals});
  }
 }
 const pageSize=24,pageCount=Math.max(1,Math.ceil(rows.length/pageSize));
 const page=Math.max(1,Math.min(pageCount,Math.floor(Number(query.get('page'))||1)));
 const items=rows.slice((page-1)*pageSize,page*pageSize).map(({product,variant,active,totals})=>{
  const photo=product.images?.find(im=>im.kind!=='tryon'&&(im.color||product.variants[0]?.color)===variant.color);
  return {name:product.name,slug:product.slug,category:product.category,fabric:product.fabric,fit:product.fit,websiteVisible:product.websiteVisible!==false,sku:variant.sku,barcode:variant.barcode,color:variant.color,size:variant.size,price:variant.price,active,totals,photo:photo?{src:photo.src,alt:photo.alt}:null};
 });
 return {items,page,pageCount,total:rows.length,productCount:new Set(rows.map(row=>row.product.id)).size,categories};
}
