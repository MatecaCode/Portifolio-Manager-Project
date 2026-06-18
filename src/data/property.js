// Property / Airbnb module data: Schedule E expense lines, attribution rules,
// and the merchant-memory helpers that power one-tap tagging + learning.
// See AIRBNB_MODULE_PLAN.md for the full design.

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
]

export const scheduleEById = id =>
  SCHEDULE_E_CATEGORIES.find(c => c.id === id) || SCHEDULE_E_CATEGORIES[SCHEDULE_E_CATEGORIES.length - 1]

// Sensible defaults for the one property we have today (Texas house). All
// figures are editable in the UI — see the plan's "known inputs" table.
export const PROPERTY_DEFAULTS = {
  name: 'Texas House',
  emoji: '🏡',
  state: 'TX',
  type: 'airbnb',
  placedInService: '2026-06-16',
  purchasePrice: 350000,
  landPct: 20,            // % of price that's land (not depreciable)
  monthlyPayment: 3100,   // PITI — split happens in the tax phase
  active: true,
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

// Unmistakable house expenses we can auto-tag on import without asking.
// The mortgage servicer line is the FULL payment (principal + interest +
// escrowed tax/insurance) — file it under 'mortgage' and split it at tax time.
const AUTO_EXPENSE_RULES = [
  [/SERVICEMAC|MORTGAGE/i, 'mortgage'],
]

export function suggestScheduleE(desc) {
  for (const [re, id] of AUTO_EXPENSE_RULES) if (re.test(desc)) return id
  return null
}

// Airbnb payouts land as deposits — recognize them as rental income.
export const isAirbnbIncome = desc => /AIRBNB/i.test(String(desc || ''))

// When a user one-taps "tag to house" on a transaction, guess a starting
// Schedule E line from its personal spending category (they can refine it).
const CAT_TO_SCHEDULE_E = {
  home:          'utilities',
  subscriptions: 'utilities',
  transport:     'auto_travel',
  groceries:     'supplies',
  shopping:      'supplies',
  fees:          'other',
  health:        'other',
  dining:        'other',
  fun:           'other',
  people:        'other',
  other:         'other',
}

export const guessScheduleE = cat => CAT_TO_SCHEDULE_E[cat] || 'other'
