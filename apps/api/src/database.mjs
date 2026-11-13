import {policyDocument,policyEffectiveDate,policyRulesVersion} from '../../../shared/order-policy.mjs';
import pg from 'pg';
import {upgradeSizeChart} from '../../../shared/size-chart.mjs';
import {websiteState} from './website.mjs';
import {isDeepStrictEqual} from 'node:util';
import { readFile } from 'node:fs/promises';
import { Commerce } from './core.mjs';
const maps=['reservations','orders','sales','sessions','otpRequests','eventIds'];
const fields=['products','locations','stock','ledger','audit','drafts','approvals','roles','users','website','additionalCategories','posPromotions','policy','version','policyHistory'];
const projectionKeys=[...fields.filter(key=>!['additionalCategories','posPromotions','policy','version','policyHistory'].includes(key)),...maps.filter(key=>!['sessions','otpRequests'].includes(key))];
export function snapshot(core){return Object.fromEntries([...fields.map(k=>[k,core[k]]),...maps.map(k=>[k,[...core[k]]])]);}
export function restore(core,data){for(const k of fields)if(data[k]!==undefined)core[k]=data[k];core.additionalCategories=data.additionalCategories??[];core.posPromotions=data.posPromotions??{};core.policyHistory={...(data.policyHistory||{})};core.policyHistory[core.version]??=policyDocument(core.policy);if(core.policy.rulesVersion!==policyRulesVersion){core.version+='-R'+policyRulesVersion;core.policy={...core.policy,version:core.version,rulesVersion:policyRulesVersion,effectiveDate:policyEffectiveDate};delete core.policy.sections;}core.policyHistory[core.version]??=policyDocument(core.policy);core.website=data.website||websiteState();core.products=core.products.map(upgradeSizeChart);for(const d of Object.values(core.drafts))d.product=upgradeSizeChart(d.product);for(const k of maps)core[k]=new Map(data[k]);}
export function poolFor(url=process.env.DATABASE_URL){if(!url)throw new Error('DATABASE_URL required. Run npm run db:migrate and db:seed. Memory mode requires explicit ALLOW_MEMORY=true.');return new pg.Pool({connectionString:url,max:5});}
export async function migrate(pool){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(8291042)');await c.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');for(const version of ['001_m02','002_website']){const done=await c.query('SELECT 1 FROM schema_migrations WHERE version=$1',[version]);if(!done.rowCount){await c.query(await readFile(new URL('../migrations/'+version+'.sql',import.meta.url),'utf8'));await c.query('INSERT INTO schema_migrations(version) VALUES ($1)',[version]);}}await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function project(c,core){
 // Development projection is rebuilt under the same database transaction and lock.
 await c.query('DELETE FROM inventory; DELETE FROM variants; DELETE FROM products; DELETE FROM locations; DELETE FROM staff_users; DELETE FROM staff_roles; DELETE FROM reservations; DELETE FROM orders; DELETE FROM pos_sales; DELETE FROM catalog_drafts; DELETE FROM approval_history; DELETE FROM stock_ledger; DELETE FROM audit_events; DELETE FROM idempotency_records');
 for(const p of core.products){await c.query('INSERT INTO products VALUES($1,$2,$3)',[p.id,p.slug,p]);for(const v of p.variants)await c.query('INSERT INTO variants VALUES($1,$2,$3,$4,$5)',[v.sku,p.id,v.barcode,v.price,v]);}
 for(const l of core.locations)await c.query('INSERT INTO locations VALUES($1,$2)',[l.id,l]);
 for(const [sku,balances] of Object.entries(core.stock))for(const [loc,qty]of Object.entries(balances))await c.query('INSERT INTO inventory VALUES($1,$2,$3)',[sku,loc,qty]);
 for(const [name,permissions]of Object.entries(core.roles))await c.query('INSERT INTO staff_roles VALUES($1,$2)',[name,JSON.stringify(permissions)]);
 for(const u of core.users)await c.query('INSERT INTO staff_users VALUES($1,$2,$3)',[u.id,u.role,u]);
 for(const [table,key]of [['reservations','reservations'],['orders','orders'],['pos_sales','sales'],['idempotency_records','eventIds']])for(const [id,doc]of core[key])await c.query(`INSERT INTO ${table} VALUES($1,$2)`,[id,doc]);
 for(const [id,d]of Object.entries(core.drafts))await c.query('INSERT INTO catalog_drafts VALUES($1,$2,$3,$4)',[id,d.revision,d.status,d]);
 for(const item of core.ledger)await c.query('INSERT INTO stock_ledger VALUES($1,$2)',[item.id,item]);
 await c.query('DELETE FROM website_settings; DELETE FROM website_coupons; DELETE FROM customer_profiles; DELETE FROM loyalty_ledger; DELETE FROM coupon_redemptions; DELETE FROM website_media');
 const w=core.website;await c.query('INSERT INTO website_settings VALUES(1,$1)',[w]);
 for(const coupon of w.coupons)await c.query('INSERT INTO website_coupons VALUES($1,$2)',[coupon.code,coupon]);
 for(const customer of Object.values(w.customers))await c.query('INSERT INTO customer_profiles VALUES($1,$2,$3)',[customer.phone,customer.points,customer]);
 for(const l of w.rewardLedger)await c.query('INSERT INTO loyalty_ledger VALUES($1,$2)',[l.id,l]);
 for(const u of w.couponUses)await c.query('INSERT INTO coupon_redemptions VALUES($1,$2)',[u.id,u]);
 for(const [id,m]of Object.entries(w.media))await c.query('INSERT INTO website_media VALUES($1,$2)',[id,m]);
 for(const [table,key]of [['approval_history','approvals'],['audit_events','audit']])for(const [i,doc]of core[key].entries())await c.query(`INSERT INTO ${table} VALUES($1,$2)`,[i,doc]);
}
export async function seed(pool){const c=await pool.connect();try{await c.query('BEGIN');const core=new Commerce();const r=await c.query('INSERT INTO commerce_state(id,payload) VALUES(1,$1) ON CONFLICT DO NOTHING RETURNING id',[snapshot(core)]);if(r.rowCount)await project(c,core);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export class DurableCommerce extends Commerce {
 constructor(pool){super();this.pool=pool;this.requestQueue=Promise.resolve();}
 async unit(fn,{readOnly=false}={}){const previous=this.requestQueue;let release;this.requestQueue=new Promise(r=>release=r);await previous;let c;let before;
 try{c=await this.pool.connect();await c.query(readOnly?'BEGIN READ ONLY':'BEGIN');const r=await c.query('SELECT payload FROM commerce_state WHERE id=1'+(readOnly?'':' FOR UPDATE'));if(!r.rowCount)throw new Error('Run db:seed before starting API');restore(this,r.rows[0].payload);if(!readOnly)before=structuredClone(snapshot(this));const result=await fn();if(!readOnly){
  const after=snapshot(this);
  if(projectionKeys.some(key=>!isDeepStrictEqual(before[key],after[key])))await project(c,this);
  if(!isDeepStrictEqual(before,after))await c.query('UPDATE commerce_state SET payload=$1,updated_at=now() WHERE id=1',[after]);
 }await c.query('COMMIT');return result;}catch(e){if(c)await c.query('ROLLBACK');if(before)restore(this,before);throw e;}finally{c?.release();release();}}
}
