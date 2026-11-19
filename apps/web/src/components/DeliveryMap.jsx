'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '../lib/api';
import StoreDialog from './StoreDialog';
import ActionFeedback from './ActionFeedback';
import 'leaflet/dist/leaflet.css';
import './delivery-map.css';

export default function DeliveryMap({address,onSelect,onClose}){
 const host=useRef(null),map=useRef(null),marker=useRef(null),version=useRef(0);
 const [point,setPoint]=useState(address.mapPin||null),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[pin,setPin]=useState(address.pincode||'');
 const [mapError,setMapError]=useState('');
 useEffect(()=>{
  let disposed=false,instance;
  import('leaflet').then(module=>{
   if(disposed)return;const L=module.default;
   instance=L.map(host.current,{center:address.mapPin?[address.mapPin.lat,address.mapPin.lon]:[22.5,79],zoom:address.mapPin?16:5});map.current=instance;
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'}).on('tileerror',()=>setMapError('Map tiles could not load. Check your connection or use manual address entry.')).on('tileload',()=>setMapError('')).addTo(instance);
   const icon=L.divIcon({className:'delivery-pin-icon',html:'<span></span>',iconSize:[30,38],iconAnchor:[15,38]});
   const choose=position=>{version.current++;setPoint(position);setResult(null);setError('');};
   const place=position=>{
    if(!marker.current){marker.current=L.marker([position.lat,position.lon],{icon,draggable:true,autoPan:true,title:'Delivery pin — drag to adjust'}).addTo(instance);marker.current.on('dragend',()=>{const p=marker.current.getLatLng();choose({lat:p.lat,lon:p.lng});});}
    else marker.current.setLatLng([position.lat,position.lon]);choose(position);
   };
   instance.on('click',event=>place({lat:event.latlng.lat,lon:event.latlng.lng}));
   // Keyboard users can pan the map with arrows and place a pin at its centre.
   map.current.placeCenter=()=>{const p=instance.getCenter();place({lat:p.lat,lon:p.lng});};
   if(address.mapPin)place(address.mapPin);
   setReady(true);
  }).catch(()=>setMapError('The map could not start. You can still enter your address manually.'));
  return()=>{disposed=true;version.current++;instance?.remove();map.current=null;marker.current=null;};
 },[]);
 async function goToPin(){
  setError('');if(!/^[1-9]\d{5}$/.test(pin)){setError('Enter a valid six-digit PIN.');return;}
  try{const response=await fetch('/data/india-pins/'+pin[0]+'.json');if(!response.ok)throw new Error('PIN directory unavailable.');const directory=await response.json(),entry=directory[pin];if(!entry||!Number.isFinite(entry[2])||!Number.isFinite(entry[3]))throw new Error('PIN location not found. Move the map manually.');map.current?.setView([entry[2],entry[3]],14);}
  catch(e){setError(e.message);}
 }
 async function lookup(){
  if(!point||busy)return;const current=version.current;setBusy(true);setError('');setResult(null);
  try{const found=await api('/api/delivery/map-address',{method:'POST',body:JSON.stringify(point)});if(version.current===current)setResult(found);}
  catch(e){if(version.current===current)setError(e.message);}finally{setBusy(false);}
 }
 return <StoreDialog title="Choose delivery location" className="delivery-map-dialog" onClose={onClose}>
  <p>Find your area by PIN, then tap the map or drag the marker to your delivery location.</p>
  <p className="hint">Map tiles load from OpenStreetMap. “Find address” sends only the selected coordinates to Photon to look up the address. Your name and phone are not sent.</p>
  <div className="delivery-map-search"><label>Area PIN code<input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" maxLength={6} placeholder="e.g. 500001" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();goToPin();}}}/></label><button className="button button-line" disabled={!ready} onClick={goToPin}>Find area</button></div>
  <div ref={host} className="delivery-map-canvas" role="region" aria-label="Delivery map. Use arrow keys to move and the place pin button to select the centre."/>
  <div className="button-row"><button className="small-outline" disabled={!ready} onClick={()=>map.current?.placeCenter()}>Place pin at map centre</button><button className="button button-dark" disabled={!point||busy} onClick={lookup}>{busy?'Finding address…':'Find address for this pin'}</button></div>
  <ActionFeedback error={error||mapError} pending={busy?'Looking up the selected location…':''}/>
  {result&&<div className="delivery-map-result"><h3>Address found</h3><p>{[result.line1,result.city,result.district,result.state,result.pincode].filter(Boolean).join(', ')}</p><p className="hint">Nearest mapped address, not a verified delivery address. Review every field and add your house / flat number. Missing details must be entered manually.</p><button className="button button-dark" onClick={()=>onSelect(result)}>Use this address</button></div>}
  <p className="hint">Address data: © OpenStreetMap contributors, lookup by <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a>. <button className="text-button" onClick={onClose}>Continue with manual address</button></p>
 </StoreDialog>;
}
