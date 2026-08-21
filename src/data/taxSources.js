// CPA Assistant — the authority layer. For every Schedule E tag and every
// tax-engine section, a plain-English note plus links to the ACTUAL government
// source that backs it. These prove the rule *exists*; whether it applies to a
// given set of facts is a CPA judgment call. This is not tax advice.
//
// URLs are canonical, stable irs.gov / comptroller.texas.gov pages. Kept in one
// place so the inline "📚" cites and the glossary card read from the same source.

export const SRC = {
  schedE:   { label: 'IRS — 2025 Instructions for Schedule E (Form 1040)', url: 'https://www.irs.gov/instructions/i1040se' },
  pub527:   { label: 'IRS Publication 527 — Residential Rental Property', url: 'https://www.irs.gov/publications/p527' },
  pub946:   { label: 'IRS Publication 946 — How To Depreciate Property', url: 'https://www.irs.gov/publications/p946' },
  pub925:   { label: 'IRS Publication 925 — Passive Activity and At-Risk Rules', url: 'https://www.irs.gov/publications/p925' },
  form8582: { label: 'IRS — About Form 8582 (Passive Activity Loss Limitations)', url: 'https://www.irs.gov/forms-pubs/about-form-8582' },
  form4562: { label: 'IRS — About Form 4562 (Depreciation and Amortization)', url: 'https://www.irs.gov/forms-pubs/about-form-4562' },
  schedC:   { label: 'IRS — About Schedule C (Form 1040)', url: 'https://www.irs.gov/forms-pubs/about-schedule-c-form-1040' },
  mileage:  { label: 'IRS — Standard mileage rates', url: 'https://www.irs.gov/tax-professionals/standard-mileage-rates' },
  qbi:      { label: 'IRS — Qualified Business Income Deduction (§199A)', url: 'https://www.irs.gov/newsroom/qualified-business-income-deduction' },
  niit:     { label: 'IRS — Topic no. 559, Net Investment Income Tax', url: 'https://www.irs.gov/taxtopics/tc559' },
  seTax:    { label: 'IRS — Topic no. 554, Self-Employment Tax', url: 'https://www.irs.gov/taxtopics/tc554' },
  tangible: { label: 'IRS — Tangible Property Regulations FAQ (repairs vs. improvements, de minimis)', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations' },
  txHot:    { label: 'Texas Comptroller — Hotel Occupancy Tax', url: 'https://comptroller.texas.gov/taxes/hotel/' },
  pub463:   { label: 'IRS Publication 463 — Travel, Gift, and Car Expenses', url: 'https://www.irs.gov/publications/p463' },
  pub587:   { label: 'IRS Publication 587 — Business Use of Your Home', url: 'https://www.irs.gov/publications/p587' },
  pub547:   { label: 'IRS Publication 547 — Casualties, Disasters, and Thefts', url: 'https://www.irs.gov/publications/p547' },
  pub583:   { label: 'IRS Publication 583 — Starting a Business and Keeping Records', url: 'https://www.irs.gov/publications/p583' },
  form4684: { label: 'IRS — About Form 4684 (Casualties and Thefts)', url: 'https://www.irs.gov/forms-pubs/about-form-4684' },
  form1099: { label: 'IRS — About Form 1099-NEC (Nonemployee Compensation)', url: 'https://www.irs.gov/forms-pubs/about-form-1099-nec' },
  qbiSafe:  { label: 'IRS — Revenue Procedure 2019-38 (rental real estate QBI safe harbor)', url: 'https://www.irs.gov/pub/irs-drop/rp-19-38.pdf' },
}

// Keyed by tag id (Schedule E lines / holding buckets) AND by section/concept id.
export const TAX_SOURCES = {
  // ── deduction categories → Schedule E lines ──
  advertising:       { title: 'Advertising — line 5', authority: [SRC.schedE],
    plain: 'Ordinary costs to market the rental — listing promotion, photography, listing-site ad fees.' },
  auto_travel:       { title: 'Auto & travel — line 6', authority: [SRC.schedE, SRC.mileage, SRC.pub527],
    plain: 'Vehicle costs for property-related trips, using the standard mileage rate (2025: 70¢/mi, 2026: 72.5¢/mi) or actual expenses. Personal/commuting travel doesn’t count.' },
  cleaning:          { title: 'Cleaning & maintenance — line 7', authority: [SRC.schedE, SRC.pub527],
    plain: 'Turnover cleaning and routine maintenance that keeps the property in ordinary operating condition.' },
  commissions:       { title: 'Commissions — line 8', authority: [SRC.schedE],
    plain: 'Commissions and platform host-service fees (e.g., Airbnb) paid to rent the unit.' },
  insurance:         { title: 'Insurance — line 9', authority: [SRC.schedE, SRC.pub527],
    plain: 'Landlord/STR insurance premiums for the rental. Prepaid multi-year premiums are spread over the period they cover.' },
  legal:             { title: 'Legal & professional fees — line 10', authority: [SRC.schedE],
    plain: 'Accountant, attorney, and tax-prep fees for the rental, plus entity/LLC filing costs.' },
  management:        { title: 'Management fees — line 11', authority: [SRC.schedE],
    plain: 'Property-management or co-host fees paid to operate the rental.' },
  mortgage_interest: { title: 'Mortgage interest paid to banks — line 12', authority: [SRC.schedE, SRC.pub527],
    plain: 'Mortgage interest from Form 1098 (box 1) — interest only, never principal, and only the portion after the placed-in-service date.' },
  other_interest:    { title: 'Other interest — line 13', authority: [SRC.schedE],
    plain: 'Interest tied to the rental that isn’t paid to a bank (e.g., interest to a private lender).' },
  repairs:           { title: 'Repairs — line 14', authority: [SRC.schedE, SRC.pub527, SRC.tangible],
    plain: 'Fixes that keep the property working without adding value or prolonging its life (patching a leak, repainting). Deducted in full this year — contrast capital improvements.' },
  supplies:          { title: 'Supplies — line 15', authority: [SRC.schedE],
    plain: 'Consumables for the rental — cleaning products, toiletries, small furnishings under the capitalization threshold.' },
  taxes:             { title: 'Taxes — line 16', authority: [SRC.schedE, SRC.pub527, SRC.txHot],
    plain: 'Real-estate property tax on the rental (including amounts disbursed from escrow), plus host-remitted local occupancy tax.' },
  utilities:         { title: 'Utilities — line 17', authority: [SRC.schedE, SRC.pub527],
    plain: 'Utilities you pay for the rental — electricity, gas, water, internet.' },
  depreciation:      { title: 'Depreciation — line 18', authority: [SRC.pub527, SRC.pub946, SRC.form4562],
    plain: 'Straight-line depreciation of the building over 27.5 years using the mid-month convention; land isn’t depreciable. A home converted to a rental uses the lesser of adjusted basis or FMV at conversion. Reported via Form 4562.' },
  other:             { title: 'Other — line 19', authority: [SRC.schedE],
    plain: 'Ordinary, necessary rental expenses that don’t fit lines 5–18 — itemized with a description.' },
  mortgage:          { title: 'Mortgage payment (PITI) — split, not a line', authority: [SRC.pub527, SRC.schedE],
    plain: 'A full PITI payment is not one deduction. It splits into deductible interest (line 12), escrowed property tax (line 16) and insurance (line 9); the principal portion is not deductible.' },
  improvements:      { title: 'Capital improvements — depreciated, not expensed', authority: [SRC.pub527, SRC.tangible],
    plain: 'Betterments, restorations, or adaptations that add value or prolong life (new roof, renovation) are capitalized and depreciated over time — not deducted as repairs.' },
  unclassified:      { title: 'Unclassified — needs CPA input', authority: [SRC.schedE],
    plain: 'Not an IRS category — a deliberate “ask the CPA” holding state. Items here stay out of report totals until their treatment is decided.' },

  // ── tax concepts / calculator sections ──
  schedule_e:        { title: 'Schedule E — the rental report', authority: [SRC.schedE, SRC.pub527],
    plain: 'Residential rental income and deductible expenses are reported on Schedule E (Form 1040), Part I. The net income or loss flows to your Form 1040.' },
  mortgage_split:    { title: 'Splitting the mortgage payment', authority: [SRC.pub527, SRC.schedE],
    plain: 'Only mortgage interest (Form 1098 box 1), escrowed property tax, and escrowed insurance are deductible — across lines 12/16/9. Principal repayment is never deductible.' },
  personal_use:      { title: 'Personal use of a dwelling (§280A)', authority: [SRC.pub527],
    plain: 'If personal use exceeds the greater of 14 days or 10% of the days rented at fair value, the unit is “used as a home,” capping deductions at rental income and requiring expense proration.' },
  passive_loss:      { title: 'Passive losses & the $25,000 allowance', authority: [SRC.pub925, SRC.form8582],
    plain: 'Rental losses are generally passive. Up to $25,000 can offset ordinary income with active participation, phasing out between $100k–$150k MAGI; the rest is suspended and carried forward. A short-term rental (avg. stay ≤ 7 days) with material participation may be treated as non-passive.' },
  se_tax:            { title: 'Self-employment tax & Schedule C', authority: [SRC.seTax, SRC.schedC, SRC.pub527],
    plain: 'Ordinary rental income isn’t subject to self-employment tax, but providing substantial hotel-like services can make it a business reported on Schedule C with SE tax.' },
  qbi:               { title: 'Qualified business income (20% / §199A)', authority: [SRC.qbi],
    plain: 'Rental income that rises to a trade or business may qualify for the 20% QBI deduction; a safe harbor exists for rental real estate meeting a 250-hour service and recordkeeping test.' },
  niit:              { title: 'Net investment income tax (3.8%)', authority: [SRC.niit],
    plain: 'A 3.8% tax applies to net rental and other investment income once MAGI exceeds $200,000 (single) or $250,000 (married filing jointly).' },
  set_aside:         { title: 'Set-aside estimate', authority: [SRC.schedE, SRC.pub527],
    plain: 'Rental tax is on net profit, not gross rents. The reserve shown is marginal rate × net profit — planning guidance only, not a payment due.' },
  de_minimis:        { title: 'De minimis safe harbor ($2,500)', authority: [SRC.tangible],
    plain: 'The tangible-property regulations’ de minimis election lets you expense items costing $2,500 or less per invoice/item instead of capitalizing them.' },
  bonus_depreciation:{ title: 'Bonus depreciation & cost segregation', authority: [SRC.pub946, SRC.form4562],
    plain: 'Furniture and appliances are 5–7-year property that may qualify for bonus depreciation / cost segregation, accelerating first-year deductions. Reported via Form 4562.' },
  local_hot:         { title: 'Local hotel occupancy tax', authority: [SRC.txHot],
    plain: 'State/local hotel occupancy tax on short stays is separate from income tax. Platforms may remit the state portion; the local portion is often the host’s to register for and remit.' },
}

export const sourceById = id => TAX_SOURCES[id] || null

// Ordered groups for the glossary card — "each tagging" and "each section".
export const GLOSSARY_GROUPS = [
  {
    label: 'Deduction categories (Schedule E lines)',
    ids: ['advertising', 'auto_travel', 'cleaning', 'commissions', 'insurance', 'legal', 'management',
      'mortgage_interest', 'other_interest', 'repairs', 'supplies', 'taxes', 'utilities', 'depreciation', 'other'],
  },
  {
    label: 'Holding buckets (not deductible as tagged)',
    ids: ['mortgage', 'improvements', 'unclassified'],
  },
  {
    label: 'Tax concepts & calculations',
    ids: ['schedule_e', 'mortgage_split', 'personal_use', 'passive_loss', 'se_tax', 'qbi', 'niit',
      'set_aside', 'de_minimis', 'bonus_depreciation', 'local_hot'],
  },
]

// ── "keep an eye out" watchlist ─────────────────────────────────────────────
// Deductions that DON'T announce themselves as a tagged bank line: things with
// no transaction at all (mileage, home office), things hiding inside a line
// already filed elsewhere (the cleaner's 1099, refi points), and elections you
// have to claim rather than earn (de minimis, QBI). Shown at the bottom of the
// Taxes view — one nudge each, expandable into what it is, why it qualifies,
// and the .gov page that says so.
//
// Same rule as everything else here: these prove the deduction EXISTS. Whether
// it applies to your facts is a CPA call, not this app's.
export const DEDUCTION_WATCHLIST = [
  {
    id: 'w_mileage', emoji: '🚗',
    teaser: 'Every drive out to the house is quietly worth about 70¢ a mile.',
    what: 'Trips to the property — a turnover, a repair run, meeting the pest guy, a Home Depot errand — are deductible on Schedule E line 6, either at the standard mileage rate (70¢/mi for 2025, 72.5¢/mi for 2026) or by tracking actual vehicle costs.',
    why: 'The trip is an ordinary and necessary cost of operating the rental. What makes or breaks it is proof: a contemporaneous log with the date, the miles and the purpose. Personal legs of the trip don\'t count.',
    authority: [SRC.mileage, SRC.pub463, SRC.schedE],
  },
  {
    id: 'w_home_office', emoji: '🪑',
    teaser: 'The corner of the desk where you answer guests at 11pm may be deductible.',
    what: 'A space in your Florida apartment used regularly and exclusively to run the rental can be claimed — either the simplified $5/sq ft (up to 300 sq ft) or a share of actual rent, utilities and internet.',
    why: 'Managing a short-term rental can rise to a trade or business, and the administrative space that supports it follows the same rules as any home office. "Exclusively" is the word that trips people up — a desk that doubles as the dinner table doesn\'t qualify.',
    authority: [SRC.pub587, SRC.pub527],
  },
  {
    id: 'w_furnishings', emoji: '🛋️',
    teaser: 'The sofa, the mattress and the espresso machine depreciate too — much faster than the house.',
    what: 'Furniture, appliances and equipment are 5–7-year property with their own depreciation schedule, entirely separate from the building\'s 27.5 years. Bonus depreciation or §179 can pull much of it into year one.',
    why: 'They\'re tangible property with a shorter useful life than the structure, so the tax code lets them be written off on a shorter clock. Skipping this is the single most common way a furnished STR under-deducts its first year.',
    authority: [SRC.pub946, SRC.form4562],
  },
  {
    id: 'w_de_minimis', emoji: '🧾',
    teaser: 'Anything under $2,500 an item can usually be expensed on the spot instead of depreciated for years.',
    what: 'The de minimis safe harbor election lets you deduct items costing $2,500 or less per invoice (or per item on the invoice) in the year you buy them — the toaster, the smart lock, the patio set.',
    why: 'It\'s an annual election in the tangible property regulations, made on a timely-filed return, and it wants a written capitalization policy in place at the start of the year. It\'s claimed, not automatic.',
    authority: [SRC.tangible],
  },
  {
    id: 'w_small_taxpayer', emoji: '🔧',
    teaser: 'A safe harbor for small buildings can let a big repair year stay a repair year.',
    what: 'The safe harbor for small taxpayers lets you deduct repairs, maintenance and improvements on a building whose unadjusted basis is $1M or less, as long as the year\'s total stays under the lesser of $10,000 or 2% of that basis.',
    why: 'It exists precisely so a landlord doesn\'t have to capitalize and depreciate every modest fix. Cross the ceiling and the whole election is gone for that building that year — worth watching before a December spend.',
    authority: [SRC.tangible, SRC.pub527],
  },
  {
    id: 'w_cost_seg', emoji: '🔬',
    teaser: 'A cost-segregation study can drag years of future deductions into this one.',
    what: 'An engineering-based study splits the purchase price into land, building, land improvements (15-yr) and personal property (5–7-yr) so the faster components — flooring, fixtures, driveway, landscaping — depreciate on their own shorter schedules.',
    why: 'The building isn\'t legally one asset; it\'s a bundle of components with different recovery periods. The study is what documents the split. It costs real money, so it pays off on higher-basis properties or when paired with bonus depreciation.',
    authority: [SRC.pub946, SRC.form4562],
  },
  {
    id: 'w_startup', emoji: '🚀',
    teaser: 'What you spent getting the place guest-ready before the first booking isn\'t lost — it just travels differently.',
    what: 'Costs before the placed-in-service date aren\'t current rental expenses. Some become startup costs (up to $5,000 deductible in year one, the rest amortized over 15 years), some get added to basis, and pre-service mortgage interest and property tax may belong on Schedule A instead.',
    why: 'The rental "begins" when the property is ready and available to rent, not when you bought it or started painting. Everything before that line has to find another route onto the return — but there usually is one.',
    authority: [SRC.pub583, SRC.pub527],
  },
  {
    id: 'w_travel', emoji: '✈️',
    teaser: 'An overnight trip to fix the place is a business trip, meals and all (well, half the meals).',
    what: 'Airfare, rental car, lodging and 50% of meals are deductible when the primary purpose of the trip is the rental — a renovation stretch, a turnover you handle yourself, a meeting with the property manager.',
    why: '"Primary purpose" is the test, and it\'s judged on how the days were actually spent. Keep the itinerary and the work log; a trip that\'s mostly a visit home with one afternoon at the house won\'t hold up.',
    authority: [SRC.pub463, SRC.schedE],
  },
  {
    id: 'w_contractors', emoji: '🧰',
    teaser: 'Paying the cleaner is a deduction — and past $600 it also comes with paperwork.',
    what: 'Cleaners, handymen, landscapers and co-hosts are deductible on the cleaning, repairs or management lines. Pay an unincorporated contractor $600 or more in a year in the course of your trade or business and a Form 1099-NEC is generally due by January 31.',
    why: 'The deduction is ordinary and necessary. The filing is a separate obligation that rides along with it — and missing it is the kind of thing that costs a penalty on money you were entitled to deduct anyway.',
    authority: [SRC.form1099, SRC.schedE],
  },
  {
    id: 'w_software', emoji: '📱',
    teaser: 'Every subscription that runs the listing is quietly deductible.',
    what: 'Dynamic pricing, channel managers, guest messaging, smart-lock and noise-monitor services, the photographer, the listing bump — plus the business share of your phone and internet.',
    why: 'They\'re ordinary and necessary costs of operating the rental (Schedule E lines 5, 11, 17 or 19 depending on the tool). For mixed personal/business items like a phone plan, only the rental share is deductible, so pick a defensible percentage and stay consistent.',
    authority: [SRC.schedE, SRC.pub527],
  },
  {
    id: 'w_recurring', emoji: '🌿',
    teaser: 'The lawn guy, the pest guy and the HOA are boring — and fully deductible.',
    what: 'Recurring upkeep — lawn and landscaping, pest control, pool service, gutter cleaning, HOA dues, alarm monitoring, trash — all belong on the rental\'s return as cleaning and maintenance, repairs, or other.',
    why: 'They keep the property in ordinary operating condition without adding value or prolonging its life, which is exactly the line between a deductible repair and a capitalized improvement.',
    authority: [SRC.pub527, SRC.tangible, SRC.schedE],
  },
  {
    id: 'w_occupancy_tax', emoji: '🏨',
    teaser: 'The local hotel tax you register for and remit is itself a deduction.',
    what: 'Airbnb collects and remits the 6% Texas state hotel occupancy tax, but the Allen / Collin County local portion is the host\'s to register for and pay. Whatever you remit is deductible on the taxes line.',
    why: 'It\'s a tax imposed on the rental activity and paid out of rental receipts, so it reduces rental income — separately from income tax, which it has nothing to do with.',
    authority: [SRC.txHot, SRC.schedE],
  },
  {
    id: 'w_points', emoji: '🏦',
    teaser: 'Points on a rental refinance don\'t deduct all at once — they trickle out over the loan.',
    what: 'Points paid to refinance a rental are amortized across the life of the new loan rather than deducted in the year paid. Refinance again or pay the loan off, and the unamortized remainder is generally deductible then.',
    why: 'They\'re prepaid interest on a loan that spans years, so the deduction follows the loan. The exception that lets homeowners deduct points immediately applies to buying a main home, not to a rental refi.',
    authority: [SRC.pub527, SRC.schedE],
  },
  {
    id: 'w_casualty', emoji: '🌪️',
    teaser: 'Hail, a burst pipe, a break-in — the part insurance didn\'t cover may still be deductible.',
    what: 'A sudden, unexpected loss to the property is claimed on Form 4684, reduced by any insurance reimbursement and by any repair costs you already deducted.',
    why: 'The rule that limits casualty losses to federally declared disasters applies to personal-use property. Business and income-producing property — which a rental is — isn\'t bound by that limit, which is a distinction a lot of owners miss.',
    authority: [SRC.pub547, SRC.form4684, SRC.pub527],
  },
  {
    id: 'w_qbi', emoji: '🧮',
    teaser: 'Up to 20% of the profit may simply never be taxed.',
    what: 'The §199A qualified business income deduction can take 20% off net rental profit. A safe harbor (Rev. Proc. 2019-38) treats a rental enterprise as a business if 250+ hours of rental services are performed and separate books, time logs and a statement with the return back it up.',
    why: 'It only applies to income from a trade or business, which is why the hours and the recordkeeping matter. Outside the safe harbor it can still qualify on the facts — that\'s a CPA conversation, and it\'s worth having.',
    authority: [SRC.qbi, SRC.qbiSafe],
  },
  {
    id: 'w_carryforward', emoji: '📦',
    teaser: 'A loss you can\'t use this year isn\'t gone — it sits in a box waiting for you.',
    what: 'Passive losses blocked by the income limits are suspended and carried forward on Form 8582. They free up against future rental profit, against other passive income, or in full when you sell the property in a fully taxable disposition.',
    why: 'The passive activity rules defer losses; they don\'t delete them. The catch is that they only stay tracked if they\'re actually reported each year — which is the argument for filing the Schedule E even in a quiet year.',
    authority: [SRC.pub925, SRC.form8582],
  },
  {
    id: 'w_records', emoji: '📚',
    teaser: 'The deduction you can\'t prove is the only kind you actually lose.',
    what: 'Keep receipts and invoices, the mileage log, the days rented at fair value versus days used personally, the 1098 and escrow analysis, and the closing statement from the purchase. Three years after filing is the usual floor; property records live until three years after you sell it.',
    why: 'Every deduction on this page is allowed on the assumption you can substantiate it. Basis records are the ones people wish they had kept — they set the depreciation for 27.5 years and the gain when the house eventually sells.',
    authority: [SRC.pub583, SRC.pub527],
  },
]
