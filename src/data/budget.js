// Budget categories + merchant categorization rules.
// Rules are checked in order — put more specific matches (H-E-B PHARMACY,
// UBER *EATS) before the broader ones they'd otherwise fall into.

// One list, three jobs. A transaction is sorted exactly once, and the category
// it lands in decides everything downstream:
//
//   group: 'personal' — ordinary household spending
//   group: 'house'    — the rental. `scheduleE` names the tax line it feeds,
//                       which is what lets the Taxes view be built from the
//                       same choice instead of a second round of tagging.
//   group: 'kept'     — `spend: false`: money that left the account but is
//                       still ours. Kept out of the Spent total and its budget
//                       maths, or a $3,000 brokerage deposit would read as a
//                       $3,000 shopping spree.
export const BUDGET_CATEGORIES = [
  { id: 'home',          emoji: '🏠', name: 'Home & utilities', color: '#E8A03E', group: 'personal' },
  { id: 'groceries',     emoji: '🛒', name: 'Groceries',        color: '#3E9B8F', group: 'personal' },
  { id: 'dining',        emoji: '🌮', name: 'Dining out',       color: '#E07856', group: 'personal' },
  { id: 'transport',     emoji: '🚗', name: 'Transport & gas',  color: '#6FA8C9', group: 'personal' },
  { id: 'subscriptions', emoji: '📺', name: 'Subscriptions',    color: '#E5B45E', group: 'personal' },
  { id: 'shopping',      emoji: '🛍️', name: 'Shopping',         color: '#9C8EC9', group: 'personal' },
  { id: 'health',        emoji: '🩺', name: 'Health & fitness', color: '#7BB686', group: 'personal' },
  { id: 'fun',           emoji: '🎢', name: 'Fun & travel',     color: '#D98BB6', group: 'personal' },
  { id: 'people',        emoji: '🤝', name: 'Friends & family', color: '#8FAE9B', group: 'personal' },
  { id: 'fees',          emoji: '🏛️', name: 'Fees & interest',  color: '#B0876B', group: 'personal' },

  // ── the rental ────────────────────────────────────────────────────────
  // Each one is a Schedule E line wearing a friendly name. Picking the
  // category IS the tax classification — there is no second step.
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
  { id: 'house_fees',      emoji: '🤝', name: 'House · Host & mgmt fees', color: '#8FAE9B', group: 'house', scheduleE: 'commissions' },
  { id: 'house_other',     emoji: '🧾', name: 'House · Other',           color: '#A8A29A', group: 'house', scheduleE: 'other' },
  { id: 'house_cpa',       emoji: '🚧', name: 'House · Ask the CPA',     color: '#C08552', group: 'house', scheduleE: 'unclassified',
    blurb: 'Genuinely ambiguous. Held out of the deduction totals until a CPA rules on it, rather than force-fit into a line.' },

  { id: 'investing',     emoji: '📈', name: 'Investing & saving', color: '#2A7A70', group: 'kept', spend: false,
    blurb: 'Money moved to a brokerage or savings account — still yours, just working. Kept out of the spending total.' },
  { id: 'other',         emoji: '🧺', name: 'Everything else',  color: '#A8A29A', group: 'personal' },
]

export const CATCH_ALL = 'other'
export const catById = id =>
  BUDGET_CATEGORIES.find(c => c.id === id) || BUDGET_CATEGORIES.find(c => c.id === CATCH_ALL)

// Does this category count as money spent? Everything does unless it says
// otherwise, so a category added later is spending by default.
export const isSpendCategory = id => catById(id).spend !== false

// ── the rental ────────────────────────────────────────────────────────────
// One property today, so a house category implies which property. If a second
// one is ever added it needs its own dimension — the category alone can't say.
export const isHouseCategory = id => catById(id).group === 'house'
export const HOUSE_CATEGORIES = BUDGET_CATEGORIES.filter(c => c.group === 'house')
export const HOUSE_EXPENSE_CATEGORIES = HOUSE_CATEGORIES.filter(c => !c.income)
// Which Schedule E line a category feeds. 'other' for a house category with no
// explicit mapping; null for anything that isn't the rental's at all.
export const scheduleELineFor = id => {
  const c = catById(id)
  return c.group === 'house' ? (c.scheduleE || 'other') : null
}
// Expense categories offerable for a transaction of this kind. Rental income
// has a category too, and it must not show up in an expense picker.
export const categoriesFor = kind =>
  BUDGET_CATEGORIES.filter(c => (kind === 'income' ? c.income : !c.income))

export const CATEGORY_GROUPS = [
  { id: 'personal', label: 'Personal' },
  { id: 'house',    label: 'The house (rental)' },
  { id: 'kept',     label: 'Kept, not spent' },
]

// Money headed to an investment / brokerage account isn't spent — it's still
// yours, just working. We recognize the usual destinations by description.
// Heuristic and easily extended; a tagged-account model can supersede it later.
// Lives here rather than next to the statement parsers because it is
// categorization knowledge, and the parsers already depend on this module.
const INVESTMENT_DESTINATIONS = /WEALTHFRONT|FIDELITY|VANGUARD|SCHWAB|ROBINHOOD|COINBASE|KRAKEN|INTERACTIVE BROKERS|\bIBKR\b|BETTERMENT|ETRADE|E\*TRADE|TD AMERITRADE|ACORNS|MERRILL|SOFI INVEST|WEBULL|BINANCE\.US|BINANCE US|BROKERAGE/i
export const isInvestmentTransfer = desc => INVESTMENT_DESTINATIONS.test(String(desc || ''))

const RULES = [
  // investing first: a brokerage ACH must never fall into a spending bucket
  [INVESTMENT_DESTINATIONS, 'investing'],

  // The rental, before the personal buckets that would otherwise claim these.
  // Only the unmistakable ones auto-file — the mortgage servicer and the
  // platform fees. A hardware-store run or a plumber could be either house or
  // home, so those stay personal until a rule or a click says otherwise.
  // The servicer line is the FULL payment (principal + interest + escrowed
  // tax/insurance); the Taxes view splits it from the 1098 and escrow figures.
  [/SERVICEMAC/i, 'house_mortgage'],
  [/AIRBNB.*(FEE|COMMISSION|SERVICE)|VRBO.*(FEE|COMMISSION)|\bHOSPITABLE\b|\bGUESTY\b|\bTURNO\b|\bPRICELABS\b/i, 'house_fees'],

  // health first: "H-E-B PHARMACY" must not fall into groceries
  [/PHARMACY|CVS|WALGREEN|ORTHO|SURG|BAYLOR|MEDICAL|DENTAL|CLINIC|HOSPITAL|URGENT|LABCORP|QUEST DIAG|OPTOMETR|DERMATOL/i, 'health'],
  [/FIT CONNECT|FITNESS|PLANET FIT|GYM|LA FITNESS|EQUINOX|CROSSFIT|YOGA/i, 'health'],

  // fees
  [/MEMBERSHIP FEE|ANNUAL FEE|INTEREST CHARGE|OVERDRAFT|LATE FEE|SERVICE FEE|FOREIGN TRANSACTION|ATM FEE/i, 'fees'],

  // dining before transport (UBER *EATS vs UBER) and before groceries
  [/UBER\s*\*?EATS|DOORDASH|GRUBHUB|FAVOR DELIV/i, 'dining'],
  [/DELI|BRAUM|RESTAURANT|CAFE|COFFEE|STARBUCK|CHICK-FIL|MCDONALD|WHATABURGER|BURGER|TACO|PIZZA|SUSHI|WINGSTOP|CHIPOTLE|IHOP|DENNY|PANERA|SONIC DRIVE|RAISING CANE|POPEYES|KFC|SUBWAY|DUNKIN|BAKERY|GRILL|KITCHEN|DINER|BBQ|RAMEN|PHO |BOBA|SMOOTHIE|AMK NATL/i, 'dining'],

  // subscriptions before shopping (GOOGLE*, Amazon Prime)
  [/ANTHROPIC|OPENAI|CHATGPT|GOOGLE\s*\*|NETFLIX|SPOTIFY|HULU|DISNEY|CRUNCHYROLL|CAPCUT|APPLE\.COM|PRIME VIDEO|AMAZON PRIME|ADOBE|DROPBOX|ICLOUD|YOUTUBE|PARAMOUNT|HBO|MAX\.COM|AUDIBLE|PATREON|TWITCH|CANVA|NOTION|MIDJOURNEY/i, 'subscriptions'],

  // groceries
  [/H-E-B|HEB |KROGER|TOM THUMB|ALDI|WALMART|WHOLE FOODS|TRADER JOE|COSTCO|SPROUTS|ALBERTSON|SAFEWAY|WINCO|FIESTA MART|CENTRAL MARKET|99 RANCH|GROCERY/i, 'groceries'],

  // transport & gas
  [/\bQT \d|QUIKTRIP|VALERO|SHELL|EXXON|CHEVRON|MOBIL|RACETRAC|BUC-?EE|7-ELEVEN|CIRCLE K|MURPHY|FUEL|GAS STATION|UBER|LYFT|NTTA|TOLL|PARKING|AUTOZONE|O'?REILLY|DISCOUNT TIRE|JIFFY LUBE|TAKE 5|CAR WASH|DMV|DPS\b/i, 'transport'],

  // home services — lawn, pool, pest, repairs (often paid by Zelle/check to a
  // local pro). Specific phrases so "POOL HALL" stays fun and "TREES" isn't caught.
  [/LAWN|LANDSCAP|IRRIGAT|SPRINKLER|TREE SERVICE|PEST CONTROL|EXTERMINAT|HANDY ?MAN|PLUMB|ROOFING|ROOFER|HVAC|AIR CONDITION|SEPTIC|POOL SERVICE|POOL SUPPLY|MAID|HOUSE ?KEEP|HOUSE ?CLEAN|JANITOR|GUTTER|FENCE|PAINTER|ELECTRICIAN/i, 'home'],

  // home & utilities (Servicemac = the mortgage servicer; landlord Zelles = rent)
  [/SERVICEMAC|MORTGAGE|RENT\b|LANDLORD|ATMOS|TXU|RELIANT|GREEN MOUNTAIN|CITY OF|WATER UTIL|ELECTRIC|AT&T|SPECTRUM|FRONTIER|XFINITY|VERIZON|T-MOBILE|HOME DEPOT|LOWE'?S|STATE FARM|ALLSTATE|GEICO|PROGRESSIVE|HOA |INSURANCE/i, 'home'],

  // fun & travel
  [/SPA |MOVIE|CINEMA|CINEMARK|AMC |TICKETMASTER|STUBHUB|HOTEL|AIRBNB|VRBO|EXPEDIA|AIRLINE|AMERICAN AIR|SPIRIT AIR|DELTA AIR|UNITED AIR|SOUTHWES|FRONTIER AIR|STEAM|PLAYSTATION|NINTENDO|XBOX|TOPGOLF|BOWL|ARCADE|MUSEUM|ZOO |SIX FLAGS|THEME PARK|RESORT/i, 'fun'],

  // friends & family / person-to-person
  [/ZELLE|VENMO|CASH APP|APOIASE|GOFUNDME|WESTERN UNION|REMITLY|WISE\b/i, 'people'],

  // shopping (broad — keep late). KLARNA/AFFIRM/AFTERPAY = buy-now-pay-later
  [/AMAZON|AMZN|GROUPON|TARGET|BEST BUY|ETSY|EBAY|MACY|ROSS |MARSHALLS|TJ ?MAXX|NIKE|ADIDAS|SHEIN|TEMU|ALIEXPRESS|IKEA|FIVE BELOW|DOLLAR (TREE|GENERAL)|BARNES|GAMESTOP|SEPHORA|ULTA|KLARNA|AFFIRM|AFTERPAY/i, 'shopping'],
]

export function categorize(desc) {
  for (const [re, cat] of RULES) if (re.test(desc)) return cat
  return 'other'
}

// ── Smart rules (user-created) ──────────────────────────────────────
// A rule the user builds in the app: "when the description CONTAINS <phrase>,
// set the category and/or tag it to a property and/or send it to review".
// Shape: { id, contains, enabled, category, propertyId, scheduleE, review }
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
