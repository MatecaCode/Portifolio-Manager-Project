// Moving saved state onto the country-sticker model.
//
// Before: the bucket carried the country and the currency — `br_stocks` and
// `us_stocks` were separate buckets, and "US Stocks" quietly held the whole
// energy thesis. After: buckets are about the thesis (Stocks / Energy / Water /
// Rare Earths), and the country rides along on each holding as a sticker that
// also decides its currency and price source.
//
// Everything here is idempotent — already-migrated state passes through
// untouched — because it runs on every load, against both the Supabase row and
// the localStorage copy.
import { CATEGORIES, DEFAULT_CATEGORY_REGION, DEFAULT_REGION, DEFAULT_TARGETS, REGIONS } from '../data/portfolio'

// Old bucket → new bucket + the sticker its holdings always implied.
// `intl` keeps a BR sticker on purpose: WRLD11/USDB11 are B3-listed wrappers
// and the multimercado funds are BRL — the bucket says *what* the exposure is,
// the sticker says where it trades.
const LEGACY_CATEGORY = {
  br_stocks:  { category: 'stocks',     region: 'br' },
  us_stocks:  { category: 'stocks',     region: 'us' },
  fii:        { category: 'fii',        region: 'br' },
  renda_fixa: { category: 'renda_fixa', region: 'br' },
  intl:       { category: 'intl',       region: 'br' },
  crypto:     { category: 'crypto',     region: 'global' },
}

// Themes written by the review flow, for candidates approved before the split.
const THEME_CATEGORY = { water: 'water', 'rare earths': 'rare_earths', 'rare earth': 'rare_earths', energy: 'energy' }

const isKnownCategory = id => CATEGORIES.some(c => c.id === id)
const isKnownRegion   = id => REGIONS.some(r => r.id === id)
const themeCategory   = theme => THEME_CATEGORY[(theme || '').trim().toLowerCase()]

// Shared by holdings and review candidates: both carry category + region.
function resolvePlacement({ category, region, theme, energy }) {
  const legacy = LEGACY_CATEGORY[category]
  let next = legacy?.category ?? (isKnownCategory(category) ? category : 'stocks')
  const sticker = isKnownRegion(region)
    ? region
    : (legacy?.region ?? DEFAULT_CATEGORY_REGION[next] ?? DEFAULT_REGION)

  // The EN tag and the review themes were how narrow bets survived inside a
  // broad bucket. Now they *are* buckets, so promote them once — but only for a
  // record still on the old model. Once something sits in a new bucket that's a
  // deliberate choice, and a stale theme string must never drag it back.
  if (legacy && next === 'stocks') {
    if (energy) next = 'energy'
    else if (themeCategory(theme)) next = themeCategory(theme)
  }
  return { category: next, region: sticker }
}

export function migrateHolding(holding) {
  if (!holding) return holding
  const next = { ...holding, ...resolvePlacement(holding) }
  delete next.energy // the EN tag is gone — it's the Energy bucket now
  return next
}

export function migrateHoldings(holdings) {
  return Array.isArray(holdings) ? holdings.map(migrateHolding) : holdings
}

export function migrateReviews(reviews) {
  if (!Array.isArray(reviews)) return reviews
  return reviews.map(r => (r ? { ...r, ...resolvePlacement(r) } : r))
}

const round1 = n => Math.round(n * 10) / 10

// Targets have to keep summing to whatever they summed to before, or the
// Rebalance tab starts nagging about a number the user never changed. The old
// US sleeve is split across the three sleeves it became, in the same 12:5:3
// proportion as the new defaults, with the rounding remainder landing on
// rare earths so the total is preserved exactly.
export function migrateTargets(targets) {
  if (!targets || typeof targets !== 'object') return { ...DEFAULT_TARGETS }
  const { br_stocks, us_stocks, ...rest } = targets
  const out = { ...rest }

  if (br_stocks != null) out.stocks = (parseFloat(out.stocks) || 0) + (parseFloat(br_stocks) || 0)
  if (us_stocks != null) {
    const pool = parseFloat(us_stocks) || 0
    const energy = round1(pool * 0.60)
    const water = round1(pool * 0.25)
    out.energy = (parseFloat(out.energy) || 0) + energy
    out.water = (parseFloat(out.water) || 0) + water
    out.rare_earths = round1((parseFloat(out.rare_earths) || 0) + pool - energy - water)
  }

  // Any bucket the saved state never heard of starts at 0 rather than at its
  // default — adding a default here would push the total past 100%.
  CATEGORIES.forEach(c => { if (out[c.id] == null) out[c.id] = 0 })
  return out
}

export function migrateState({ holdings, targets, reviews }) {
  return {
    holdings: migrateHoldings(holdings),
    targets: migrateTargets(targets),
    reviews: migrateReviews(reviews),
  }
}
