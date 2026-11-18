'use client';
import {useId,useState} from 'react';
import {measurementFields,convertMeasurement,isBottom} from '../../../../shared/size-chart.mjs';
import './size-guide.css';

function GarmentDiagram({category,field,back=false}){
 const id=useId().replaceAll(':','');
 const bottom=isBottom(category),tee=category==='Round-Neck T-Shirts',polo=category==='Polo T-Shirts',short=tee||polo;
 const lines=bottom?{
  length:[68,57,68,345],waistWidth:[109,66,251,66],hipWidth:[110,120,250,120],
  inseam:[191,166,208,340],thighWidth:[111,176,169,176],legOpening:[109,337,163,337],
 }:{
  length:[138,67,138,337],chestWidth:[110,163,250,163],shoulder:[115,100,245,100],
  sleeve:short?[248,89,295,150]:[252,90,300,316],
 };
 const line=lines[field.key];
 return <svg className="fit-garment" viewBox="0 0 360 400" role="img" aria-label={`${back?'Back':'Front'} view showing ${field.label.toLowerCase()}`}>
  <defs>
   <linearGradient id={id+'-fabric'} x1="0" y1="0" x2="1" y2=".4"><stop stopColor="#e6e0d4"/><stop offset=".38" stopColor="#fffdf8"/><stop offset=".7" stopColor="#eee8dd"/><stop offset="1" stopColor="#cfc7b8"/></linearGradient>
   <filter id={id+'-shadow'} x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="3" dy="12" stdDeviation="8" floodColor="#3b3020" floodOpacity=".15"/></filter>
   <marker id={id+'-arrow'} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#943f2e"/></marker>
  </defs>
  <ellipse cx="183" cy="361" rx="88" ry="8" fill="#302819" opacity=".05"/>
  <g fill={`url(#${id}-fabric)`} stroke="#8e887b" strokeWidth="1.4" strokeLinejoin="round" filter={`url(#${id}-shadow)`}>
   {bottom?<path d="M104 52H256L252 119 263 344H204L180 169 161 344H102L109 121Z"/>:
    <path d={short?'M148 65 115 82 63 137 99 168 112 148 108 338Q180 350 252 338L248 148 262 168 298 137 245 82 212 65Q180 91 148 65Z':'M148 65 115 82 91 119 57 314 96 324 115 178 108 337Q180 351 252 337L245 178 264 324 303 314 270 119 245 82 212 65Q180 91 148 65Z'}/>}
  </g>
  <g fill="none" stroke="#b3ab9c" strokeWidth="1.2">
   {bottom?<><path d="M105 74H255M180 74V146Q189 155 199 151M109 87Q140 95 133 121M251 87Q220 95 227 121M180 169 162 337M180 169 204 337M105 333H162M204 333H260"/>
    {[120,155,202,237].map(x=><path key={x} d={`M${x} 53V73`}/>)}
    {category==='Cotton Cargo'&&<path d="M111 188H155V235H109ZM205 188H252L254 235H211M111 198H155M206 198H252"/>}
    {category==='Denim Pants'&&<path d="M116 84H142L138 101H115M219 84H244L245 101H222"/>}</>:
    <><path d="M115 83Q109 129 115 178M245 83Q252 129 245 178M110 326Q180 340 250 326M124 180Q119 240 125 292M236 177Q244 249 236 293"/>
     {back?<path d="M115 107Q180 123 245 107M180 122V146"/>:tee?<path d="M148 65Q180 108 212 65M145 67Q180 115 215 67"/>:
      <><path d="M148 65 157 99 180 80 202 99 212 65M180 81V149M185 99V149"/>
       {!polo&&<path d="M177 148V340M185 148V340M125 141H156V178Q140 190 125 178"/>}
       {(polo?[116,138]:[116,148,184,220,256,292,326]).map(y=><circle key={y} cx="181" cy={y} r="2" fill="#9d9585"/>)}</>}
     {!short&&<path d="M60 300 98 309M263 309 300 300"/>}
    </>}
  </g>
  {line&&<g stroke="#943f2e" strokeWidth="2" fill="none" markerStart={`url(#${id}-arrow)`} markerEnd={`url(#${id}-arrow)`}><path d={`M${line[0]} ${line[1]}L${line[2]} ${line[3]}`} strokeDasharray="5 4"/></g>}
  <text x="180" y="390" textAnchor="middle" fill="#625d53" fontSize="11" letterSpacing="2">{back?'BACK':'FRONT'} · LAID FLAT</text>
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
    <GarmentDiagram category={product.category} field={field} back={back}/>
    <figcaption>Illustrated measuring guide</figcaption>
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
