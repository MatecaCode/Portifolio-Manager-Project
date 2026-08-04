// Property / Airbnb module data: Schedule E lines, the property's tax-engine
// inputs, and the merchant-key helper the learned rules are built on.
// See AIRBNB_MODULE_PLAN.md for the full design.
//
// Filing a transaction to the house is no longer a second step — the House
// categories in data/budget.js each name the Schedule E line they feed, so the
// lines below are what the Taxes view *reports*, not what the user picks.

// Schedule E (Form 1040) deductible-expense lines for a residential rental,
// plus two practical buckets for this household:
//   • mortgage      — the full PITI payment (split into interest/escrow at tax time)
//   • improvements  — capital work (foundation, renovations): NOT expensed, it's
//                     added to basis and depreciated. Kept distinct from repairs.
// Depreciation itself is computed (not a transaction), so it isn't in this list.
export const SCHEDULE_E_CATEGORIES = [
  { id: 'mortgage',          emoji: '🏠',  name: 'Mortgage payment',       color: '#C9A24B' },
  { id: 'mortgage_interest', emoji: '🏦',  name: 'Mortgage interest',      color: '#E8A03E' },
  { id: 'taxes',             emoji: '🏛️',  name: 'Property tax',           color: '#C98B6B' },
  { id: 'insurance',         emoji: '🛡️',  name: 'Insurance',              color: '#7BB686' },
  { id: 'utilities',         emoji: '💡',  name: 'Utilities',              color: '#D98BB6' },
  { id: 'repairs',           emoji: '🔧',  name: 'Repairs',                color: '#E07856' },
  { id: 'improvements',      emoji: '🔨',  name: 'Improvements & work',    color: '#B5774E' },
  { id: 'cleaning',          emoji: '🧽',  name: 'Cleaning & maintenance', color: '#3E9B8F' },
  { id: 'supplies',          emoji: '🧺',  name: 'Supplies',               color: '#A89C8A' },
  { id: 'commissions',       emoji: '🤝',  name: 'Commissions (host fees)', color: '#8FAE9B' },
  { id: 'management',        emoji: '🧑‍💼', name: 'Management fees',         color: '#9C8EC9' },
  { id: 'advertising',       emoji: '📣',  name: 'Advertising',            color: '#E5B45E' },
  { id: 'auto_travel',       emoji: '🚗',  name: 'Auto & travel',          color: '#6FA8C9' },
  { id: 'legal',             emoji: '⚖️',  name: 'Legal & professional',   color: '#B0876B' },
  { id: 'other',             emoji: '🧾',  name: 'Other',                  color: '#A8A29A' },
  // Not a Schedule E line — a deliberate holding state. Anything genuinely
  // ambiguous stays here (excluded from report totals) until a CPA rules on it,
  // rather than being force-fit into a deductible category.
  { id: 'unclassified',      emoji: '🚧',  name: 'Unclassified — needs CPA', color: '#C08552' },
]

export const scheduleEById = id =>
  SCHEDULE_E_CATEGORIES.find(c => c.id === id) ||
  SCHEDULE_E_CATEGORIES.find(c => c.id === 'other')

// The tax-engine inputs that hang off a property (Phase 3). Every dollar figure
// here is an ESTIMATE until the user ticks `confirmed`; the report stays
// watermarked draft and never treats these as final. Sourced from Form 1098, the
// year-end escrow analysis, and the county appraisal (Collin CAD) — not guessed.
export const TAX_DEFAULTS = {
  // Depreciation basis (converted primary residence → lesser-of-basis rule).
  fmvAtConversion: null,        // FMV on the date it became a rental
  landValue: null,             // $ land from the county allocation (else landPct)
  buildingBasisOverride: null, // manual override if the CPA gives a figure
  businessUsePct: 100,         // <100 only if personal use applies (§280A)
  capitalImprovements: [],     // [{ id, desc, amount, placedInService }] each own 27.5-yr clock
  // Mortgage split (Form 1098 + escrow analysis).
  form1098: { mortgageInterest: null, points: null },
  escrow: { propertyTax: null, insurance: null },
  // §280A personal-use tracking (normally 0 here — not owner-occupied).
  personalUseDays: 0,
  fairRentalDays: null,
  avgStayDays: null,           // ≤7 gates the short-term-rental exception question
  // Filer (one property, one filer today; lifted out if multi-property later).
  filingStatus: 'single',
  marginalRatePct: 24,
  magi: null,
  materiallyParticipates: null, // null = undecided → CPA flag, never auto-set
  confirmed: false,
}

// Sensible defaults for the one property we have today. All figures are editable
// in the UI and clearly labeled as estimates — see the plan's "known inputs" table.
export const PROPERTY_DEFAULTS = {
  name: 'Texas House',
  emoji: '🏡',
  address: '529 English Oak Dr, Allen, TX',
  state: 'TX',
  type: 'airbnb',
  placedInService: '2026-06-16',
  purchasePrice: 350000,
  landPct: 20,            // % of price that's land (not depreciable)
  monthlyPayment: 3100,   // PITI — split happens in the tax phase
  active: true,
  tax: TAX_DEFAULTS,
}

// Person-to-person payment rails. For these the "merchant" is the COUNTERPARTY,
// not the rail — "Zelle to Borrelio" and "Zelle to Mom" must key differently or
// one learned rule would swallow every Zelle you ever send.
const P2P_RAIL = /\b(ZELLE|VENMO|CASH ?APP|CASHAPP|PAYPAL|APPLE CASH)\b/
// Connective + bookkeeping words that sit between the rail and the actual name.
const P2P_NOISE = /\b(PAYMENT|PMT|TO|FROM|FOR|ID|WEB|REF|CONF|RECURRING|INSTANT|TRANSFER|VIA|SENT|RECEIVED)\b/g

// Normalize a bank description down to a stable "merchant" so the same vendor
// auto-tags every month (Octopus Energy, Spectrum…). Strips store numbers,
// punctuation, and trailing location noise; keeps the leading words. For
// person-to-person payments it keys on the recipient instead, so tagging
// "Zelle to Borrelio" once teaches *Borrelio*, not all of Zelle.
export function merchantKey(desc) {
  const raw = String(desc || '').toUpperCase()
  const rail = raw.match(P2P_RAIL)
  if (rail) {
    const railName = rail[1].replace(/\s+/g, '')   // CASH APP → CASHAPP
    const name = raw.slice(rail.index + rail[0].length)
      .replace(/[^A-Z0-9 ]/g, ' ')                 // *, #, : → space
      .replace(P2P_NOISE, ' ')                      // drop "PAYMENT TO" etc.
      .replace(/\bJPM[A-Z0-9]*\b/g, ' ')           // Chase Zelle confirmation token
      .replace(/\b[A-Z]*\d[A-Z0-9]*\b/g, ' ')      // drop any token with a digit (IDs)
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)                                  // first/last name is enough
      .join(' ')
    return name ? `${railName} ${name}` : railName
  }
  return raw
    .replace(/[^A-Z0-9 ]/g, ' ')   // drop punctuation (#, *, etc.)
    .replace(/\b\d[\d]*\b/g, ' ')  // drop standalone number tokens
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ')
    .trim()
}

// Airbnb payouts land as deposits — recognize them as rental income.
export const isAirbnbIncome = desc => /AIRBNB/i.test(String(desc || ''))
