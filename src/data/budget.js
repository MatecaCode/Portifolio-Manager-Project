// Budget categories + merchant categorization rules.
// Rules are checked in order — put more specific matches (H-E-B PHARMACY,
// UBER *EATS) before the broader ones they'd otherwise fall into.

export const BUDGET_CATEGORIES = [
  { id: 'home',          emoji: '🏠', name: 'Home & utilities', color: '#E8A03E' },
  { id: 'groceries',     emoji: '🛒', name: 'Groceries',        color: '#3E9B8F' },
  { id: 'dining',        emoji: '🌮', name: 'Dining out',       color: '#E07856' },
  { id: 'transport',     emoji: '🚗', name: 'Transport & gas',  color: '#6FA8C9' },
  { id: 'subscriptions', emoji: '📺', name: 'Subscriptions',    color: '#E5B45E' },
  { id: 'shopping',      emoji: '🛍️', name: 'Shopping',         color: '#9C8EC9' },
  { id: 'health',        emoji: '🩺', name: 'Health & fitness', color: '#7BB686' },
  { id: 'fun',           emoji: '🎢', name: 'Fun & travel',     color: '#D98BB6' },
  { id: 'people',        emoji: '🤝', name: 'Friends & family', color: '#8FAE9B' },
  { id: 'fees',          emoji: '🏛️', name: 'Fees & interest',  color: '#B0876B' },
  { id: 'other',         emoji: '🧺', name: 'Everything else',  color: '#A8A29A' },
]

export const catById = id => BUDGET_CATEGORIES.find(c => c.id === id) || BUDGET_CATEGORIES[BUDGET_CATEGORIES.length - 1]

const RULES = [
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
