import {randomUUID} from 'node:crypto';
import {DomainError} from './errors.mjs';

const cents = value => Math.round(value * 100);
const rupees = value => value / 100;
const periods = ['today', 'week', 'month', 'year', 'fiveYears'];
const receiptTerms = [
  'Keep this receipt and the original product tags for return verification.',
  'Store staff verify the original bill, barcode, quantity and condition before accepting a return.',
  'Any approved return is valued at the price actually paid, after discounts. Applicable customer rights remain in effect.',
  'Development receipt. Payment and refund records are simulated.'
];

export function periodStart(period, now) {
  const date = new Date(now + 19800000);
  date.setUTCHours(0, 0, 0, 0);
  if (period === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (period === 'month' || period === 'year') date.setUTCDate(1);
  if (period === 'year') date.setUTCMonth(0);
  if (period === 'fiveYears') date.setUTCFullYear(date.getUTCFullYear()-5);
  return date.getTime() - 19800000;
}

export const posMethods = {
  posLocation(session) {
    this.permit(session, 'pos.sell');
    const location = this.locations.find(entry => entry.id === (session.locationId || 'store-hyd-01') && entry.type === 'store');
    if (!location) throw new DomainError(403, 'A store assignment is required');
    return location;
  },

  posPricing(variant) {
    const regular = cents(variant.posPrice ?? variant.price);
    const rule = this.posPromotions[variant.sku];
    const sale = rule?.type === 'fixed' ? Math.min(regular, cents(rule.value))
      : rule?.type === 'percent' ? Math.max(1, Math.round(regular * (100 - rule.value) / 100)) : regular;
    return {regularPrice: rupees(regular), salePrice: rupees(sale)};
  },

  posInventory(session) {
    const location = this.posLocation(session);
    const products = this.listing('store').map(product => ({
      ...product,
      variants: product.variants.filter(variant => variant.active !== false).map(variant => ({
        ...variant, ...this.posPricing(variant), available: this.available(variant.sku, location.id)
      }))
    }));
    return {products, locationId: location.id, locationName: location.name, stock: this.stock};
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

  posPromotionList(session) {
    if (session.role !== 'superadmin') throw new DomainError(403, 'Super Admin required');
    return Object.fromEntries(this.products.flatMap(product => product.variants.map(variant => [
      variant.sku, {productId:product.id, name:product.name, category:product.category, barcode:variant.barcode,
        color:variant.color, size:variant.size, active:variant.active!==false, websitePrice:variant.price,
        stock:this.stock[variant.sku], ...this.posPricing(variant), rule:this.posPromotions[variant.sku] ?? null}
    ])));
  },

  savePosPromotion(session, {sku, scope='variant', target, type, value}) {
    const catalog = this.posPromotionList(session);
    if (!['variant','product','category','all'].includes(scope)) throw new DomainError(400,'Choose a promotion scope');
    const entries = Object.entries(catalog).filter(([key,entry]) =>
      scope==='all'||(scope==='variant'&&key===sku)||(scope==='product'&&entry.productId===target)||(scope==='category'&&entry.category===target));
    if (!entries.length) throw new DomainError(400,'Choose a scope with published variants');
    if (type!=='none' && (!['percent','fixed'].includes(type)||!Number.isFinite(value)||cents(value)<1||
      (type==='percent'&&cents(value)>=10000)||(type==='fixed'&&entries.some(([,entry])=>cents(value)>cents(entry.regularPrice))))) {
      throw new DomainError(400,'Use a discount below 100% or a flat price at or below every selected store price');
    }
    for (const [key] of entries) {
      if (type==='none') delete this.posPromotions[key];
      else this.posPromotions[key]={type,value:rupees(cents(value))};
    }
    this.event(session,'POS_PROMOTION_UPDATED',target||sku||scope);
    return this.posPromotionList(session);
  },

  importPosPrices(session, rows) {
    const catalog = this.posPromotionList(session);
    if (!Array.isArray(rows)||!rows.length||rows.length>10000) throw new DomainError(400,'Upload 1 to 10,000 price rows');
    const seen=new Set();
    const changes=rows.map((row,index)=>{
      const {sku,barcode,price}=row??{};
      if (!Object.hasOwn(catalog,sku)||catalog[sku].barcode!==barcode||seen.has(sku)||typeof price!=='number'||
        !Number.isFinite(price)||price<0.01||price>1000000) throw new DomainError(400,`Excel row ${index+2}: check SKU, barcode, duplicate rows and price`);
      seen.add(sku);
      return {sku,price:rupees(cents(price))};
    });
    let updated=0;
    for (const {sku,price} of changes) {
      if (price===catalog[sku].salePrice) continue;
      const {product,variant}=this.product(sku);
      variant.posPrice=price;
      const draft=this.drafts[product.id];
      const draftVariant=draft?.product.variants.find(entry=>entry.sku===sku);
      if(draftVariant)draftVariant.posPrice=price;
      delete this.posPromotions[sku];
      updated++;
    }
    if(updated)this.event(session,'POS_PRICES_IMPORTED',String(updated));
    return {updated,catalog:this.posPromotionList(session)};
  },

  posDashboard(session, period, year = null, allStores = false) {
    const location = allStores && ['admin','superadmin'].includes(session.role) ? null : this.posLocation(session);
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
    const refunded = storeSales.flatMap(sale => sale.returns || []).filter(entry => inPeriod(entry.at))
      .reduce((sum, entry) => sum + cents(entry.refund), 0);
    return {sales, years, currentYear, gross: rupees(gross), refunded: rupees(refunded), net: rupees(gross - refunded),
      customers: new Set(sales.map(sale => sale.customer?.phone).filter(Boolean)).size};
  },

  async seedPosExamples(session) {
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
        {days: 0, method: 'UPI', qty: 2, discount: 15, returned: 1, label: '15% off · partial return'},
        {days: 2, method: 'Card', qty: 1, discount: 20, returned: 1, label: 'Flat price · full return'},
        {year: year-1, method: 'Cash', qty: 2, label: 'Prior-year purchase'},
        {year: year-1, method: 'UPI', qty: 1, discount: 10, label: 'Prior-year discount'},
        {year: year-2, method: 'Card', qty: 1, returned: 1, label: 'Earlier-year full return'}
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
        const item = quote.items[0];
        const returns = scenario.returned ? [{
          id:randomUUID(), sku, barcode:item.barcode, qty:scenario.returned, reason:'Example · tags intact',
          refund:item.unitPrice, gst:rupees(Math.round(cents(item.gst)/scenario.qty)), status:'mock_refunded',
          locationId:'warehouse-hyd', at, example:true
        }] : [];
        return {id, items:quote.items, quote, locationId:location.id, locationName:location.name,
          customer:{name:'Sample POS Customer',phone:'9999900001'}, staffId:session.userId,
          terms:this.posReceiptTerms(), payment:{method:scenario.method,status:'simulated',reference:`MOCK-${id}`},
          at, returns, example:scenario.label};
      });
      for (const sale of examples) this.sales.set(sale.id,sale);
      this.event(session,'POS_EXAMPLES_CREATED',location.id);
      return {created:examples.length,count:examples.length};
    });
  },

  purchaseHistory(session, phone) {
    const manager = ['admin', 'superadmin'].includes(session.role);
    const location = manager ? null : this.posLocation(session);
    const sales = [...this.sales.values()].filter(sale => sale.customer?.phone === phone && (!location || sale.locationId === location.id)).reverse();
    const orders = [...this.orders.values()].filter(order => order.phone === phone).reverse().map(order => ({
      id: order.id, at: order.placedAt, name: order.address?.name, status: order.status,
      items: order.items.map(({name, sku, color, size, qty, unitPrice}) => ({name, sku, color, size, qty, unitPrice})),
      total: order.quote.total, payment: order.payment?.method
    }));
    return {phone, sales, orders, name: sales[0]?.customer?.name || this.website.customers[phone]?.name || orders[0]?.name};
  },

  async returnPosItem(session, id, body, key) {
    return this.serialized(() => {
      const location = this.posLocation(session);
      const sale = this.sales.get(id);
      if (!sale || sale.locationId !== location.id) throw new DomainError(404, 'Store bill not found');
      if (sale.example) throw new DomainError(409, 'Sample bills are for reporting and receipt previews');
      const barcode = String(body.barcode ?? '').trim();
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      const {qty} = body;
      if (typeof key !== 'string' || key.length < 6 || !Number.isSafeInteger(qty) || qty < 1 || !reason || reason.length > 240) {
        throw new DomainError(400, 'Scan the garment and enter a quantity and reason');
      }
      const eventKey = 'pos-return:' + id + ':' + key;
      const fingerprint = JSON.stringify({barcode, qty, reason, sellable:body.sellable===true});
      const previous = this.getIdempotent(eventKey, fingerprint);
      if (previous) return previous;
      const item = sale.items.find(line => line.barcode === barcode);
      if (!item) throw new DomainError(400, 'This barcode is not on the original bill');
      if (body.sellable !== true) throw new DomainError(400, 'Confirm the garment is sellable before restocking');
      const returned = (sale.returns || []).filter(entry => entry.sku === item.sku).reduce((sum, entry) => sum + entry.qty, 0);
      if (qty + returned > item.qty) throw new DomainError(409, 'Return exceeds the remaining quantity on the bill');
      const warehouse = this.locations.find(entry => entry.id === 'warehouse-hyd' && entry.type === 'warehouse');
      if (!warehouse) throw new DomainError(409, 'Returns warehouse is unavailable');
      const balances = this.stock[item.sku];
      const before = balances[warehouse.id] || 0;
      if (before + qty > 2147483647) throw new DomainError(409, 'Warehouse stock limit exceeded');

      // Legacy bills stored the promotion at bill level. Allocate it across lines before splitting units.
      const paid = sale.quote.gstRate === 5 ? cents(item.lineTotal) : (() => {
        const beforeLine = sale.items.slice(0, sale.items.indexOf(item)).reduce((sum, line) => sum + cents(line.lineTotal), 0);
        const paidThrough = amount => Math.round(amount * cents(sale.quote.total) / cents(sale.quote.subtotal));
        return paidThrough(beforeLine + cents(item.lineTotal)) - paidThrough(beforeLine);
      })();
      const share = amount => Math.round(amount * (returned + qty) / item.qty) - Math.round(amount * returned / item.qty);
      const refund = share(paid);
      const entry = {id: randomUUID(), sku: item.sku, barcode, qty, reason, refund: rupees(refund),
        gst: rupees(item.gst === undefined ? 0 : share(cents(item.gst))), status: 'mock_refunded',
        locationId: warehouse.id, at: new Date(this.orderNow()).toISOString(), staffId: session.userId};
      balances[warehouse.id] = before + qty;
      this.ledger.push({id: randomUUID(), sku: item.sku, locationId: warehouse.id, delta: qty,
        before, after: before + qty, reason: 'POS_RETURN_RESTOCK', ref: entry.id, at: entry.at});
      sale.returns = [...(sale.returns || []), entry];
      this.event(session, 'POS_RETURN_RESTOCKED', id);
      const result = {sale: structuredClone(sale), return: entry};
      this.setIdempotent(eventKey, fingerprint, result);
      return result;
    });
  },

  posTermsSettings(session) {
    if (session.role !== 'superadmin') throw new DomainError(403, 'Super Admin required');
    const terms = this.posReceiptTerms();
    return {text: Array.isArray(terms) ? terms.join('\n') : terms};
  },

  savePosTerms(session, text) {
    if (session.role !== 'superadmin') throw new DomainError(403, 'Super Admin required');
    if (typeof text !== 'string' || !text.trim() || text.length > 6000) {
      throw new DomainError(400, 'Enter receipt terms of up to 6,000 characters');
    }
    this.posTerms = text;
    this.event(session, 'POS_TERMS_UPDATED', 'store-pos');
    return this.posTermsSettings(session);
  },

  posReceiptTerms() {
    return this.posTerms ?? [...receiptTerms];
  }
};
