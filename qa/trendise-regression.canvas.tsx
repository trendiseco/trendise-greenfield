import {useCanvasState,useHostTheme} from "cursor/canvas";

const coverage=[
  {
    "area": "Storefront and catalog",
    "checks": [
      [
        "Pass",
        "Home and campaign films",
        "Home rendered seven category entry points and the four-film control. Pausing changed the control to Play. Automated checks passed original → work → weekend → after hours → original, broken-film skip, poster fallback and local asset presence. Full playback of every film was not timed in the browser."
      ],
      [
        "Pass",
        "Editorial collections",
        "Work was initially selected. Selecting Weekend changed the panel, image and destination. After Hours was visible as an option. Its destination and all seven category destinations were not individually opened."
      ],
      [
        "Partial",
        "Collection filters and sorting",
        "Browser search found Oxford and opened the correct product. Category, size, colour, fit, price, availability, sort and reset are implemented. Each filter combination and both price-sort directions still need current browser execution."
      ],
      [
        "Pass",
        "Product variants and sale pricing",
        "Oxford changed from Sky Blue to White with matching photography, size M could be added, and the browser showed ₹1,499 regular and ₹1,274.15 discounted. Best-offer choice, minimums, caps, rounding, published visibility and inactive SKU protections passed automated tests."
      ],
      [
        "Partial",
        "Product gallery and purchase controls",
        "Front photograph, related outfit cards, size controls and Add to Bag were visible. Current browser run did not individually exercise back, side, fabric image, zoom, every SKU image, quick-add or mobile purchase bar. Assets are development imagery."
      ],
      [
        "Pass",
        "Fit and size guide",
        "Browser opened body length, chest width, shoulder and sleeve measurements with a sample-data notice. Automated tests cover unit conversion, missing sizes, validation, draft approval and persistence. Production measurements still need verification."
      ],
      [
        "Deferred",
        "3D, 360° and virtual try-on",
        "Multi-angle photos are the current fallback. 3D and 360° require matching assets. Customer try-on was intentionally hidden. Automated manual overlay geometry and cutout approval tests passed. Live AI was excluded."
      ]
    ]
  },
  {
    "area": "Bag, checkout and customer account",
    "checks": [
      [
        "Partial",
        "Bag editing and totals",
        "White/M appeared in the bag. The STYLE15 total of ₹1,274.15 carried through Product → Bag → Checkout, with included GST and shipping shown. Quantity controls, removal, empty-bag recovery and persistence after a reload were not exercised in this browser run."
      ],
      [
        "Pass",
        "Mock OTP and order ownership",
        "Browser signed in with demo OTP and loaded My Orders. The automated HTTP flow verifies demo OTP and role restrictions. Order lifecycle tests verify that a different customer cannot cancel the order."
      ],
      [
        "Partial",
        "Address and PIN lookup",
        "Browser PIN 110001 filled New Delhi district and Delhi state, with City shown separately as required. Complete-address validation passed. Manual overrides, unknown-PIN fallback and simulated map-pin selection were not executed in this browser run."
      ],
      [
        "Pass",
        "Cash on delivery",
        "Browser showed COD instructions. Automated checkout and cancellation verify pending collection, void on cancellation and mock collection on delivery."
      ],
      [
        "Pass",
        "Credit and debit card",
        "Browser displayed fictional holder, expiry and card number. Automated checkout confirms mock capture and safe retries. Real payment data entry is outside scope."
      ],
      [
        "Pass",
        "PhonePe UPI",
        "Browser displayed a clearly labelled demo QR. Automated checkout and cancellation cover mock capture and refund."
      ],
      [
        "Pass",
        "Partial payment",
        "Browser displayed the option for Delhi PIN 110001. API tests reject near and unknown PINs, verify 30% upfront and 70% COD on the discounted total, refund the upfront amount on cancellation and collect the remainder on delivery."
      ],
      [
        "Pass",
        "GST and shipping display",
        "The browser displayed included GST and ₹0 shipping on the test order. Automated split-payment checks assert 5% included GST and the configured zero shipping amount. A paid shipping rate was not exercised."
      ],
      [
        "Pass",
        "Terms and policy history",
        "Browser opened the required terms dialog with 12-hour cancellation and 3-day return sections. Automated cases reject stale consent and verify accepted policy history is retained."
      ]
    ]
  },
  {
    "area": "Coupons, Birthday Benefits, Loyalty Points and Customer Rewards",
    "checks": [
      [
        "Pass",
        "Discount coupons and automatic offers",
        "Automated tests passed for percentage and fixed discounts, maximum discounts, minimum-spend rules, invalid and expired dates, revision conflicts, usage holds and release on expiry, and website/POS coupon isolation. The storefront pricing test checks best-offer selection and rounding. The regression browser run confirmed STYLE15 carried the ₹1,274.15 total through Product → Bag → Checkout. Earlier browser testing covered Admin creation of STYLE15. Manual coupon entry and removal were not rerun."
      ],
      [
        "Pass",
        "Birthday benefits",
        "Automated tests passed for India-time birthday-month eligibility, one redemption per year, eligibility in the following year, a locked saved DOB, disabled benefits, and no duplicate redemption on payment retry. Earlier browser order TRD-10002 applied BIRTHDAY, saving ₹224.85, and credited 12 points."
      ],
      [
        "Pass",
        "Loyalty points",
        "Automated tests passed for earning once, redeeming, rejecting overspend and concurrent redemption, protecting held points and applying the redemption cap after coupons. Earlier browser order TRD-10003 combined STYLE15 with 10 points and totalled ₹1,264.15. The account ledger showed −10 redeemed, +12 earned and a balance of 14."
      ],
      [
        "Pass",
        "Customer rewards administration",
        "Automated tests passed for audited staff adjustments, permission denial for Warehouse, replay protection, rejection of negative balances, normalized customer phone identity and balance restoration from a snapshot. The current browser run did not recheck the Admin customer rewards editor or DOB correction form."
      ]
    ]
  },
  {
    "area": "Orders and returns",
    "checks": [
      [
        "Pass",
        "My Orders and delivery",
        "Browser loaded order history and confirmed TRD-10006 with a three-day return window and Received by warehouse. Automated flow covers order creation, barcode verification, dispatch, delivery and stock effects."
      ],
      [
        "Pass",
        "12-hour cancellation",
        "Automated tests accept cancellation 1 ms before the deadline and reject at the deadline, prevent early dispatch, and verify owner-only cancellation, repeat safety, coupon and stock reversal, COD void and prepaid mock refund."
      ],
      [
        "Pass",
        "72-hour returns and delivery issues",
        "Automated tests allow eligible returns 1 ms before expiry, reject at expiry, enforce checklist and duplicate controls, and allow a damage issue after the ordinary return window."
      ],
      [
        "Pass",
        "Return review and warehouse receipt",
        "Automated cases cover staff authorization, approval, receipt barcode and quantity, duplicate-receipt protection and shared timestamps. Browser verified TRD-10006 across Customer, Super Admin and Warehouse."
      ],
      [
        "Open",
        "Return inspection and settlement",
        "TRD-10006 still says Awaiting inspection. There is no final pass/fail inspection, sellable or damaged stock disposition, return refund, or reconciliation of order discounts and loyalty on return. Cancellation refunds are already covered separately."
      ]
    ]
  },
  {
    "area": "Admin, Super Admin, Warehouse and POS",
    "checks": [
      [
        "Partial",
        "Management tabs and order lists",
        "Super Admin browser login and Returns deep link passed. API tests cover Returns filtering, review queue, permissions and excluding the return from Cancelled, Shipped and Processing. Dashboard return counting passed in the automated case. Current run did not open every management tab, independently recheck Admin-only browser access, or exercise paging with more than 25 orders."
      ],
      [
        "Pass",
        "Product management and approvals",
        "Automated checks cover creation, private draft, preview data, submission, independent approval, rejection and revision conflicts, required and unique variant barcodes, image size/type/alt and stable published identities. This run did not republish storefront content or catalog products in the browser."
      ],
      [
        "Pass",
        "Storefront administration",
        "Automated checks cover draft privacy, publish, revisions, unsafe link rejection, media checks, website visibility, coupons and rewards permissions. Individual CMS field editors were not retested in the browser."
      ],
      [
        "Pass",
        "Staff roles and revocation",
        "Automated tests cover access controls and disabled-user session revocation. Production authentication and MFA remain outside development."
      ],
      [
        "Pass",
        "Shared inventory",
        "Automated checks cover location balances, active holds, receipts, transfers, concurrent last-unit sales, oversell protection and duplicate sale protection. Warehouse inventory workspace opened in the browser. Every inventory filter and manual adjustment was not repeated."
      ],
      [
        "Pass",
        "Warehouse picking and dispatch",
        "Automated checks cover order visibility, order-line and garment barcode matching, rejection of wrong scans, all-units gate, dispatch hold and mock shipment. Physical scanner and printed barcode verification remain untested."
      ],
      [
        "Partial",
        "POS options",
        "Browser signed in and showed Cash, UPI and Card options. Automated HTTP coverage confirms sale and shared stock deduction, reservation protection and retry safety. Supplemental isolated tests passed Cash, UPI and Card sales individually and confirmed safe retries and exactly one stock deduction per sale. Browser sale submission, print and scanner hardware were not exercised."
      ],
      [
        "Pass",
        "PostgreSQL and build",
        "Separate integration test passed durability, concurrency, rollback and database constraints. Next.js compiled all routes successfully."
      ]
    ]
  },
  {
    "area": "UAT exclusions and remaining verification",
    "checks": [
      [
        "Deferred",
        "Live integrations",
        "Real payment and refund providers, shipping and pickup, OTP delivery, maps, AI and production authentication were outside local mock testing."
      ],
      [
        "Not run",
        "Device and operational acceptance",
        "Cross-browser/mobile matrix, keyboard-only and screen-reader walkthrough, real scanner/printer, performance/load, and production photo and measurement validation still need evidence."
      ]
    ]
  }
];

export default function RegressionReport(){
 const theme=useHostTheme();
 const [filter,setFilter]=useCanvasState("regression-status","All");
 return <main style={{padding:24,maxWidth:1080,margin:"auto",color:theme.text.primary,background:theme.bg.editor}}>
  <p style={{color:theme.text.secondary}}>12 November 2026 IST · Local development</p>
  <h1 style={{fontSize:24}}>TRENDISE pre-UAT regression</h1>
  <p style={{fontWeight:700}}>Hold full UAT sign-off</p>
  <p>49 automated tests passed across the standard and PostgreSQL suites. The web build passed. Warehouse returns currently stop at receipt and await inspection.</p>
  <label>Result <select value={filter} onChange={event=>setFilter(event.target.value)}>{["All","Pass","Partial","Open","Deferred","Not run"].map(status=><option key={status}>{status}</option>)}</select></label>
  {coverage.map(({area,checks})=>{
   const visible=checks.filter(([status])=>filter==="All"||status===filter);
   return visible.length>0&&<section key={area} style={{marginTop:24}}><h2 style={{fontSize:18}}>{area}</h2>
    {visible.map(([status,feature,evidence])=><div key={feature} style={{display:"grid",gridTemplateColumns:"82px 1fr",gap:12,padding:"10px 0",borderTop:`1px solid ${theme.stroke.secondary}`}}>
      <strong style={{color:status==="Open"?theme.accent.primary:theme.text.secondary}}>{status}</strong><div><strong>{feature}</strong><p style={{margin:"4px 0",color:theme.text.secondary}}>{evidence}</p></div>
    </div>)}
   </section>;
  })}
 </main>;
}
