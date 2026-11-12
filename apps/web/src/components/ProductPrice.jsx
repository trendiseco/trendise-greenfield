'use client';
import {cash} from '../lib/api';
import {useSite} from './SiteProvider';
import {productOffer} from '../../../../shared/product-offer.mjs';
export default function ProductPrice({price}){
 const {coupons}=useSite(),offer=productOffer(price,coupons);
 if(!offer)return <span className="catalog-price">{cash(price)}</span>;
 return <span className="catalog-price catalog-price-offer"><span className="catalog-price-values"><del aria-label={`Regular price ${cash(price)}`}>{cash(price)}</del><strong>{cash(offer.total)}</strong></span><span className="catalog-price-note">Save {cash(offer.discount)} with {offer.code}</span><span className="catalog-price-terms">Auto-selected at checkout · eligibility & limits apply</span></span>;
}
