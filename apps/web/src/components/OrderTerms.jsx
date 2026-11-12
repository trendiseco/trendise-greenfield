import {policySections} from '../../../../shared/order-policy.mjs';
export default function OrderTerms({policy}){
 return <><div className="eyebrow">{policy?.version||'TRENDISE'} / DEVELOPMENT POLICY{policy?.effectiveDate&&<> · Effective {policy.effectiveDate}</>}</div>{(policy?.sections??policySections).map(([title,...paragraphs])=><section className="policy-section" key={title}><h3>{title}</h3>{paragraphs.length===1?<p>{paragraphs[0]}</p>:<ul>{paragraphs.map(p=><li key={p}>{p}</li>)}</ul>}</section>)}{policy?.text?.length>0&&<section className="policy-section"><h3>Additional store terms</h3><ul>{policy.text.map((t,i)=><li key={i}>{t}</li>)}</ul></section>}</>;
}
