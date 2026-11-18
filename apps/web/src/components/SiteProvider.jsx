'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import defaults from '../../../../shared/website-defaults.json';
import {api,API_BASE} from '../lib/api';
const SiteContext=createContext({site:defaults,rules:null,coupons:[],preview:false});
import {heroFilmSource} from '../../../../shared/hero-films.mjs';
export const mediaUrl=src=>src?.startsWith('/api/media/')?API_BASE+src:heroFilmSource(src);
export function SiteProvider({children}){
 const path=usePathname(),[data,D]=useState({site:defaults,rules:null,coupons:[],preview:false});
 useEffect(()=>{if(['/admin','/pos','/warehouse','/operations','/superadmin'].some(p=>path.startsWith(p)))return;let live=true;const load=async()=>{try{const publicData=await api('/api/website');if(new URLSearchParams(location.search).get('websitePreview')==='1'){const token=sessionStorage.getItem('trd_staff_token');if(token){const draft=await api('/api/admin/website',{token});publicData.site=draft.draft;publicData.preview=true;}}if(live)D(publicData);}catch{/* Keep the last published presentation while the API is unavailable. */}};load();window.addEventListener('focus',load);window.addEventListener('storage',load);return()=>{live=false;window.removeEventListener('focus',load);window.removeEventListener('storage',load);};},[path]);
 useEffect(()=>{if(!['/admin','/pos','/warehouse','/operations','/superadmin'].some(p=>path.startsWith(p)))document.title=`${data.site.brand.name} | ${data.site.brand.tagline}`;},[data.site,path]);
 return <SiteContext.Provider value={data}>{children}</SiteContext.Provider>;
}
export const useSite=()=>useContext(SiteContext);
