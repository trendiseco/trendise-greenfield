import test from 'node:test';
import assert from 'node:assert/strict';
import {Commerce} from '../src/core.mjs';
const admin={role:'admin',userId:'admin'},superadmin={role:'superadmin',userId:'superadmin'};
const product=()=>({name:'Mock Shirt',slug:'mock-shirt',category:'Shirts',description:'Fictional sample',fabric:'Cotton',fit:'Regular',variants:[{sku:'MOCK-M',barcode:'MOCKBAR-M',color:'Blue',size:'M',price:999}]});
test('catalog draft privacy, approval permissions and Super Admin self-approval',async()=>{
 const c=new Commerce(),p=product(),d=await c.saveDraft(admin,p);assert.equal(c.listing().length,8);assert.equal(d.status,'draft');
 await assert.rejects(c.decideDraft(superadmin,d.product.id,{revision:1,action:'publish'}),{status:409});
 await c.submitDraft(admin,d.product.id,1);await assert.rejects(c.decideDraft(admin,d.product.id,{revision:1,action:'publish'}),{status:403});
 await c.decideDraft(superadmin,d.product.id,{revision:1,action:'publish'});assert.equal(c.listing().length,9);assert.equal(c.available('MOCK-M'),0);
 const edit=await c.saveDraft(superadmin,{...d.product,name:'Revised',revision:1});
 assert.equal(c.listing().at(-1).name,'Mock Shirt');
 await c.submitDraft(superadmin,d.product.id,edit.revision);
 await assert.rejects(c.decideDraft(superadmin,d.product.id,{revision:1,action:'publish'}),{status:409});
 await c.decideDraft(superadmin,d.product.id,{revision:edit.revision,action:'publish'});
 assert.equal(c.listing().at(-1).name,'Revised');
 assert.equal(c.approvals.at(-1).actor,superadmin.userId);
 const rejected=await c.saveDraft(admin,{...edit.product,name:'Rejected',revision:edit.revision});
 await c.submitDraft(admin,d.product.id,rejected.revision);
 await c.decideDraft(superadmin,d.product.id,{revision:rejected.revision,action:'reject'});
 assert.equal(c.listing().at(-1).name,'Revised');
});
test('mandatory unique variant barcodes, permanent identities and revision conflicts',async()=>{
 const c=new Commerce();await assert.rejects(c.saveDraft(admin,{...product(),variants:[{...product().variants[0],barcode:''}]}),{code:'BARCODE_REQUIRED'});
 await assert.rejects(c.saveDraft(admin,{...product(),variants:[{...product().variants[0],barcode:c.products[0].variants[0].barcode}]}),{status:409});
 const d=await c.saveDraft(admin,product());await assert.rejects(c.saveDraft(admin,{...d.product,revision:0}),{status:409});
 await assert.rejects(c.saveDraft(admin,{...c.products[0],variants:[]}),{status:400});
 await assert.rejects(c.saveDraft(admin,{...c.products[0],variants:c.products[0].variants.map((v,i)=>i? v:{...v,barcode:'CHANGED'})}),{status:409});
});
test('image type, size and alternative text validated',async()=>{
 const c=new Commerce();await assert.rejects(c.saveDraft(admin,{...product(),images:[{src:'https://example.com/x.png',alt:'test'}]}),{status:400});
 await assert.rejects(c.saveDraft(admin,{...product(),images:[{src:'data:image/png;base64,YWJj',alt:'test'}]}),{status:400});
 const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const d=await c.saveDraft(admin,{...product(),images:[{src,alt:'Fictional shirt'}]});assert.equal(d.product.images[0].src,src);
});
test('RBAC changes and disabled users revoke active session privileges',async()=>{
 const c=new Commerce(),login=c.staffLogin('admin','1234');await assert.rejects(c.saveUser(admin,{id:'x'}),{status:403});
 await c.saveRole(superadmin,{name:'editor',permissions:['catalog.edit']});await c.saveUser(superadmin,{id:'editor1',name:'Editor',role:'editor',active:true,locationId:'warehouse-hyd'});
 const e=c.staffLogin('editor','1234','editor1');await c.saveDraft(c.session(e.token),product());await assert.rejects(c.submitDraft(c.session(e.token),'bad',1),{status:403});
 await c.saveUser(superadmin,{...c.users.find(u=>u.id==='admin'),active:false});assert.throws(()=>c.session(login.token),{status:401});
 await assert.rejects(c.saveRole(superadmin,{name:'editor',permissions:['*']}),{status:400});await assert.rejects(c.saveUser(superadmin,{...c.users[1],active:false}),{status:409});
});
test('transfers preserve totals, reject oversell, replay safely and protect held stock',async()=>{
 const c=new Commerce(),sku=c.products[0].variants[0].sku;const body={sku,from:'store-hyd-01',to:'warehouse-hyd',qty:4,key:'transfer-one'};
 const results=await Promise.allSettled([c.moveStock(superadmin,body),c.moveStock(superadmin,{...body,key:'transfer-two'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(c.available(sku),10);assert.equal(c.stock[sku]['store-hyd-01'],0);await c.moveStock(superadmin,body);assert.equal(c.ledger.length,2);
 await assert.rejects(c.moveStock(admin,body),{status:403});
});
test('newly published product can receive shared mock stock with audited, idempotent receipt',async()=>{
 const c=new Commerce();const d=await c.saveDraft(admin,product());await c.submitDraft(admin,d.product.id,1);await c.decideDraft(superadmin,d.product.id,{revision:1,action:'publish'});
 const body={sku:'MOCK-M',locationId:'warehouse-hyd',qty:8,key:'receipt-test',reason:'Mock opening stock'};await c.receiveStock(superadmin,body);await c.receiveStock(superadmin,body);assert.equal(c.available('MOCK-M'),8);assert.equal(c.ledger.length,1);await assert.rejects(c.receiveStock(admin,body),{status:403});
});

test('Super Admin creates categories for product drafts and legacy products remain selectable',async()=>{
 const core=new Commerce();
 const admin={role:'admin',userId:'admin'},superadmin={role:'superadmin',userId:'superadmin'};
 assert.ok(core.catalogCategories().includes('Shirts'));
 await assert.rejects(core.addCatalogCategory(admin,{name:'Jackets'}),{status:403});
 await assert.rejects(core.saveDraft(admin,{...product(),category:'Jackets'}),{status:400});
 assert.ok((await core.addCatalogCategory(superadmin,{name:' Jackets '})).includes('Jackets'));
 await assert.rejects(core.addCatalogCategory(superadmin,{name:'jackets'}),{status:409});
 const draft=await core.saveDraft(admin,{...product(),category:'Jackets',variants:[{...product().variants[0],barcode:'0012345678905'}]});
 assert.equal(draft.product.variants[0].barcode,'0012345678905');
 const restored=new Commerce();
 const {snapshot,restore}=await import('../src/database.mjs');
 restore(restored,structuredClone(snapshot(core)));
 assert.ok(restored.catalogCategories().includes('Jackets'));
});

test('product drafts generate unique slugs and preserve the assigned URL when renamed',async()=>{
 const core=new Commerce(),admin={role:'admin',userId:'admin'};
 const {slug:ignored,...input}=product();
 const first=await core.saveDraft(admin,{...input,name:'Café Linen Shirt'});
 const second=await core.saveDraft(admin,{...input,name:'Café Linen Shirt',variants:[{...input.variants[0],sku:'OTHER-M',barcode:'OTHER-M'}]});
 assert.equal(first.product.slug,'cafe-linen-shirt');
 assert.equal(second.product.slug,'cafe-linen-shirt-2');
 assert.equal(first.product.swatch,'#acc3d0');
 const renamed=await core.saveDraft(admin,{...first.product,name:'Renamed Shirt',revision:first.revision});
 assert.equal(renamed.product.slug,first.product.slug);
});
