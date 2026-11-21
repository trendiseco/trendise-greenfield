import test from 'node:test';
import assert from 'node:assert/strict';
import {Commerce} from '../src/core.mjs';
import {snapshot,restore} from '../src/database.mjs';
import {receiptLines} from '../../../shared/pos-receipt.mjs';

test('receipt details are permission guarded, validated, persisted and frozen per saved bill',async()=>{
 const core=new Commerce(),staff={role:'pos',userId:'pos'},superadmin={role:'superadmin'};
 assert.throws(()=>core.savePosTerms(staff,'Keep receipt',{businessName:'Example'}),{status:403});
 core.savePosTerms(superadmin,'Keep original tags',{businessName:'TRENDISE Test',address:'Example store address',accountNumber:'001234'});
 const v=core.products[0].variants[0];
 const {sale}=await core.completePosSale(staff,{items:[{sku:v.sku,qty:2}],customer:{name:'Example Buyer',phone:'9999900001'},paymentMethod:'Cash',idempotencyKey:'receipt-layout-test'});
 assert.equal(sale.receipt.businessName,'TRENDISE Test');
 core.savePosTerms(superadmin,'Updated notes',{businessName:'Updated store'});
 assert.equal(core.sales.get(sale.id).receipt.businessName,'TRENDISE Test');
 assert.match(core.sales.get(sale.id).terms,/Keep original tags/);
 const restored=new Commerce();restore(restored,structuredClone(snapshot(core)));
 assert.equal(restored.posReceipt.businessName,'Updated store');
 assert.equal(restored.sales.get(sale.id).receipt.accountNumber,'001234');
 assert.throws(()=>core.savePosTerms(superadmin,'Wrong terms',{gstin:'bad'}),{status:400});
 assert.equal(core.posTerms,'Updated notes');
 core.savePosTerms(superadmin,'Terms only');assert.equal(core.posReceipt.businessName,'Updated store');
});
test('thermal line figures reconcile to saved GST-inclusive totals; older bills do not invent tax',()=>{
 const sale={items:[{sku:'A',qty:1,unitPrice:549,lineTotal:549,gst:26.14},{sku:'B',qty:2,unitPrice:899,lineTotal:1798,gst:85.62}]};
 const lines=receiptLines(sale);
 assert.equal(lines[0].taxable,522.86);assert.equal(lines[0].netUnit,522.86);
 assert.equal(lines[1].taxable,1712.38);assert.equal(lines[1].netUnit,856.19);
 assert.equal(Math.round(lines.reduce((n,l)=>n+l.taxable+l.gst,0)*100),234700);
 assert.equal(receiptLines({items:[{qty:1,lineTotal:100,unitPrice:100} ]})[0].taxable,null);
});
