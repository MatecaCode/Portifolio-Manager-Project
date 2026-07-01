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
