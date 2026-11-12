import test from 'node:test';
import assert from 'node:assert/strict';
import {productOffer} from '../../../shared/product-offer.mjs';
test('product coupon price respects minimum, cap, rounding and single best offer',()=>{
 const welcome={code:'WELCOME10',type:'percent',value:10,minOrder:0,maxDiscount:0};
 assert.deepEqual(productOffer(1499,[welcome]),{code:'WELCOME10',discount:149.9,total:1349.1});
 assert.equal(productOffer(999,[{...welcome,minOrder:1000}]),null);
 assert.equal(productOffer(1499,[welcome,{...welcome,code:'CAP',value:30,maxDiscount:200}]).discount,200);
 assert.equal(productOffer(100,[{...welcome,type:'fixed',value:500}]).total,0);
 assert.equal(productOffer(100,[]),null);
});
