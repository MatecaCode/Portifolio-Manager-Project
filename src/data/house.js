// The rental's categories + the merchant rules that file transactions into them.
//
// This app no longer tracks household spending (Rocket Money does that). The only
// question it asks of an imported transaction is "is this the Texas house?" — so
// there are exactly two kinds of category:
//
//   group: 'personal' — one bucket. Not the rental, not reported, not totalled.
//                       Everything lands here until something says otherwise.
//   group: 'house'    — the rental. `scheduleE` names the tax line it feeds, so
//                       picking the bucket IS the tax classification. There is no
//                       second round of tagging.
//
// Rules are checked in order — put more specific matches before the broader ones
// they'd otherwise fall into.

export const PERSONAL = 'personal'

export const PERSONAL_CATEGORY = {
  id: PERSONAL, emoji: '👤', name: 'Personal — not the rental', color: '#A8A29A', group: 'personal',
  blurb: 'Everything that isn\'t the house. Kept only so you can search it for a house expense later — nothing is budgeted, totalled or reported.',
}

// Each one is a Schedule E line wearing a friendly name.
export const HOUSE_CATEGORIES = [
  { id: 'house_income',    emoji: '💰', name: 'House · Rental income',   color: '#3E9B8F', group: 'house', income: true },
  { id: 'house_mortgage',  emoji: '🏡', name: 'House · Mortgage',        color: '#C9A24B', group: 'house', scheduleE: 'mortgage' },
  { id: 'house_tax',       emoji: '🏛️', name: 'House · Property tax',    color: '#C98B6B', group: 'house', scheduleE: 'taxes' },
  { id: 'house_insurance', emoji: '🛡️', name: 'House · Insurance',       color: '#7BB686', group: 'house', scheduleE: 'insurance' },
  { id: 'house_utilities', emoji: '💡', name: 'House · Utilities',       color: '#D98BB6', group: 'house', scheduleE: 'utilities' },
  { id: 'house_repairs',   emoji: '🔧', name: 'House · Repairs',         color: '#E07856', group: 'house', scheduleE: 'repairs' },
  { id: 'house_improve',   emoji: '🔨', name: 'House · Improvements',    color: '#B5774E', group: 'house', scheduleE: 'improvements',
    blurb: 'Capital work — a new roof, a renovation. Added to the property\'s basis and depreciated, never expensed in one year.' },
  { id: 'house_cleaning',  emoji: '🧽', name: 'House · Cleaning & turnover', color: '#3E9B8F', group: 'house', scheduleE: 'cleaning' },
  { id: 'house_supplies',  emoji: '🧺', name: 'House · Supplies',        color: '#A89C8A', group: 'house', scheduleE: 'supplies' },
  { id: 'house_fees',      emoji: '🤝', name: 'House · Host service fees', color: '#8FAE9B', group: 'house', scheduleE: 'commissions',
    blurb: 'What the platform keeps — Airbnb/VRBO host service fees, booking commissions.' },
  { id: 'house_management', emoji: '🧑‍💼', name: 'House · Management fees', color: '#9C8EC9', group: 'house', scheduleE: 'management',
    blurb: 'Paid to a person, not a platform — a co-host, a property manager, a turnover coordinator.' },
  { id: 'house_travel',    emoji: '🚗', name: 'House · Auto & travel',   color: '#6FA8C9', group: 'house', scheduleE: 'auto_travel' },
  { id: 'house_legal',     emoji: '⚖️', name: 'House · Legal & professional', color: '#B0876B', group: 'house', scheduleE: 'legal' },
  { id: 'house_advertising', emoji: '📣', name: 'House · Advertising',   color: '#E5B45E', group: 'house', scheduleE: 'advertising' },
  { id: 'house_interest',  emoji: '💳', name: 'House · Other interest',  color: '#C9A24B', group: 'house', scheduleE: 'other_interest',
    blurb: 'Rental interest that isn\'t paid to a bank — a private lender, or a card carried for the property.' },
  { id: 'house_other',     emoji: '🧾', name: 'House · Other',           color: '#A8A29A', group: 'house', scheduleE: 'other' },
  { id: 'house_cpa',       emoji: '🚧', name: 'House · Ask the CPA',     color: '#C08552', group: 'house', scheduleE: 'unclassified',
    blurb: 'Genuinely ambiguous. Held out of the deduction totals until a CPA rules on it, rather than force-fit into a line.' },
]

export const ALL_CATEGORIES = [PERSONAL_CATEGORY, ...HOUSE_CATEGORIES]

// Anything unrecognized — including every category from the old budget app — is
// personal. That's what makes the migration away from spending a one-liner.
export const catById = id => ALL_CATEGORIES.find(c => c.id === id) || PERSONAL_CATEGORY

// ── the rental ────────────────────────────────────────────────────────────
// One property today, so a house category implies which property. If a second
// one is ever added it needs its own dimension — the category alone can't say.
export const isHouseCategory = id => catById(id).group === 'house'
export const HOUSE_EXPENSE_CATEGORIES = HOUSE_CATEGORIES.filter(c => !c.income)
export const HOUSE_INCOME_CATEGORIES = HOUSE_CATEGORIES.filter(c => c.income)

// Which Schedule E line a category feeds. 'other' for a house category with no
// explicit mapping; null for anything that isn't the rental's at all.
export const scheduleELineFor = id => {
  const c = catById(id)
  return c.group === 'house' ? (c.scheduleE || 'other') : null
}

// Categories offerable for a transaction of this kind. Rental income has a
// category of its own, and it must not show up in an expense picker.
export const categoriesFor = kind =>
  kind === 'income'
    ? [PERSONAL_CATEGORY, ...HOUSE_INCOME_CATEGORIES]
    : [PERSONAL_CATEGORY, ...HOUSE_EXPENSE_CATEGORIES]

export const CATEGORY_GROUPS = [
  { id: 'personal', label: 'Not the rental' },
  { id: 'house',    label: 'The house (rental)' },
]

// Only the unmistakable lines auto-file: the mortgage servicer and the hosting
// platforms' fees. A hardware-store run or a plumber could just as easily be the
// apartment, so those stay personal until a rule or a click says otherwise.
// The servicer line is the FULL payment (principal + interest + escrowed
// tax/insurance); the Taxes view splits it from the 1098 and escrow figures.
const RULES = [
  [/SERVICEMAC/i, 'house_mortgage'],
  [/AIRBNB.*(FEE|COMMISSION|SERVICE)|VRBO.*(FEE|COMMISSION)|\bHOSPITABLE\b|\bGUESTY\b|\bTURNO\b|\bPRICELABS\b/i, 'house_fees'],
]

export function categorize(desc) {
  for (const [re, cat] of RULES) if (re.test(desc)) return cat
  return PERSONAL
}

// ── Smart rules (user-created) ──────────────────────────────────────
// A rule the user builds in the app: "when the description CONTAINS <phrase>,
// file it into <category> — or refuse to guess and send it to review".
// Shape: { id, contains, enabled, category, review }
// Matching is a simple case-insensitive substring — predictable and easy to
// explain, which is the whole point of letting non-engineers write the logic.
export const smartRuleMatches = (rule, tx) =>
  rule?.enabled !== false &&
  !!rule?.contains &&
  String(tx?.desc || '').toUpperCase().includes(String(rule.contains).toUpperCase())

// Suggest a starting "contains" phrase from a description, so the wizard opens
// pre-filled with something sensible (the recipient for a Zelle, the brand
// otherwise). Always editable — it's just a friendly default.
export function suggestRulePhrase(desc) {
  const raw = String(desc || '').toUpperCase()
  const p2p = raw.match(/\b(?:ZELLE|VENMO|CASH ?APP|CASHAPP|PAYPAL|APPLE CASH)\b/)
  if (p2p) {
    const name = raw.slice(p2p.index + p2p[0].length)
      .replace(/[^A-Z0-9 ]/g, ' ')
      .replace(/\b(PAYMENT|PMT|TO|FROM|FOR|ID|WEB|REF|CONF|JPM[A-Z0-9]*)\b/g, ' ')
      .replace(/\b[A-Z]*\d[A-Z0-9]*\b/g, ' ')
      .replace(/\s+/g, ' ').trim()
      .split(' ').filter(Boolean)[0]
    if (name) return name
  }
  const words = raw
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\b\d[\dA-Z]*\b/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .split(' ').filter(Boolean)
  return words.slice(0, 2).join(' ')
}
