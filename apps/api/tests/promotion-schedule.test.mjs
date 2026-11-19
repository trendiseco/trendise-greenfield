import test from 'node:test';
import assert from 'node:assert/strict';
import {Commerce} from '../src/core.mjs';
import {snapshot,restore} from '../src/database.mjs';
const admin={role:'admin'};
test('website promotion dates apply inclusively in IST to listing and checkout and survive restart',()=>{
 const core=new Commerce(),variant=core.products[0].variants[0],sku=variant.sku,regular=variant.price;
 core.savePosPromotion(admin,{sku,type:'percent',value:10,start:'2026-12-01',end:'2026-12-02'},true);
 const verify=(time,discounted)=>{core.clock=()=>new Date(time);const expected=discounted?Math.round(regular*90)/100:regular;assert.equal(core.websitePriceFields(variant).price,expected);assert.equal(core.onlineQuote({role:'customer',phone:'9876543210'},{items:[{sku,qty:1}]}).items[0].unitPrice,expected);};
 verify('2026-11-30T18:29:59.999Z',false);verify('2026-11-30T18:30:00Z',true);verify('2026-12-02T18:29:59.999Z',true);verify('2026-12-02T18:30:00Z',false);
 assert.equal(core.posPricing(variant).salePrice,regular);
 const restored=new Commerce();restore(restored,structuredClone(snapshot(core)));restored.clock=()=>new Date('2026-12-01T00:00:00Z');
 assert.equal(restored.posPromotionList(admin,true)[sku].rule.start,'2026-12-01');
 assert.equal(restored.posPromotionList(admin,true)[sku].salePrice,Math.round(regular*90)/100);
});
test('bulk prices retain schedules and changing only dates reschedules an offer atomically',()=>{
 const core=new Commerce(),v=core.products[0].variants[0],row={sku:v.sku,barcode:v.barcode,price:999,start:'2026-12-01',end:'2026-12-02'};
 core.clock=()=>new Date('2026-11-19T00:00:00Z');
 assert.equal(core.importPosPrices(admin,[row],true).updated,1);assert.equal(core.websitePriceFields(v).price,v.price);
 assert.equal(core.importPosPrices(admin,[row],true).updated,0);
 assert.equal(core.importPosPrices(admin,[{...row,start:'2026-11-01',end:'2026-11-30'}],true).updated,1);
 assert.equal(core.websitePriceFields(v).price,999);
 const before=structuredClone(core.website.promotions);
 assert.throws(()=>core.importPosPrices(admin,[{...row,price:888},{...row,sku:core.products[0].variants[1].sku,barcode:core.products[0].variants[1].barcode,end:'2026-02-30'}],true),{status:400});
 assert.equal(JSON.stringify(core.website.promotions),JSON.stringify(before));
 core.importPosPrices(admin,[{...row,price:v.price}],true);assert.equal(core.website.promotions[v.sku],undefined);
});
test('invalid dates reject all scopes before replacing existing promotions; legacy undated prices still work',()=>{
 const core=new Commerce(),v=core.products[0].variants[0];
 for(const dates of [{start:'2026-02-30'},{start:'2026-12-02',end:'2026-12-01'},{end:42}])assert.throws(()=>core.savePosPromotion(admin,{scope:'all',type:'percent',value:10,...dates},true),{status:400});
 core.savePosPromotion(admin,{sku:v.sku,type:'fixed',value:999},true);
 assert.equal(core.websitePriceFields(v).price,999);
});
