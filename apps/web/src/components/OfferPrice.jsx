import {cash} from '../lib/api';
export default function OfferPrice({quote}){
 const original=Number(quote.subtotal)+Number(quote.shipping||0),total=Number(quote.total),saving=Math.round((original-total)*100)/100;
 if(!(saving>0))return <strong>{cash(total)}</strong>;
 return <span className="offer-price"><span className="offer-price-values"><del aria-label={`Original total ${cash(original)}`}>{cash(original)}</del><strong aria-label={`Discounted total ${cash(total)}`}>{cash(total)}</strong></span><span className="offer-price-saving">You save {cash(saving)}{quote.couponDiscount>0&&quote.coupon?` · ${quote.coupon}`:''}</span></span>;
}
