export default function PurchaseChannel({channel,onChange,disabled=false}) {
 return <nav aria-label="Purchase channel" className="cms-tabs">
  {[['sales','Store POS'],['orders','Website']].map(([value,label])=><button
   key={value} type="button" disabled={disabled} aria-pressed={channel===value}
   className={channel===value?'button button-dark':'button button-outline'}
   onClick={()=>onChange(value)}>{label}</button>)}
 </nav>;
}
