'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import OrderTerms from '../../components/OrderTerms';
import {api} from '../../lib/api';
export default function Terms(){
 const [policy,setPolicy]=useState(null);
 useEffect(()=>{let live=true;api('/api/policy').then(p=>{if(live)setPolicy(p);}).catch(()=>{});return()=>{live=false;};},[]);
 return <main className="container section-pad"><div className="eyebrow">TRENDISE / STORE POLICY</div><h1>Terms &amp; Conditions</h1><OrderTerms policy={policy}/><Link href="/orders" className="button button-dark">My orders ↗</Link></main>;
}
