'use client';
import {useEffect,useState} from 'react';
import {api} from './api';

export function useCatalogAvailability(ready) {
 const [available,setAvailable]=useState(null);
 useEffect(()=>{
  if(!ready)return;
  const controller=new AbortController();
  let pending=false;
  const refresh=async()=>{
   if(document.hidden||pending)return;
   pending=true;
   try {
    const result=await api('/api/products/availability',{signal:controller.signal});
    if(!controller.signal.aborted)setAvailable(result.available);
   } catch {
    // Keep the last availability shown. Checkout verifies current stock.
   } finally {pending=false;}
  };
  const timer=setInterval(refresh,15000);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  return ()=>{
   controller.abort();
   clearInterval(timer);
   window.removeEventListener('focus',refresh);
   document.removeEventListener('visibilitychange',refresh);
  };
 },[ready]);
 return available;
}

export function withCatalogAvailability(product,available) {
 if(!product||!available)return product;
 return {...product,variants:product.variants.map(variant=>({...variant,available:available[variant.sku]??0}))};
}
