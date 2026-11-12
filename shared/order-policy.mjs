export const cancellationMs=12*60*60*1000;
export const returnMs=72*60*60*1000;
export const paymentLabels={cod:'Cash on delivery',card:'Credit / debit card',phonepe:'PhonePe (UPI)',split:'30% upfront, 70% cash on delivery'};
export const returnReasons={fit:'Size or fit',preference:'Changed my mind',damaged:'Arrived damaged or defective',wrong:'Wrong or missing item',description:'Not as described',late:'Late delivery'};
export const returnConditions=[
 'Original brand, price and seal tags are attached and intact, where supplied.',
 'Item is unused (a brief indoor try-on is fine), unwashed and unaltered.',
 'No wear marks, stains, makeup, deodorant, odours, tears or customer-caused damage.',
 'Include the original product packaging, accessories and any parts supplied with the item.'
];
export const policySectionsV2=[
 ['Orders and payment','Check the product, size, colour, delivery address and final INR total before placing an order. Prices, discounts and stock are confirmed at checkout. This store is a development simulation: cash on delivery, card and PhonePe are test options. No money is collected, no card or UPI credentials are requested and no real shipment is booked.'],
 ['Cancellation within 12 hours','Cancel from My Orders within 12 hours of placing the order. New orders cannot be dispatched during this window. There is no cancellation fee. A cancelled COD order has nothing to refund; a cancelled prepaid test order records a simulated refund.'],
 ['Change-of-mind returns within 3 days','Request a return from My Orders within 72 hours of recorded delivery. A request is not approval. Items are reviewed against the condition checklist. Keep the order number and proof of purchase.'],
 ['Return condition checklist',...returnConditions],
 ['Wrong, defective or other delivery issues','Report wrong, missing, damaged, defective or misdescribed goods or late delivery through My Orders. Describe the issue and keep any relevant evidence. The change-of-mind deadline and condition checklist do not limit remedies available under applicable consumer law.'],
 ['Review, refunds and exchanges','Return requests are reviewed before a refund is approved. This preview does not book pickups, issue real refunds or promise exchanges. Discounts are reflected in the amount actually paid; no real payment will be collected in this preview.'],
 ['Delivery, privacy and support','Use accurate contact and delivery details. Delivery and tracking are simulated. Order details are used for this test workflow. Use My Orders to report an issue. Live seller details, privacy notices and customer care contacts must be provided before commercial launch.']
];
export const policyRulesVersion=4;
export const policyEffectiveDate='2026-11-11';
const policySectionsV3=[
 ['Acceptance and purchase eligibility',
 'Read these terms and the applicable privacy, shipping, return and exchange information before using TRENDISE or placing an order. At checkout, actively accept the displayed version before placing any order, including Cash on Delivery. Marketing consent is separate.',
 'Only place orders if you are legally able to enter the transaction. Provide complete, accurate information and review any linked policies that apply. This development store does not accept commercial orders.'],
 ['Account, OTP and customer information',
 'Sign in using your mobile number and OTP. Keep your phone and account secure, do not share OTPs, and report suspected unauthorised access. The preview uses demo OTPs without sending SMS.',
 'Keep your name, phone number, delivery address, PIN code and email (if requested) current and accurate.'],
 ['Product information, colour, size and variants',
 'We aim to describe garments accurately, including fabric, pattern, fit, size, specifications, images and price. Lighting, screen settings, fabric batches and manufacturing variation can affect the appearance of colours. Development imagery and sample measurements are labelled.',
 'Check the product size chart and your selected colour, size, SKU and quantity. Fit can vary by garment, fabric and individual proportions.'],
 ['Availability, reservations and order review',
 'Putting an item in your bag does not reserve it. Checkout may briefly hold available stock; expired, failed, cancelled or abandoned attempts may release that stock.',
 'Review all items, quantities, delivery details, discounts and the final total before confirming. Stock discrepancies, damage or technical errors may make an item unavailable. We will not substitute an item without your agreement.'],
 ['Order confirmation and exceptions',
 'Submitting an order is a request. A confirmed order number is issued after stock, order and payment validation, or after validation for COD. Check My Orders. In a live store, confirmations may also use enabled SMS, email or WhatsApp channels.',
 'We may decline or cancel an affected order for a legitimate reason, such as unavailable stock, an obvious pricing error, invalid payment, suspected fraud, delivery restrictions or a technical failure. We will explain the reason and handle any amount collected under the applicable refund process.'],
 ['Prices, MRP, tax, delivery charges and invoices',
 'Prices are in INR. Prices may change before confirmation; the confirmed order price normally applies. We will show applicable MRP, selling price, discounts, taxes including GST where required, and any delivery charges before order confirmation.',
 'An obvious pricing or system error may require correction or cancellation and refund. A live order may include an electronic invoice with applicable item, price, discount and tax details. Demo totals are illustrative and are not tax invoices.'],
 ['Coupons, promotions and bundles',
 'Codes and promotions may have dates, eligibility criteria, minimum spend, discount caps, quantity and usage limits, and exclusions by item, category or channel. Online-only codes are for the website; store-only codes are for eligible physical stores.',
 'The applicable offer rules determine whether coupons, bundles and loyalty rewards can be combined. If a qualifying item is cancelled or returned, a buy-X-get-Y benefit, free item or bundle discount may need to be recalculated under the disclosed offer terms.',
 'We may withdraw an affected benefit or cancel an order for verified misuse, including duplicate-account abuse, fraud or exploitation of a pricing or coupon error.'],
 ['Loyalty points',
 'The active programme sets eligibility, earning, redemption value and limits, exclusions and any disclosed expiry. For a live programme, earned points normally become available after successful delivery and applicable eligibility checks.',
 'In this preview, COD points are credited at simulated delivery; prepaid test points are held during the cancellation window. Points on reversed transactions may be adjusted under the programme rules. Current demo cancellations reverse eligible earned points and restore redeemed points.'],
 ['Payment, security and payment failures',
 'Checkout offers simulated Cash on Delivery, credit/debit card and PhonePe (UPI). No money is collected. Never enter real card details, banking credentials or a UPI PIN in this preview. Razorpay is a mock integration here; any live provider and enabled methods will be identified at checkout.',
 'Server or payment-provider confirmation determines payment status. A failed, declined, timed-out or unverified payment may leave the order unconfirmed or cancelled. Report suspected duplicate charges through support; verified duplicates are handled through the applicable refund process.',
 'A live authorised payment provider would handle payment credentials. TRENDISE does not collect full card credentials in this preview. We may reasonably verify, hold or cancel suspicious transactions.'],
 ['Address, shipping and tracking',
 'Enter a complete address manually or use supported location or map-pin tools; location and maps are simulated here. Check the address, contact number and PIN code. Address changes may be restricted after processing or packing begins.',
 'Delivery depends on location serviceability. Shiprocket, courier pickup, AWB and tracking are simulated. In a live store, tracking may be available after dispatch and delivery estimates may change because of courier operations, weather, holidays, disruption or address issues.',
 'Stay reachable for delivery attempts. An undeliverable shipment may be returned to origin and handled separately from a customer return. This preview does not book real shipments.'],
 ...policySectionsV2.slice(1,5),
 ['Return eligibility, inspection and pickup',
 'Choose the correct item and return reason in My Orders. We may ask for relevant photos or information about a reported issue. A request does not guarantee approval. Any lawful product exclusions must be disclosed for the affected item; there are no additional change-of-mind category exclusions specified here.',
 'A live approved return may be collected where pickup is serviceable. Warehouse inspection may verify the item barcode, tags, packaging, accessories and garment condition before any restock or refund decision. The preview records requests for review and does not book pickups.'],
 ['Exchanges, replacements and refunds',
 'Verified issues may qualify for a replacement, exchange or refund as applicable. Any offered exchange depends on stock, verification and approval. Any price difference must be explained and agreed before proceeding. Exchanges are not available in this preview.',
 'For eligible live prepaid refunds, the original payment method is normally used unless another lawful method is agreed. Initiation and bank or provider credit may take different amounts of time. Refund timing and applicable shipping or pickup fees will be disclosed before live use.',
 'Partial refunds are based on eligible items and the amount actually paid, with disclosed discounts, bundle benefits, shipping charges and loyalty adjustments considered as applicable. Statutory remedies are unaffected. Refunds in this preview are simulated.'],
 ['Transactional messages, privacy and location',
 'Transactional updates may cover account access, orders, shipping, returns and refunds. Marketing uses separate consent or preferences where applicable; accepting checkout terms does not opt you in.',
 'Use fictional information in this preview. Account, address and order details are used for the test workflow. Location or pin selection is simulated. Before launch, TRENDISE must publish its privacy notice explaining processing, retention, sharing, contact details and applicable rights.',
 'Live services may rely on authorised payment, map, messaging, hosting and courier providers. Where applicable, their own terms and privacy practices apply. No live payment, map, messaging or courier provider is enabled here.'],
 ['Site access, intellectual property and fair use',
 'The site may be interrupted for maintenance or technical issues. We may correct genuine catalogue, inventory, price and checkout errors, subject to applicable law.',
 'TRENDISE branding, photographs, graphics and other content belong to TRENDISE or their respective owners. Do not use the site for unauthorised access, unlawful scraping, fraud, security attacks or interference. We may restrict fraudulent orders, unauthorised commercial misuse and accounts that seriously misuse the service.'],
 ['Liability, unlawful misuse and events outside our control',
 'Nothing here excludes liability or remedies that cannot lawfully be excluded. Delays caused by events reasonably beyond our control are handled subject to applicable law. Any additional liability limits or indemnity provisions require legal review before commercial use.'],
 ['Versions, applicable law and consumer rights',
 'Changes apply prospectively. Checkout records the accepted version and acceptance time for each new order. The version and effective date appear with these terms.',
 'The proposed commercial terms are intended for India. Nothing in these terms limits mandatory rights, remedies or access to competent consumer forums under applicable law. Final jurisdiction and dispute provisions require legal review.'],
 ['Support, complaints and business contact',
 'Use My Orders in the preview to report an order or delivery issue. For commercial launch, TRENDISE must publish its verified legal name, business address, customer-care details and grievance contact for order, refund and privacy concerns. These details have not been supplied for this preview.']
];
export const policySections=policySectionsV3.map(section=>section[0]==='Payment, security and payment failures'
 ? [...section,'Eligible postal areas at least 1,000 km from PIN 501505 by straight-line distance may pay 30% of the final total upfront and the remaining balance on delivery. In this preview both payments are simulated. An eligible cancellation refunds only the simulated upfront amount.']
 : section);
export function policyDocument(policy){
 const sections=policy.sections??(policy.rulesVersion===policyRulesVersion?policySections:policy.rulesVersion===3?policySectionsV3:policy.rulesVersion===2?policySectionsV2:[]);
 return structuredClone({...policy,sections});
}
export function orderEligibility(order,now=Date.now()){
 const placed=Date.parse(order.placedAt),delivered=Date.parse(order.deliveredAt);
 return {cancelUntil:Number.isFinite(placed)?new Date(placed+cancellationMs).toISOString():null,
 canCancel:['paid','confirmed','picking'].includes(order.status)&&now>=placed&&now<placed+cancellationMs,
 returnUntil:Number.isFinite(delivered)?new Date(delivered+returnMs).toISOString():null,
 canReturn:order.status==='delivered'&&now>=delivered&&now<delivered+returnMs&&order.items.some(i=>!(order.returnRequests||[order.returnRequest].filter(Boolean)).some(r=>r.sku===i.sku)),
 canReportIssue:['shipped','delivered'].includes(order.status)&&!order.issueReport};
}
