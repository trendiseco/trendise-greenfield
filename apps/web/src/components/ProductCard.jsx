'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import StorePhoto from './StorePhoto';
import ProductPrice from './ProductPrice';
import {cash} from '../lib/api';
import {galleryFor} from '../lib/catalog-media';
import {useCart} from './CartProvider';
export default function ProductCard({product,index=0,preferredColor}){
 const card=useRef(null),cart=useCart();const [color,C]=useState(preferredColor||product.variants[0]?.color),[added,A]=useState('');
 useEffect(()=>{C(preferredColor||product.variants[0]?.color);A('');},[preferredColor,product.id]);
 const variants=product.variants.filter(v=>v.color===color),first=variants[0]||product.variants[0];const colors=[...new Set(product.variants.map(v=>v.color))],gallery=galleryFor(product,color);
 const tilt=e=>{if(!matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches)return;const rect=e.currentTarget.getBoundingClientRect();card.current.style.setProperty('--rx',`${-(e.clientY-rect.top-rect.height/2)/100}deg`);card.current.style.setProperty('--ry',`${(e.clientX-rect.left-rect.width/2)/100}deg`);};
 const reset=()=>{card.current?.style.setProperty('--rx','0deg');card.current?.style.setProperty('--ry','0deg');};
 return <article className="fashion-card" ref={card} onPointerMove={tilt} onPointerLeave={reset}>
 <div className="fashion-image"><Link href={`/product/${product.slug}?color=${encodeURIComponent(color)}`} aria-label={`View ${product.name}`}><StorePhoto product={product} color={color}/>{gallery[4]&&<img className="card-alternate" src={gallery[4].src} alt="" loading="lazy"/>}</Link><span className="fashion-card-index">{String(index+1).padStart(2,'0')} / THE COLLECTION</span><Link href={`/product/${product.slug}?color=${encodeURIComponent(color)}`} className="card-open" aria-label={`Explore ${product.name}`}>↗</Link><div className="quick-sizes" aria-label={`Quick add ${product.name}`}><span>QUICK ADD</span>{variants.map(v=><button key={v.sku} disabled={!v.available} aria-label={`Add ${product.name}, ${v.color}, ${v.size} to bag`} onClick={()=>{cart.add(product,v);A(v.size);}}>{added===v.size?'✓':v.size}</button>)}</div></div>
 <div className="fashion-card-title"><h3><Link href={`/product/${product.slug}?color=${encodeURIComponent(color)}`}>{product.name}</Link></h3><ProductPrice price={first.price}/></div><div className="fashion-card-sub"><span>{product.fit} · {color}</span><div className="card-colors">{colors.map(c=><button key={c} aria-label={`Show ${product.name} in ${c}`} aria-pressed={color===c} className={color===c?'chosen':''} onClick={()=>{C(c);A('');}}>{c}</button>)}</div></div>{added&&<span className="card-added" role="status">Size {added} added to bag</span>}
 </article>;
}
