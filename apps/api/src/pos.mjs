import {centralWarehouseId} from './seed.mjs';
import {posExchangeTerms,returnMs} from '../../../shared/order-policy.mjs';
import {randomUUID} from 'node:crypto';
import {DomainError} from './errors.mjs';

const cents = value => Math.round(value * 100);
const rupees = value => value / 100;
const periods = ['today', 'week', 'month', 'year', 'fiveYears'];

export function periodStart(period, now) {
  const date = new Date(now + 19800000);
  date.setUTCHours(0, 0, 0, 0);
  if (period === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (period === 'month' || period === 'year') date.setUTCDate(1);
  if (period === 'year') date.setUTCMonth(0);
  if (period === 'fiveYears') date.setUTCFullYear(date.getUTCFullYear()-5);
  return date.getTime() - 19800000;
}

function purchaseOrder(order) {
  return {id:order.id,at:order.placedAt,name:order.address?.name,phone:order.phone,status:order.status,
    items:order.items.map(({name,sku,color,size,qty,unitPrice})=>({name,sku,color,size,qty,unitPrice})),
    total:order.quote.total,payment:order.payment?.method};
}

function indiaMidnight(date) {
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return NaN;
  const utc=Date.parse(date+'T00:00:00Z');
  return Number.isFinite(utc)&&new Date(utc).toISOString().slice(0,10)===date?utc-19800000:NaN;
}

export const posMethods = {
  posLocation(session) {
    const location = this.locations.find(entry => entry.id === (session.locationId || 'store-hyd-01') && entry.type === 'store');
    if (!location) throw new DomainError(403, 'A store assignment is required');
    return location;
  },

  posPricing(variant, online=false) {
    const regular = cents(online?variant.price:variant.posPrice ?? variant.price);
    const rule = (online?this.website.promotions:this.posPromotions)?.[variant.sku];
    const sale = rule?.type === 'fixed' ? Math.min(regular, cents(rule.value))
      : rule?.type === 'percent' ? Math.max(1, Math.round(regular * (100 - rule.value) / 100)) : regular;
    return {regularPrice: rupees(regular), salePrice: rupees(sale)};
  },

  posInventory(session) {
    this.permit(session,'pos.read');
    const location = this.posLocation(session);
    const products = this.listing('store').map(product => ({
      ...product,
      variants: product.variants.filter(variant => variant.active !== false).map(variant => ({
        ...variant, ...this.posPricing(variant)
      }))
    }));
    return {products, locationId: location.id, locationName: location.name};
  },

  posQuote(lines, priceFor = variant => this.posPricing(variant)) {
    const items = lines.map(({sku, qty}) => {
      const {product, variant} = this.product(sku);
      const {regularPrice, salePrice} = priceFor(variant);
      const unit = cents(salePrice);
      const gross = unit * qty;
      const gst = Math.round(gross * 5 / 105);
      return {sku, qty, name: product.name, barcode: variant.barcode, size: variant.size, color: variant.color,
        regularPrice, unitPrice: rupees(unit), lineTotal: rupees(gross), gst: rupees(gst)};
    });
    const subtotal = items.reduce((sum, item) => sum + cents(item.regularPrice) * item.qty, 0);
    const total = items.reduce((sum, item) => sum + cents(item.lineTotal), 0);
    const gst = items.reduce((sum, item) => sum + cents(item.gst), 0);
    return {items, subtotal: rupees(subtotal), discount: rupees(subtotal - total), total: rupees(total),
      gst: rupees(gst), taxable: rupees(total - gst), gstRate: 5, currency: 'INR', shipping: 0, coupon: null};
  },

  posPromotionList(session, online=false) {
    this.permit(session,online?'offers.pricing.read':'pos.pricing.read');
    return Object.fromEntries(this.products.flatMap(product => product.variants.map(variant => [
      variant.sku, {productId:product.id, name:product.name, category:product.category, barcode:variant.barcode,
        color:variant.color, size:variant.size, active:variant.active!==false, websitePrice:variant.price, storePrice:variant.posPrice??variant.price,
        onHand:this.stock[variant.sku]?.[centralWarehouseId]??0, ...this.posPricing(variant), rule:this.posPromotions[variant.sku] ?? null}
    ])));
  },

  savePosPromotion(session, {sku, scope='variant', target, type, value}, online=false) {
    this.permit(session,online?'offers.promotions':'pos.promotions');
    const catalog = this.posPromotionList(session,online);
    if (!['variant','product','category','all'].includes(scope)) throw new DomainError(400,'Choose a promotion scope');
    const entries = Object.entries(catalog).filter(([key,entry]) =>
      scope==='all'||(scope==='variant'&&key===sku)||(scope==='product'&&entry.productId===target)||(scope==='category'&&entry.category===target));
    if (!entries.length) throw new DomainError(400,'Choose a scope with published variants');
    if (type!=='none' && (!['percent','fixed'].includes(type)||!Number.isFinite(value)||cents(value)<1||
      (type==='percent'&&cents(value)>=10000)||(type==='fixed'&&entries.some(([,entry])=>cents(value)>cents(entry.regularPrice))))) {
      throw new DomainError(400,'Use a discount below 100% or a flat price at or below every selected regular price');
    }
    const promotions=online?(this.website.promotions??=Object.create(null)):this.posPromotions;
    for (const [key] of entries) {
      if (type==='none') delete promotions[key];
      else promotions[key]={type,value:rupees(cents(value))};
    }
    this.event(session,online?'WEBSITE_PROMOTION_UPDATED':'POS_PROMOTION_UPDATED',target||sku||scope);
    return this.posPromotionList(session,online);
  },

  importPosPrices(session, rows, online=false) {
    this.permit(session,online?'offers.prices':'pos.prices');
    const catalog = this.posPromotionList(session,online);
    if (!Array.isArray(rows)||!rows.length||rows.length>10000) throw new DomainError(400,'Upload 1 to 10,000 price rows');
    const seen=new Set();
    const changes=rows.map((row,index)=>{
      const {sku,barcode,price}=row??{};
      if (!Object.hasOwn(catalog,sku)||catalog[sku].barcode!==barcode||seen.has(sku)||typeof price!=='number'||
        !Number.isFinite(price)||price<0.01||price>1000000||(online&&cents(price)>cents(catalog[sku].regularPrice))) throw new DomainError(400,`Excel row ${index+2}: check SKU, barcode, duplicate rows and price`);
      seen.add(sku);
      return {sku,price:rupees(cents(price))};
    });
    let updated=0;
    for (const {sku,price} of changes) {
      if (price===catalog[sku].salePrice) continue;
      if(online){
        const promotions=this.website.promotions??=Object.create(null);
        if(price===catalog[sku].regularPrice)delete promotions[sku];
        else promotions[sku]={type:'fixed',value:price};
        updated++;
        continue;
      }
      const {product,variant}=this.product(sku);
      variant.posPrice=price;
      const draft=this.drafts[product.id];
      const draftVariant=draft?.product.variants.find(entry=>entry.sku===sku);
      if(draftVariant)draftVariant.posPrice=price;
      delete this.posPromotions[sku];
      updated++;
    }
    if(updated)this.event(session,online?'WEBSITE_PRICES_IMPORTED':'POS_PRICES_IMPORTED',String(updated));
    return {updated,catalog:this.posPromotionList(session,online)};
  },

  posDashboard(session, period, year = null, allStores = false) {
    this.permit(session,allStores?'reports.read':'pos.report');
    const location = allStores ? null : this.posLocation(session);
    if (!periods.includes(period)) throw new DomainError(400, 'Choose a reporting period');
    const now = this.orderNow();
    const currentYear = new Date(now + 19800000).getUTCFullYear();
    if (year !== null && (period !== 'year' || !/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > currentYear)) {
      throw new DomainError(400, 'Choose a valid calendar year');
    }
    const selectedYear = year === null ? currentYear : Number(year);
    const start = year === null ? periodStart(period, now) : Date.UTC(selectedYear, 0, 1) - 19800000;
    const end = Math.min(now + 1, Date.UTC(selectedYear + 1, 0, 1) - 19800000);
    const inPeriod = at => Date.parse(at) >= start && Date.parse(at) < end;
    const storeSales = [...this.sales.values()].filter(sale => !location || sale.locationId === location.id);
    const sales = storeSales.filter(sale => inPeriod(sale.at)).sort((a,b) => b.at.localeCompare(a.at));
    const years = [...new Set([currentYear, ...storeSales.flatMap(sale => [sale.at, ...(sale.returns || []).map(entry => entry.at)])
      .map(at => new Date(Date.parse(at) + 19800000).getUTCFullYear()).filter(value => value <= currentYear)])].sort((a,b) => b-a);
    const gross = sales.reduce((sum, sale) => sum + cents(sale.quote.total), 0);
    const exchanges=storeSales.flatMap(sale=>sale.returns||[]).filter(entry=>inPeriod(entry.at));
    const refunded=exchanges.reduce((sum,entry)=>sum+cents(entry.refund??0),0);
    const exchangePayments=exchanges.reduce((sum,entry)=>sum+cents(entry.payment?.amount??0),0);
    return {sales, years, currentYear, gross:rupees(gross+exchangePayments), refunded:rupees(refunded),
      net:rupees(gross+exchangePayments-refunded),exchanges:exchanges.filter(entry=>entry.status==='exchanged').length,
      customers: new Set(sales.map(sale => sale.customer?.phone).filter(Boolean)).size};
  },

  async seedPosExamples(session) {
    this.permit(session,'pos.examples');
    return this.serialized(() => {
      const location = this.posLocation(session);
      const existing = [...this.sales.values()].filter(sale => sale.example && sale.locationId === location.id);
      if (existing.length) return {created: 0, count: existing.length};
      const variants = this.products.flatMap(product => product.variants).filter(variant => variant.active !== false);
      if (!variants.length) throw new DomainError(409, 'Publish a product variant before adding examples');
      const now = this.orderNow();
      const year = new Date(now + 19800000).getUTCFullYear();
      const scenarios = [
        {days: 0, method: 'Cash', qty: 1, label: 'Regular price'},
        {days: 0, method: 'UPI', qty: 2, discount: 15, label: '15% off'},
        {days: 2, method: 'Card', qty: 1, discount: 20, label: 'Flat price'},
        {year: year-1, method: 'Cash', qty: 2, label: 'Prior-year purchase'},
        {year: year-1, method: 'UPI', qty: 1, discount: 10, label: 'Prior-year discount'},
        {year: year-2, method: 'Card', qty: 1, label: 'Earlier-year purchase'}
      ];
      const examples = scenarios.map((scenario,index) => {
        const {sku} = variants[index % variants.length];
        const quote = this.posQuote([{sku, qty:scenario.qty}], variant => {
          const regularPrice = variant.posPrice ?? variant.price;
          const salePrice = rupees(Math.max(1, Math.round(cents(regularPrice) * (100-(scenario.discount || 0))/100)));
          return {regularPrice, salePrice};
        });
        const at = new Date(scenario.year ? Date.UTC(scenario.year, 5, 15, 6) : now-scenario.days*86400000).toISOString();
        const id = `POS-${String(this.sales.size+index+1).padStart(5,'0')}`;
        return {id, items:quote.items, quote, locationId:location.id, locationName:location.name,
          customer:{name:'Sample POS Customer',phone:'9999900001'}, staffId:session.userId,
          terms:this.posReceiptTerms(), payment:{method:scenario.method,status:'simulated',reference:`MOCK-${id}`},
          at, returns:[], example:scenario.label};
      });
      for (const sale of examples) this.sales.set(sale.id,sale);
      this.event(session,'POS_EXAMPLES_CREATED',location.id);
      return {created:examples.length,count:examples.length};
    });
  },

  purchaseHistory(session, phone) {
    const manager = this.staffProfile(session).permissions.includes('customers.read');
    if(!manager)this.permit(session,'pos.history');
    const location = manager ? null : this.posLocation(session);
    const sales = [...this.sales.values()].filter(sale => sale.customer?.phone === phone && (!location || sale.locationId === location.id)).reverse();
    const orders = [...this.orders.values()].filter(order => order.phone === phone).reverse().map(purchaseOrder);
    return {phone, sales, orders, name: sales[0]?.customer?.name || Object.values(this.website.customers).find(customer=>customer.phone===phone)?.name || orders[0]?.name};
  },

  purchaseExtract(session, {channel,from,to}) {
    this.permit(session,'customers.export');
    if(!['sales','orders'].includes(channel))throw new DomainError(400,'Choose Store POS or Website');
    const start=indiaMidnight(from),last=indiaMidnight(to);
    if(!Number.isFinite(start)||!Number.isFinite(last)||start>last)throw new DomainError(400,'Enter a valid From and To date');
    const within=at=>Date.parse(at)>=start&&Date.parse(at)<last+86400000;
    const sales=channel==='sales'?[...this.sales.values()].filter(sale=>within(sale.at)).sort((a,b)=>b.at.localeCompare(a.at)):[];
    const orders=channel==='orders'?[...this.orders.values()].filter(order=>within(order.placedAt)).reverse().map(purchaseOrder):[];
    return {sales,orders};
  },

  async returnPosItem(session, id, body, key) {
    this.permit(session,'pos.return');
    return this.serialized(() => {
      const location = this.posLocation(session);
      const sale = this.sales.get(id);
      if (!sale || sale.locationId !== location.id) throw new DomainError(404, 'Store bill not found');
      if (sale.example) throw new DomainError(409, 'Sample bills are for reporting and receipt previews');
      const barcode = String(body.barcode ?? '').trim();
      const replacementBarcode=String(body.replacementBarcode??'').trim();
      const addOnBarcode=String(body.addOnBarcode??'').trim();
      const {action,expectedDifference,paymentMethod}=body;
      const preview=action==='options'||action==='quote';
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      const {qty} = body;
      if (!Number.isSafeInteger(qty)||qty<1||qty>25||(!preview&&(typeof key!=='string'||key.length<6||!reason||reason.length>240))) {
        throw new DomainError(400, 'Scan the garment and enter a quantity and reason');
      }
      const eventKey = 'pos-return:' + id + ':' + key;
      const fingerprint = JSON.stringify({barcode,replacementBarcode,qty,reason,sellable:body.sellable===true,...(addOnBarcode?{addOnBarcode}:{}),expectedDifference,paymentMethod});
      const previous = preview?null:this.getIdempotent(eventKey, fingerprint);
      if (previous) return previous;
      const item = sale.items.find(line => line.barcode === barcode);
      if (!item) throw new DomainError(400, 'This barcode is not on the original bill');
      const soldAt=Date.parse(sale.at),now=this.orderNow();
      if(now<soldAt||now-soldAt>=returnMs)throw new DomainError(409,'Store exchanges are available within 3 days of purchase.');
      const returned = (sale.returns || []).filter(entry => entry.sku === item.sku).reduce((sum, entry) => sum + entry.qty, 0);
      if (qty + returned > item.qty) throw new DomainError(409, 'Exchange exceeds the remaining quantity on the bill');
      const choices=this.exchangeChoices({...item,qty,lineTotal:rupees(cents(item.unitPrice)*qty)},sale.quote,false);
      if(action==='options')return choices;
      const {variant}=this.catalogBarcode(replacementBarcode);
      const addOnSku=addOnBarcode?this.catalogBarcode(addOnBarcode).variant.sku:undefined;
      const exchange=this.exchangeQuote(choices,variant.sku,addOnSku);
      if(action==='quote')return exchange;
      if(exchange.shortfall)throw new DomainError(409,'Add another product to cover the remaining exchange credit.');
      if((exchange.difference>0||expectedDifference!==undefined)&&expectedDifference!==exchange.difference){
        throw new DomainError(409,'Check the updated exchange price before completing.');
      }
      if(exchange.difference>0&&!['Cash','UPI','Card'].includes(paymentMethod)){
        throw new DomainError(400,'Select the simulated payment method for the difference.');
      }
      if(body.sellable!==true)throw new DomainError(400,'Confirm the garment is sellable before restocking');
      const warehouse = this.locations.find(entry => entry.id === centralWarehouseId && entry.type === 'warehouse');
      if (!warehouse) throw new DomainError(409, 'Exchange warehouse is unavailable');
      const balances = this.stock[item.sku];
      const before = balances[warehouse.id] || 0;
      if (before + qty > 2147483647) throw new DomainError(409, 'Warehouse stock limit exceeded');

      const allocations=this.allocations(exchange.lines);
      const entry={id:randomUUID(),sku:item.sku,barcode,qty,reason,
        replacement:exchange.lines[0],exchange,status:'exchanged',
        ...(exchange.difference?{payment:{method:paymentMethod,status:'simulated',amount:exchange.difference}}:{}),
        locationId:warehouse.id,at:new Date(this.orderNow()).toISOString(),staffId:session.userId};
      for(const allocation of allocations)this.decrement(allocation,'POS_EXCHANGE_REPLACEMENT',entry.id);
      balances[warehouse.id] = before + qty;
      this.ledger.push({id: randomUUID(), sku: item.sku, locationId: warehouse.id, delta: qty,
        before, after: before + qty, reason: 'POS_EXCHANGE_RESTOCK', ref: entry.id, at: entry.at});
      sale.returns = [...(sale.returns || []), entry];
      this.event(session, 'POS_EXCHANGE_COMPLETED', id);
      const result = {sale: structuredClone(sale), return: entry};
      this.setIdempotent(eventKey, fingerprint, result);
      return result;
    });
  },

  posTermsSettings(session) {
    this.permit(session,'pos.terms');
    return {text:this.posTerms??'',policy:posExchangeTerms};
  },

  savePosTerms(session, text) {
    this.permit(session,'pos.terms');
    if (typeof text !== 'string' || !text.trim() || text.length > 6000) {
      throw new DomainError(400, 'Enter receipt terms of up to 6,000 characters');
    }
    this.posTerms = text;
    this.event(session, 'POS_TERMS_UPDATED', 'store-pos');
    return this.posTermsSettings(session);
  },

  posReceiptTerms() {
    return [posExchangeTerms,this.posTerms].filter(Boolean).join('\n\n');
  }
};
