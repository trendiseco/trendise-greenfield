'use client';
import {useSite} from './SiteProvider';
import {productOffer} from '../../../../shared/product-offer.mjs';
import {coverFor} from '../lib/catalog-media';
import React,{createContext,useContext,useEffect,useState} from 'react';
const CartCtx=createContext(null);
export function CartProvider({children}){
  const [items,setItems]=useState([]);
  const {coupons}=useSite();
  const [ready,setReady]=useState(false);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('trendise-dev-cart')||'[]');if(Array.isArray(saved))setItems(saved);}catch{}setReady(true);},[]);
  useEffect(()=>{if(ready)localStorage.setItem('trendise-dev-cart',JSON.stringify(items));},[items,ready]);
  const add=(product,variant)=>setItems(prev=>{
    const present=prev.find(x=>x.sku===variant.sku);
    if(present)return prev.map(x=>x.sku===variant.sku?{...x,qty:Math.min(x.qty+1,25)}:x);
    return [...prev,{sku:variant.sku,barcode:variant.barcode,name:product.name,slug:product.slug,category:product.category,swatch:product.swatch,color:variant.color,size:variant.size,price:variant.price,qty:1,image:coverFor(product,variant.color)||null}];
  });
  const update=(sku,qty)=>setItems(prev=>prev.map(x=>x.sku===sku?{...x,qty:Math.max(0,Math.min(25,qty))}:x).filter(x=>x.qty>0));
  const remove=sku=>setItems(prev=>prev.filter(x=>x.sku!==sku));
  const clear=()=>setItems([]);
  const subtotal=items.reduce((n,x)=>n+x.qty*x.price,0),offer=productOffer(subtotal,coupons);
  return <CartCtx.Provider value={{offer,ready,items,add,update,remove,clear,count:items.reduce((n,x)=>n+x.qty,0),subtotal:items.reduce((n,x)=>n+x.qty*x.price,0)}}>{children}</CartCtx.Provider>;
}
export function useCart(){const cart=useContext(CartCtx);if(!cart)throw new Error('CartProvider missing');return cart;}
