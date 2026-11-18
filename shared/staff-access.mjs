export const permissionGroups = {
 'Store POS': {
  'pos.read':'View register stock and prices', 'pos.bill':'Scan items and save bills',
  'pos.history':'Look up store customer purchase history', 'pos.report':'View store sales reports', 'pos.receipt':'Print or reprint POS receipts',
  'pos.return':'Record POS returns', 'pos.examples':'Create sample bills',
  'pos.pricing.read':'View and download store pricing', 'pos.promotions':'Manage store promotions', 'pos.prices':'Import store prices',
  'pos.terms':'Manage receipt terms',
 },
 Warehouse: {
  'warehouse.read':'View the picking and returns queue', 'warehouse.inventory':'View warehouse inventory',
  'warehouse.scan':'Verify order-line barcodes', 'warehouse.dispatch':'Record dispatch',
  'warehouse.deliver':'Record delivery', 'warehouse.receive':'Receive customer returns',
  'warehouse.inspect':'Inspect returns and record disposition', 'warehouse.cancellation':'Receive cancelled shipments',
 },
 'Catalogue and inventory': {
  'catalog.read':'View products and drafts', 'catalog.edit':'Create and edit product drafts',
  'catalog.submit':'Submit a product draft', 'approvals.decide':'Approve or reject products',
  'categories.manage':'Add, hide or remove categories', 'inventory.read':'View stock and movements',
  'inventory.receive':'Receive stock', 'inventory.transfer':'Transfer stock',
 },
 'Orders, customers and shipping': {
  'orders.read':'View and search orders', 'orders.review':'Review return requests and delivery issues',
  'shipping.rates':'Check courier rates', 'shipping.export':'Export eligible COD orders to Shiprocket',
  'customers.read':'Search customer purchase history across channels',
  'customers.export':'Export customer purchase data', 'reports.read':'View management and cross-store reports',
 },
 'Storefront and rewards': {
  'website.read':'View website drafts and media', 'website.edit':'Save website drafts',
  'website.publish':'Publish website content', 'website.media':'Upload website media',
  'offers.read':'View website coupons', 'offers.coupons':'Save website coupons',
  'offers.pricing.read':'View and download website pricing', 'offers.promotions':'Manage website promotions',
  'offers.prices':'Import website prices',
  'rewards.read':'View reward rules, customer balances and transactions',
  'rewards.rules':'Save rewards rules', 'rewards.adjust':'Adjust points or birthday details',
 },
 'Staff and security': {
  'users.manage':'Create, edit, assign and disable staff and roles',
  'audit.read':'View the staff and operations audit log',
 },
};

export const staffPermissions = Object.keys(Object.assign({}, ...Object.values(permissionGroups)));
export const reservedPermissions = ['users.manage','audit.read'];

const warehousePermissions = Object.keys(permissionGroups.Warehouse);
const posRegisterPermissions = ['pos.read','pos.bill','pos.history','pos.report','pos.receipt','pos.return','pos.examples'];
const legacyManagement = ['orders.read','orders.review','shipping.rates','shipping.export','customers.read','customers.export','reports.read'];

export function effectivePermissions(role, grants = []) {
 if (role === 'superadmin' && grants.includes('*')) return staffPermissions;
 const expanded = new Set(grants);
 if (expanded.has('pos.sell')) for (const key of posRegisterPermissions) expanded.add(key);
 if (expanded.has('warehouse.fulfill')) for (const key of warehousePermissions) expanded.add(key);
 if (expanded.has('inventory.adjust')) for (const key of ['inventory.receive','inventory.transfer']) expanded.add(key);
 if (role === 'admin' && expanded.has('pos.sell') && expanded.has('warehouse.fulfill')) {
  for (const key of legacyManagement) expanded.add(key);
 }
 if (expanded.has('catalog.edit') || expanded.has('catalog.submit') || expanded.has('categories.manage') || expanded.has('approvals.decide')) expanded.add('catalog.read');
 if (expanded.has('pos.bill')) expanded.add('pos.read');
 if (expanded.has('pos.return')) expanded.add('pos.history');
 if (expanded.has('pos.examples') || expanded.has('pos.receipt')) expanded.add('pos.report');
 if (expanded.has('pos.promotions') || expanded.has('pos.prices')) expanded.add('pos.pricing.read');
 if (expanded.has('website.manage')) for (const key of ['website.edit','website.publish','website.media']) expanded.add(key);
 if (expanded.has('offers.manage')) for (const key of ['offers.coupons','offers.promotions','offers.prices']) expanded.add(key);
 if (expanded.has('rewards.manage')) for (const key of ['rewards.rules','rewards.adjust']) expanded.add(key);
 if (['website.edit','website.publish','website.media'].some(key=>expanded.has(key))) expanded.add('website.read');
 if (expanded.has('offers.coupons')) expanded.add('offers.read');
 if (expanded.has('offers.promotions') || expanded.has('offers.prices')) expanded.add('offers.pricing.read');
 if (expanded.has('rewards.rules') || expanded.has('rewards.adjust')) expanded.add('rewards.read');
 if (expanded.has('orders.review')) expanded.add('orders.read');
 if (expanded.has('inventory.receive') || expanded.has('inventory.transfer')) expanded.add('inventory.read');
 if (warehousePermissions.some(key => key !== 'warehouse.inventory' && expanded.has(key))) expanded.add('warehouse.read');
 return staffPermissions.filter(key => expanded.has(key) && !reservedPermissions.includes(key));
}

const adminPermissions = staffPermissions.filter(key => ![
 ...warehousePermissions,...posRegisterPermissions,...reservedPermissions,
].includes(key));

export const staffPortals = [
 {id:'pos',label:'Store POS',href:'/pos',permissions:posRegisterPermissions},
 {id:'warehouse',label:'Warehouse',href:'/warehouse',permissions:warehousePermissions},
 {id:'admin',label:'Admin',href:'/admin',permissions:adminPermissions},
 {id:'superadmin',label:'Super Admin',href:'/superadmin',permissions:reservedPermissions},
];

export function staffCanOpen(portal, profile) {
 if (portal === 'pos' && profile?.locationType !== 'store') return false;
 return staffPortals.find(entry => entry.id === portal)?.permissions.some(key => profile?.permissions?.includes(key)) ?? false;
}
