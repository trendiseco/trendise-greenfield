import {randomUUID} from 'node:crypto';
import {DomainError} from './errors.mjs';

const cents = value => Math.round(value * 100);
const rupees = value => value / 100;
const periods = ['today', 'week', 'month', 'year'];
const receiptTerms = [
  'Keep this receipt and the original product tags for return verification.',
  'Store staff verify the original bill, barcode, quantity and condition before accepting a return.',
  'Any approved return is valued at the price actually paid, after discounts. Applicable customer rights remain in effect.',
  'Development receipt. Payment and refund records are simulated.'
];

function periodStart(period, now) {
  const date = new Date(now + 19800000);
  date.setUTCHours(0, 0, 0, 0);
  if (period === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (period === 'month' || period === 'year') date.setUTCDate(1);
  if (period === 'year') date.setUTCMonth(0);
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
      variant.sku, {name: product.name, color: variant.color, size: variant.size, ...this.posPricing(variant), rule: this.posPromotions[variant.sku] ?? null}
    ])));
  },

  savePosPromotion(session, {sku, type, value}) {
    if (session.role !== 'superadmin') throw new DomainError(403, 'Super Admin required');
    const {variant} = this.product(sku);
    if (type === 'none') delete this.posPromotions[sku];
    else {
      const limit = type === 'percent' ? 100 : variant.posPrice ?? variant.price;
      if (!['percent', 'fixed'].includes(type) || !Number.isFinite(value) || value <= 0 || value > limit ||
          (type === 'percent' && cents(value) >= 10000) || cents(value) < 1) throw new DomainError(400, 'Enter a positive discount below 100% or a sale price up to the store price');
      this.posPromotions[sku] = {type, value: rupees(cents(value))};
    }
    this.event(session, 'POS_PROMOTION_UPDATED', sku);
    return this.posPromotionList(session);
  },

  posDashboard(session, period, year = null) {
    const location = this.posLocation(session);
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
    const storeSales = [...this.sales.values()].filter(sale => sale.locationId === location.id);
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

  posReceiptTerms() {
    return receiptTerms;
  }
};
