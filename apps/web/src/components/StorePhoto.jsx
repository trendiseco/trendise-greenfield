'use client';
import {useState} from 'react';
import {API_BASE} from '../lib/api';
import {coverFor} from '../lib/catalog-media';
export default function StorePhoto({product,color,className='',priority=false,src,alt}){
 const [broken,setBroken]=useState('');const cover=coverFor(product,color);const source=src||cover?.src;
 const url=source?.startsWith('/api/media/')?API_BASE+source:source;
 return <div className={`store-photo ${className}`}>{url&&broken!==url?<img src={url} alt={alt||cover?.alt||product.name} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" onError={()=>setBroken(url)}/>:<div className="photo-unavailable"><span>T /</span><p>Photography coming soon</p><small>{product.name} · {color||product.color}</small></div>}</div>;
}
