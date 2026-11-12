'use client';

import {useEffect,useState} from 'react';

export function useStaffSection(defaultSection) {
 const [section,setSection]=useState(defaultSection);
 useEffect(()=>{
  const read=()=>setSection(window.location.hash.slice(1)||defaultSection);
  read();
  window.addEventListener('hashchange',read);
  window.addEventListener('popstate',read);
  return ()=>{
   window.removeEventListener('hashchange',read);
   window.removeEventListener('popstate',read);
  };
 },[defaultSection]);
 function openSection(id) {
  if(window.location.hash!=='#'+id)window.history.pushState(null,'','#'+id);
  setSection(id);
 }
 return [section,openSection];
}

export function StaffTabs({label,tabs,active,onChange}) {
 return <nav className="operations-tabs" aria-label={label}>
  {tabs.map(([id,name])=><a key={id} href={'#'+id} aria-current={active===id?'page':undefined} onClick={event=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();
   onChange(id);
  }}>{name}</a>)}
 </nav>;
}
