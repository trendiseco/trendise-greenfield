'use client';
import {useId,useState} from 'react';
import {measurementFields,convertMeasurement,isBottom} from '../../../../shared/size-chart.mjs';
import './size-guide.css';

function GarmentDiagram({product,field,back=false}){
 const id=useId().replaceAll(':','');
 const bottom=isBottom(product.category),tee=product.category==='Round-Neck T-Shirts',polo=product.category==='Polo T-Shirts';
 const short=tee||polo;
 const linen=String(product.fabric).toLowerCase().includes('linen');
 const panel=bottom?8+Math.max(0,['Formal Pants','Cotton Pants','Denim Pants','Cotton Cargo'].indexOf(product.category)):
  tee?6+Number(back):polo?4+Number(back):Number(linen)*2+Number(back);
 const lines=bottom?{
  length:[88,26,88,345],waistWidth:[115,29,245,29],hipWidth:[112,94,248,94],
  inseam:[184,140,206,345],thighWidth:[109,152,174,152],legOpening:[108,343,162,343],
 }:{
  length:[143,57,143,short?322:340],chestWidth:[90,151,270,151],shoulder:[98,81,262,81],
  sleeve:tee||polo?[265,82,318,142]:[269,84,314,316],
 };
 const line=lines[field.key];
 return <svg className="fit-garment" viewBox="0 0 360 400" role="img" aria-label={`${back?'Back':'Front'} garment reference showing ${field.label.toLowerCase()}`}>
  <defs><marker id={id+'-arrow'} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#8c3022"/></marker></defs>
  <svg x="0" y="0" width="360" height="380" viewBox={`${panel%4*360} ${Math.floor(panel/4)*400} 360 400`} preserveAspectRatio="none">
   <image href="/media/size-guide/garment-references.webp" width="1440" height="1200" preserveAspectRatio="none"/>
  </svg>
  {line&&<>
   <path d={`M${line[0]} ${line[1]}L${line[2]} ${line[3]}`} stroke="white" strokeWidth="5" fill="none"/>
   <path d={`M${line[0]} ${line[1]}L${line[2]} ${line[3]}`} stroke="#8c3022" strokeWidth="2" fill="none" strokeDasharray="5 4" markerStart={`url(#${id}-arrow)`} markerEnd={`url(#${id}-arrow)`}/>
  </>}
  <text x="180" y="394" textAnchor="middle" fill="#625d53" fontSize="11" letterSpacing="2">{back?'BACK':'FRONT'} · LAID FLAT</text>
 </svg>;
}

export default function SizeChart({product,selectedSize}){
 const [unit,setUnit]=useState('cm'),[tab,setTab]=useState('chart'),[active,setActive]=useState('length');
 const fields=measurementFields(product.category),field=fields.find(entry=>entry.key===active)||fields[0];
 const chart=product.sizeChart,sizes=[...new Set(product.variants.map(variant=>variant.size))];
 const row=chart?.rows?.find(entry=>entry.size===selectedSize);
 const value=convertMeasurement(row?.[field.key],chart?.unit,unit);
 const tolerance=convertMeasurement(chart?.tolerance,chart?.unit,unit);
 const back=field.key==='shoulder';
 return <div className="size-chart fit-guide">
  <div className="fit-guide-intro"><div><strong>{product.name}</strong><p>{product.fit} · {product.fabric}</p></div>
   <div className="measurement-unit" role="group" aria-label="Measurement units">{[['cm','Centimetres'],['in','Inches']].map(([key,label])=><button type="button" key={key} aria-label={label} aria-pressed={unit===key} onClick={()=>setUnit(key)}>{key==='cm'?'CM':'INCHES'}</button>)}</div>
  </div>
  <div className="fit-guide-tabs" role="group" aria-label="Size guide view">
   <button type="button" aria-pressed={tab==='chart'} onClick={()=>setTab('chart')}>Size chart</button>
   <button type="button" aria-pressed={tab==='measure'} onClick={()=>setTab('measure')}>How to measure</button>
  </div>
  {chart?.status==='sample'&&<p className="fit-guide-warning" role="note">Sample measurements for development. Actual garment measurements require verification.</p>}
  <div className="fit-guide-layout">
   <figure className="fit-guide-stage">
    <div className="fit-guide-stage-heading"><span>{field.label}</span><strong>{value!=null?`${value} ${unit}`:'Measurement guide'}{value!=null&&<small>Size {selectedSize}</small>}</strong></div>
    <GarmentDiagram product={product} field={field} back={back}/>
    <figcaption>AI-generated garment reference · measuring illustration</figcaption>
   </figure>
   <section className="fit-guide-detail" aria-label={tab==='chart'?'Garment size chart':'Measuring instructions'}>
    {tab==='chart'?<>
     <h3>Find your fit.</h3><p>Compare these measurements with a garment that fits you well.</p>
     {chart?.rows?.length?<div className="size-chart-scroll" tabIndex={0} aria-label="Scrollable size chart"><table>
      <caption>Garment measurements in {unit}.{tolerance>0&&` Allow ±${tolerance} ${unit}.`}</caption>
      <thead><tr><th scope="col">Size</th>{fields.map(entry=><th scope="col" key={entry.key}><button type="button" aria-pressed={field.key===entry.key} onClick={()=>setActive(entry.key)}>{entry.label}<small>{unit}</small></button></th>)}</tr></thead>
      <tbody>{sizes.map(size=><tr key={size} className={size===selectedSize?'current-size':''}><th scope="row">{size}{size===selectedSize&&<small>Selected</small>}</th>{fields.map(entry=><td key={entry.key}>{convertMeasurement(chart.rows.find(item=>item.size===size)?.[entry.key],chart.unit,unit)??'—'}</td>)}</tr>)}</tbody>
     </table></div>:<p className="fit-guide-warning">Measurements are awaiting confirmation for this product. Use the measuring guide below to compare your own garment.</p>}
     <p className="fit-guide-table-help">Select a measurement heading to see where to measure. — means the measurement has not been supplied.</p>
     <button type="button" className="fit-guide-how-link" onClick={()=>setTab('measure')}>Show me how to measure ↗</button>
    </>:<>
     <h3>Measure with confidence.</h3><p>Lay a garment you already own on a flat surface. Smooth it gently and measure without stretching.</p>
     <div className="fit-guide-fields" role="group" aria-label="Choose a measurement">{fields.map(entry=><button type="button" key={entry.key} aria-pressed={field.key===entry.key} onClick={()=>setActive(entry.key)}>{entry.label}</button>)}</div>
     <div className="fit-guide-instruction" aria-live="polite"><h4>{field.label}</h4><p>{field.help}</p>{value!=null&&<p>For size <strong>{selectedSize}</strong>, this garment measures <strong>{value} {unit}</strong>.</p>}</div>
    </>}
    <div className="fit-guide-flat"><strong>Width is measured flat.</strong><p>Measure across one side of the garment. Double chest, waist or hip width for the approximate measurement all the way around.</p></div>
    {chart?.notes&&<p className="fit-guide-notes">{chart.notes}</p>}
   </section>
  </div>
 </div>;
}
