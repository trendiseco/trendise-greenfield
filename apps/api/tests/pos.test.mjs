import test from 'node:test';
import assert from 'node:assert/strict';
import {Commerce,canonicalPhone} from '../src/core.mjs';
import {restore,snapshot} from '../src/database.mjs';

test('store billing preserves prices, GST, customer history and exact restock across reloads', async () => {
 const app = new Commerce();
 app.clock = () => new Date('2026-11-13T05:00:00Z');
 const cashier = {role:'pos',locationId:'store-hyd-01',userId:'pos'};
 const admin = {role:'admin'};
 const superadmin = {role:'superadmin'};
 const product = app.products[0];
 const [variant, second] = product.variants;
 const {sku,barcode} = variant;
 variant.posPrice = 1500;
 assert.throws(() => app.savePosPromotion(cashier,{sku,type:'percent',value:10}),{status:403});
 app.savePosPromotion(superadmin,{sku,type:'percent',value:10});
 app.savePosPromotion(superadmin,{sku:second.sku,type:'fixed',value:1000});
 assert.equal(app.posInventory(cashier).products[0].variants[0].salePrice,1350);
 assert.equal(app.posInventory(cashier).products[0].variants[1].salePrice,1000);
 assert.equal(app.listing()[0].variants[0].posPrice,undefined);
 const body = {items:[{sku,qty:2},{sku:second.sku,qty:1}],paymentMethod:'Cash',expectedTotal:3700,idempotencyKey:'pos-complete-test'};
 await assert.rejects(app.completePosSale(cashier,body),{status:400});
 body.customer = {name:'Example Customer',phone:'+91 98765 43210'};
 await assert.rejects(app.completePosSale(cashier,{...body,expectedTotal:3701}),{status:409});
 const warehouseBefore = app.stock[sku]['warehouse-hyd'];
 const {sale} = await app.completePosSale(cashier,body);
 assert.equal(sale.customer.phone,'9876543210');
 assert.equal(sale.quote.total,3700);
 assert.equal(sale.quote.gst,176.19);
 assert.equal(sale.quote.taxable,3523.81);
 assert.ok(sale.terms.length);
 assert.deepEqual(await app.completePosSale(cashier,body),{sale,message:'Demo sale completed. No payment collected.'});
 assert.deepEqual(app.stock[sku],{'warehouse-hyd':warehouseBefore-2});

 const reloaded = new Commerce();
 restore(reloaded,structuredClone(snapshot(app)));
 reloaded.clock = app.clock;
 assert.equal(reloaded.purchaseHistory(admin,canonicalPhone('+91 98765 43210')).sales[0].id,sale.id);
 assert.throws(() => reloaded.purchaseHistory({role:'warehouse'},sale.customer.phone),{status:403});
 const input = {barcode,replacementBarcode:second.barcode,qty:1,reason:'Wrong size',sellable:true};
 await assert.rejects(reloaded.returnPosItem(cashier,sale.id,{...input,barcode:second.barcode+'X'},'wrong-barcode'),{status:400});
 await assert.rejects(reloaded.returnPosItem(cashier,sale.id,{...input,sellable:false},'no-inspection'),{status:400});
 const originalBalance=reloaded.available(sku);
 const replacementBalance=reloaded.stock[second.sku]['warehouse-hyd'];
 reloaded.stock[second.sku]['warehouse-hyd']=0;
 await assert.rejects(reloaded.returnPosItem(cashier,sale.id,input,'out-of-stock-exchange'),{status:409});
 assert.equal(reloaded.available(sku),originalBalance);
 assert.equal((reloaded.sales.get(sale.id).returns??[]).length,0);
 reloaded.stock[second.sku]['warehouse-hyd']=replacementBalance;
 const first = await reloaded.returnPosItem(cashier,sale.id,input,'return-part-one');
 assert.equal(first.return.refund,undefined);
 assert.equal(first.return.replacement.sku,second.sku);
 assert.deepEqual(await reloaded.returnPosItem(cashier,sale.id,input,'return-part-one'),first);
 const last = await reloaded.returnPosItem(cashier,sale.id,input,'return-part-two');
 assert.equal(last.return.status,'exchanged');
 assert.equal(reloaded.available(second.sku),7);
 assert.equal(reloaded.stock[sku]['warehouse-hyd'],warehouseBefore);
 await assert.rejects(reloaded.returnPosItem(cashier,sale.id,input,'return-too-many'),{status:409});
 for (const period of ['today','week','month','year']) {
  const dashboard = reloaded.posDashboard(cashier,period);
  assert.equal(dashboard.sales.length,1);
  assert.equal(dashboard.refunded,0);
  assert.equal(dashboard.net,3700);
 }
 reloaded.clock = () => new Date('2026-11-15T18:30:00Z');
 assert.equal(reloaded.posDashboard(cashier,'today').sales.length,0);
 assert.equal(reloaded.posDashboard(cashier,'week').sales.length,0);
 assert.equal(reloaded.posDashboard(cashier,'month').sales.length,1);
});

test('sample bills are repeat-safe and report by India calendar year without changing inventory', async () => {
 const app = new Commerce();
 const cashier = {role:'pos',locationId:'store-hyd-01',userId:'pos'};
 app.clock = () => new Date('2026-11-14T05:00:00Z');
 const stock = structuredClone(app.stock);
 assert.deepEqual(await app.seedPosExamples(cashier),{created:6,count:6});
 assert.deepEqual(await app.seedPosExamples(cashier),{created:0,count:6});
 assert.deepEqual(app.stock,stock);
 assert.deepEqual(app.posDashboard(cashier,'year').years,[2026,2025,2024]);
 assert.equal(app.posDashboard(cashier,'year','2025').sales.length,2);
 assert.equal(app.posDashboard(cashier,'year','2024').sales.length,1);
 const history = app.purchaseHistory(cashier,'9999900001');
 assert.equal(history.sales.length,6);
 const bill = history.sales.find(sale => sale.at.startsWith('2026'));
 await assert.rejects(app.returnPosItem(cashier,bill.id,{},'sample-return'),{status:409});
 assert.throws(() => app.posDashboard(cashier,'year','2027'),{status:400});
 app.sales.get(bill.id).at = '2025-12-31T18:30:00.000Z';
 assert.equal(app.posDashboard(cashier,'year','2025').sales.length,2);
 assert.equal(app.posDashboard(cashier,'year','2026').sales.length,3);
});

test('category visibility, scoped promotions and Excel prices control new sales',async()=>{
 const app=new Commerce();
 const superadmin={role:'superadmin'},admin={role:'admin'},cashier={role:'pos',locationId:'store-hyd-01'};
 const [product,other]=app.products;
 const [variant]=product.variants;
 await app.addCatalogCategory(superadmin,{name:'Jackets'});
 await app.updateCatalogCategory(superadmin,{name:'Jackets',action:'remove'});
 assert.ok(!app.catalogCategories().includes('Jackets'));
 await assert.rejects(app.updateCatalogCategory(superadmin,{name:product.category,action:'remove'}),{status:409});
 await app.updateCatalogCategory(superadmin,{name:product.category,action:'hide'});
 assert.ok(!app.listing().some(entry=>entry.category===product.category));
 assert.ok(!app.posInventory(cashier).products.some(entry=>entry.category===product.category));
 const body={items:[{sku:variant.sku,qty:1}],customer:{name:'Example',phone:'9999900001'},paymentMethod:'Cash',idempotencyKey:'bulk-pricing-test'};
 await assert.rejects(app.completePosSale(cashier,body),{status:409});
 await app.updateCatalogCategory(superadmin,{name:product.category,action:'show'});
 app.savePosPromotion(superadmin,{scope:'all',type:'percent',value:10});
 app.savePosPromotion(superadmin,{scope:'product',target:product.id,type:'percent',value:15});
 app.savePosPromotion(superadmin,{scope:'category',target:other.category,type:'percent',value:20});
 assert.equal(app.posPromotions[variant.sku].value,20);
 const row={sku:variant.sku,barcode:variant.barcode,price:999};
 assert.throws(()=>app.importPosPrices(admin,[row]),{status:403});
 assert.throws(()=>app.importPosPrices(superadmin,[row,{...row,barcode:'wrong'}]),{status:400});
 assert.equal(variant.posPrice,undefined);
 assert.equal(app.importPosPrices(superadmin,[row]).updated,1);
 assert.equal(app.posInventory(cashier).products[0].variants[0].salePrice,999);
 assert.equal(app.listing()[0].variants[0].price,1499);
 assert.equal((await app.completePosSale(cashier,body)).sale.quote.total,999);
 assert.equal(app.posDashboard(admin,'fiveYears',null,true).gross,999);
});

test('admin purchase extract filters all customers by channel and inclusive India dates',async()=>{
 const app=new Commerce();
 const admin={role:'admin'},superadmin={role:'superadmin'};
 app.sales.set('POS-1',{at:'2026-11-13T18:30:00Z',customer:{phone:'9999900001'}});
 app.sales.set('POS-2',{at:'2026-11-14T18:29:59Z',customer:{phone:'9999900002'}});
 app.sales.set('POS-3',{at:'2026-11-14T18:30:00Z'});
 app.orders.set('TRD-1',{id:'TRD-1',placedAt:'2026-11-14T10:00:00Z',phone:'9999900003',items:[],quote:{total:100}});
 const dates={from:'2026-11-14',to:'2026-11-14'};
 const sales=app.purchaseExtract(admin,{...dates,channel:'sales'});
 assert.deepEqual(sales.sales.map(sale=>sale.customer.phone),['9999900002','9999900001']);
 assert.equal(sales.orders.length,0);
 const orders=app.purchaseExtract(superadmin,{...dates,channel:'orders'});
 assert.equal(orders.sales.length,0);
 assert.equal(orders.orders[0].phone,'9999900003');
 assert.throws(()=>app.purchaseExtract({role:'pos'},{...dates,channel:'sales'}),{status:403});
 assert.throws(()=>app.purchaseExtract(admin,{...dates,to:'2026-11-31',channel:'sales'}),{status:400});
});

test('POS checks the original product before quoting and recording an alternate exchange',async()=>{
 const c=new Commerce(),cashier={role:'pos',locationId:'store-hyd-01',userId:'pos'};
 const [original,expensive,,,,,,cheap]=c.products;
 const [item]=original.variants,[upgrade]=expensive.variants,[lowerPrice,addOn]=cheap.variants;
 const {sale}=await c.completePosSale(cashier,{
  items:[{sku:item.sku,qty:1}],customer:{name:'Example Customer',phone:'9876543210'},
  paymentMethod:'Cash',idempotencyKey:'pos-alternate-original',
 });
 const input={barcode:item.barcode,qty:1,sellable:true,reason:'Wrong size',replacementBarcode:upgrade.barcode};
 const call=(overrides,key)=>c.returnPosItem(cashier,sale.id,{...input,...overrides},key);
 await assert.rejects(call({action:'quote'}),/original product first/);
 for(const variant of original.variants)c.stock[variant.sku]['warehouse-hyd']=0;
 assert.equal((await call({action:'quote'})).difference,300);
 assert.equal((await call({action:'quote',replacementBarcode:lowerPrice.barcode})).shortfall,700);
 const basket={replacementBarcode:lowerPrice.barcode,addOnBarcode:addOn.barcode};
 assert.equal((await call({...basket,action:'quote'})).difference,99);
 await assert.rejects(call({...basket,expectedDifference:0},'pos-alternate-stale'),/updated exchange price/);
 assert.equal(c.available(item.sku),0);
 const paid={...basket,expectedDifference:99,paymentMethod:'Cash'};
 const completed=await call(paid,'pos-alternate-paid');
 assert.deepEqual(completed.return.payment,{method:'Cash',status:'simulated',amount:99});
 assert.deepEqual(await call(paid,'pos-alternate-paid'),completed);
 assert.equal(c.available(item.sku),1);
 assert.equal(c.available(lowerPrice.sku),9);
 assert.equal(c.available(addOn.sku),9);
 assert.equal(c.posDashboard(cashier,'today').net,1598);
});
