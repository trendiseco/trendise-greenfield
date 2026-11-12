'use client';
import {useEffect,useRef} from 'react';
export default function StoreDialog({title,onClose,children,className=''}){
 const ref=useRef(null);
 useEffect(()=>{const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.querySelector('button')?.focus();const key=e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const items=ref.current?.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,[tabindex="0"]');if(!items?.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus?.();};},[onClose]);
 return <div className="store-dialog-backdrop" onClick={onClose}><section ref={ref} className={`store-dialog ${className}`} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><div className="store-dialog-heading"><h2>{title}</h2><button onClick={onClose} aria-label={`Close ${title}`}>×</button></div>{children}</section></div>;
}
