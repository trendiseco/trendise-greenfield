'use client';
import {useEffect,useRef} from 'react';
import JsBarcode from 'jsbarcode';

export default function PickBarcode({value}){
 const ref=useRef(null);
 useEffect(()=>{
  const svg=ref.current;
  JsBarcode(svg,value,{format:'CODE128',width:2,height:64,margin:0,marginLeft:24,marginRight:24,marginTop:6,marginBottom:6,displayValue:false,lineColor:'#000',background:'#fff'});
  svg.setAttribute('viewBox',`0 0 ${parseFloat(svg.getAttribute('width'))} ${parseFloat(svg.getAttribute('height'))}`);
 },[value]);
 return <div className="warehouse-pick-barcode"><svg ref={ref} role="img" aria-label={`Order-line Code 128 barcode ${value}`}/><code>{value}</code></div>;
}
