import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPrices } from '../lib/prices'
import { SEED_HOLDINGS, DEFAULT_TARGETS, CATEGORIES, CASH_ACCOUNTS, SEED_REVIEWS,
         DEFAULT_CATEGORY_REGION, DEFAULT_REGION, REGIONS, holdingCurrency, holdingRegion } from '../data/portfolio'
import { migrateHoldings, migrateReviews, migrateTargets } from '../lib/migrate'

const LS_KEY = 'portfolio_v4'

// Columns added after the table was first created. A deployment whose Supabase
// schema predates them still syncs everything else.
const OPTIONAL_COLUMNS = ['reviews', 'imported_lots']

function lsLoad() {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function lsSave(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}

export function usePortfolio() {
  const [holdings, setHoldings]       = useState([])
  const [accounts, setAccounts]       = useState(CASH_ACCOUNTS)
  const [reviews, setReviews]         = useState(SEED_REVIEWS)
  // Ledger of broker trades already applied, so re-importing a statement can't
  // silently double a position. See planIbkrImport() for the matching rules.
  const [importedLots, setImportedLots] = useState([])
  const [targets, setTargets]         = useState(DEFAULT_TARGETS)
  const [fxRate, setFxRate]           = useState(5.70)
  const [priceStatus, setPriceStatus] = useState('idle')
  const [priceErrors, setPriceErrors] = useState([])
  // ticker -> { source, at } for quotes that actually arrived this session
  const [priceMeta, setPriceMeta]     = useState({})
  const [priceCoverage, setPriceCoverage] = useState({ live: 0, total: 0 })
  const [lastUpdated, setLastUpdated] = useState(null)
  const [syncStatus, setSyncStatus]   = useState('local') // local | synced | syncing | error
  const [ready, setReady]             = useState(false)
  const saveTimer = useRef(null)
  const priceTimer = useRef(null)

  // ── Load: Supabase first, fallback localStorage ──
  useEffect(() => {
    async function init() {
      if (supabase) {
        try {
          setSyncStatus('syncing')
          const { data, error } = await supabase
            .from('portfolio_state')
            .select('*')
            .eq('id', 'shared')
            .single()
          if (!error && data) {
            // Saved state predates the country-sticker split, so everything
            // coming out of storage passes through the migration first.
            setHoldings(migrateHoldings(data.holdings?.length ? data.holdings : SEED_HOLDINGS))
            setAccounts(data.accounts?.length ? data.accounts : CASH_ACCOUNTS)
            setTargets(data.targets && Object.keys(data.targets).length ? migrateTargets(data.targets) : DEFAULT_TARGETS)
            setFxRate(data.fx_rate || 5.70)
            // reviews: an empty cloud list is a legit "reviewed everything" state,
            // so respect any array. Only seed when the column is absent (undefined)
            // and there's no local copy either.
            if (Array.isArray(data.reviews)) setReviews(migrateReviews(data.reviews))
            else setReviews(migrateReviews(lsLoad()?.reviews ?? SEED_REVIEWS))
            setImportedLots(Array.isArray(data.imported_lots) ? data.imported_lots : (lsLoad()?.importedLots ?? []))
            setSyncStatus('synced')
            setReady(true)
            return
          }
        } catch {}
      }
      // Fallback to localStorage
      const saved = lsLoad()
      setHoldings(migrateHoldings(saved?.holdings?.length ? saved.holdings : SEED_HOLDINGS))
      setAccounts(saved?.accounts?.length ? saved.accounts : CASH_ACCOUNTS)
      setTargets(saved?.targets ? migrateTargets(saved.targets) : DEFAULT_TARGETS)
      setFxRate(saved?.fxRate || 5.70)
      setReviews(migrateReviews(saved?.reviews ?? SEED_REVIEWS))
      setImportedLots(saved?.importedLots ?? [])
      setSyncStatus('local')
      setReady(true)
    }
    init()
  }, [])

  // ── Save debounced ──
  const persistState = useCallback((h, t, fx, acc, rev, lots = importedLots) => {
    lsSave({ holdings: h, targets: t, fxRate: fx, accounts: acc, reviews: rev, importedLots: lots })
    if (!supabase) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        const row = { id: 'shared', holdings: h, targets: t, fx_rate: fx, accounts: acc, reviews: rev, imported_lots: lots, updated_at: new Date().toISOString() }
        let { error } = await supabase.from('portfolio_state').upsert(row)
        // Self-heal: a column that hasn't been added to the table yet shouldn't
        // fail the whole write. Drop just the missing ones and save the rest
        // (they stay in localStorage); cloud sync starts once the column exists.
        const missing = error ? OPTIONAL_COLUMNS.filter(c => new RegExp(c, 'i').test(error.message || '')) : []
        if (missing.length) {
          const rest = { ...row }
          missing.forEach(c => delete rest[c])
          ;({ error } = await supabase.from('portfolio_state').upsert(rest))
        }
        setSyncStatus(error ? 'error' : 'synced')
      } catch { setSyncStatus('error') }
    }, 800)
  }, [importedLots])

  // ── Price refresh ──
  const refreshPrices = useCallback(async (currentHoldings) => {
    if (!currentHoldings?.length) return
    setPriceStatus('loading')
    const { prices, errors, requested, missing } = await fetchAllPrices(currentHoldings)
    setPriceErrors(errors)

    // Which tickers actually came back live, and from where. The Holdings LIVE
    // badge reads this instead of assuming "crypto = live", which was wrong for
    // every US stock even when Finnhub was working perfectly.
    const meta = {}
    Object.entries(prices).forEach(([t, p]) => { meta[t] = { source: p.source, at: Date.now() } })
    setPriceMeta(prev => ({ ...prev, ...meta }))

    if (Object.keys(prices).length === 0) { setPriceStatus('error'); return }

    setHoldings(prev => {
      const updated = prev.map(h => {
        const p = prices[h.ticker?.toUpperCase()]
        return p ? { ...h, price: p.price } : h
      })
      persistState(updated, targets, fxRate, accounts, reviews)
      return updated
    })
    // Partial is its own state: crypto needs no key, so a dead Finnhub key used
    // to still report "Prices live" while every stock quietly went stale.
    setPriceStatus(missing?.length ? 'partial' : 'live')
    setLastUpdated(new Date())
    setPriceCoverage({ live: requested.length - (missing?.length || 0), total: requested.length })
  }, [targets, fxRate, accounts, reviews, persistState])

  // Auto refresh every 60s
  useEffect(() => {
    if (!ready) return
    refreshPrices(holdings)
    priceTimer.current = setInterval(() => {
      setHoldings(h => { refreshPrices(h); return h })
    }, 300000)
    return () => clearInterval(priceTimer.current)
  }, [ready])

  // ── Helpers ──
  const toUSD = useCallback((amount, currency) =>
    currency === 'BRL' ? amount / fxRate : amount, [fxRate])

  // Currency follows the country sticker, not the bucket — that's what lets a
  // bucket like Stocks or Energy hold a B3 name and a NYSE name side by side.
  const holdingValue = useCallback(h =>
    toUSD((h.shares || 0) * (h.price || 0), holdingCurrency(h)), [toUSD])

  const holdingCost = useCallback(h =>
    toUSD((h.shares || 0) * (h.cost || 0), holdingCurrency(h)), [toUSD])

  const categoryTotals = useCallback(() => {
    const t = {}
    CATEGORIES.forEach(c => t[c.id] = { value: 0, cost: 0, count: 0, owned: 0 })
    holdings.forEach(h => {
      if (!t[h.category]) return
      t[h.category].value += holdingValue(h)
      t[h.category].cost  += holdingCost(h)
      t[h.category].count++
      if ((h.shares || 0) > 0) t[h.category].owned++
    })
    return t
  }, [holdings, holdingValue, holdingCost])

  // Splitting BR Stocks / US Stocks into thesis buckets would have hidden the
  // geographic mix, so the stickers add it back as its own view.
  const regionTotals = useCallback(() => {
    const t = {}
    REGIONS.forEach(r => t[r.id] = { value: 0, cost: 0, count: 0, owned: 0 })
    holdings.forEach(h => {
      const bucket = t[holdingRegion(h).id]
      if (!bucket) return
      bucket.value += holdingValue(h)
      bucket.cost  += holdingCost(h)
      bucket.count++
      if ((h.shares || 0) > 0) bucket.owned++
    })
    return t
  }, [holdings, holdingValue, holdingCost])

  // ── CRUD ──
  const uid = () => 'h_' + Math.random().toString(36).slice(2, 9)

  const addHolding = useCallback(categoryId => {
    setHoldings(prev => {
      const next = [...prev, { id: uid(), category: categoryId, region: DEFAULT_CATEGORY_REGION[categoryId] || DEFAULT_REGION,
        ticker: '', name: '', shares: 0, cost: 0, price: 0, targetPct: 0, finclass: false }]
      persistState(next, targets, fxRate, accounts, reviews)
      return next
    })
  }, [targets, fxRate, accounts, reviews, persistState])

  const updateHolding = useCallback((id, field, value) => {
    setHoldings(prev => {
      const next = prev.map(h => {
        if (h.id !== id) return h
        const num = ['shares','cost','price','targetPct'].includes(field)
        return { ...h, [field]: num ? (parseFloat(value) || 0) : value }
      })
      persistState(next, targets, fxRate, accounts, reviews)
      return next
    })
  }, [targets, fxRate, accounts, reviews, persistState])

  const removeHolding = useCallback(id => {
    setHoldings(prev => { const next = prev.filter(h => h.id !== id); persistState(next, targets, fxRate, accounts, reviews); return next })
  }, [targets, fxRate, accounts, reviews, persistState])

  const toggleTag = useCallback((id, tag) => {
    setHoldings(prev => { const next = prev.map(h => h.id === id ? { ...h, [tag]: !h[tag] } : h); persistState(next, targets, fxRate, accounts, reviews); return next })
  }, [targets, fxRate, accounts, reviews, persistState])

  // ── Within-group targets (layer 2) ──
  // Each holding carries `targetPct`: its share *of its own group*, so a group
  // at 20% split 60/40 means 12% and 8% of the whole portfolio. Write a whole
  // group at once from a raw weight function, rescaled to exactly 100%.
  const setGroupTargets = useCallback((catId, weightOf) => {
    setHoldings(prev => {
      const members = prev.filter(h => h.category === catId)
      const raw = members.map(h => Math.max(0, weightOf(h)))
      const total = raw.reduce((a, v) => a + v, 0)
      if (!members.length || total <= 0) return prev
      // Largest-remainder apportionment in tenths of a percent: round everyone
      // down, then hand the leftover tenths to whoever was cut hardest. A group
      // then always reads exactly 100.0% — never 99.9% — and an even split
      // stays even (six names → 16.7/16.7/16.7/16.7/16.6/16.6) instead of
      // dumping the whole rounding error on one unlucky row.
      const exact = raw.map(v => (v / total) * 1000)
      const tenths = exact.map(Math.floor)
      let left = 1000 - tenths.reduce((a, v) => a + v, 0)
      exact.map((v, i) => ({ i, rem: v - Math.floor(v) }))
        .sort((a, b) => b.rem - a.rem)
        .forEach(({ i }) => { if (left > 0) { tenths[i]++; left-- } })
      const byId = new Map(members.map((h, i) => [h.id, tenths[i] / 10]))
      const next = prev.map(h => byId.has(h.id) ? { ...h, targetPct: byId.get(h.id) } : h)
      persistState(next, targets, fxRate, accounts, reviews)
      return next
    })
  }, [targets, fxRate, accounts, reviews, persistState])

  // Same weight for every name in the group
  const splitGroupEvenly = useCallback(catId => setGroupTargets(catId, () => 1), [setGroupTargets])
  // Keep the weights that are already typed, just scale them up/down to 100%
  const normalizeGroup = useCallback(catId => setGroupTargets(catId, h => parseFloat(h.targetPct) || 0), [setGroupTargets])

  const updateTarget = useCallback((catId, value) => {
    setTargets(prev => { const next = { ...prev, [catId]: parseFloat(value) || 0 }; persistState(holdings, next, fxRate, accounts, reviews); return next })
  }, [holdings, fxRate, accounts, reviews, persistState])

  const updateFxRate = useCallback(val => {
    const rate = parseFloat(val) || 5.70
    setFxRate(rate)
    persistState(holdings, targets, rate, accounts, reviews)
  }, [holdings, targets, accounts, reviews, persistState])

  const manualRefresh = useCallback(() => refreshPrices(holdings), [holdings, refreshPrices])

  // ── Cash accounts CRUD ──
  const addAccount = useCallback(() => {
    setAccounts(prev => {
      const next = [...prev, { id: uid(), label: '', note: '', value: 0, apy: null }]
      persistState(holdings, targets, fxRate, next, reviews)
      return next
    })
  }, [holdings, targets, fxRate, reviews, persistState])

  const updateAccount = useCallback((id, field, value) => {
    setAccounts(prev => {
      const next = prev.map(a => {
        if (a.id !== id) return a
        const num = ['value', 'apy'].includes(field)
        return { ...a, [field]: num ? (parseFloat(value) || 0) : value }
      })
      persistState(holdings, targets, fxRate, next, reviews)
      return next
    })
  }, [holdings, targets, fxRate, reviews, persistState])

  // Set a cash account's balance from an imported statement, creating the
  // account if it isn't there. Cash sits outside the category allocation, so
  // this never touches the rebalance targets.
  const upsertAccountValue = useCallback(({ id, label, note, apy, value }) => {
    setAccounts(prev => {
      const i = prev.findIndex(a => a.id === id)
      const next = i === -1
        ? [...prev, { id: id || uid(), label: label || 'Imported account', note: note || '', apy: apy ?? null, value }]
        : prev.map((a, j) => j === i ? { ...a, value } : a)
      persistState(holdings, targets, fxRate, next, reviews)
      return next
    })
  }, [holdings, targets, fxRate, reviews, persistState])

  const removeAccount = useCallback(id => {
    setAccounts(prev => { const next = prev.filter(a => a.id !== id); persistState(holdings, targets, fxRate, next, reviews); return next })
  }, [holdings, targets, fxRate, reviews, persistState])

  // ── Investments-for-review CRUD ──
  const addReview = useCallback(() => {
    setReviews(prev => {
      const next = [...prev, { id: 'r_' + Math.random().toString(36).slice(2, 9), ticker: '', name: '', category: 'stocks', region: DEFAULT_REGION, theme: '', groupPct: 0, thesis: '', link: null, source: 'Manual' }]
      persistState(holdings, targets, fxRate, accounts, next)
      return next
    })
  }, [holdings, targets, fxRate, accounts, persistState])

  const updateReview = useCallback((id, field, value) => {
    setReviews(prev => {
      const next = prev.map(r => {
        if (r.id !== id) return r
        return { ...r, [field]: field === 'groupPct' ? (parseFloat(value) || 0) : value }
      })
      persistState(holdings, targets, fxRate, accounts, next)
      return next
    })
  }, [holdings, targets, fxRate, accounts, persistState])

  // Reject: drop a candidate from the review list
  const rejectReview = useCallback(id => {
    setReviews(prev => { const next = prev.filter(r => r.id !== id); persistState(holdings, targets, fxRate, accounts, next); return next })
  }, [holdings, targets, fxRate, accounts, persistState])

  // Approve: move a candidate into Holdings as a 0-share watchlist entry
  // (prices then populate live), carrying its thesis + recommended weight,
  // and remove it from the review list — one atomic save. Computed from
  // closure so both state updates stay pure (no nested setState).
  const approveReview = useCallback(id => {
    const r = reviews.find(x => x.id === id)
    if (!r) return
    const nextReviews = reviews.filter(x => x.id !== id)
    const nextHoldings = [...holdings, {
      id: uid(), category: r.category, region: r.region || DEFAULT_CATEGORY_REGION[r.category] || DEFAULT_REGION,
      ticker: (r.ticker || '').toUpperCase(), name: r.name,
      shares: 0, cost: 0, price: 0, finclass: false,
      targetPct: r.groupPct || 0, thesis: r.thesis || '', link: r.link || null, theme: r.theme || '',
    }]
    setReviews(nextReviews)
    setHoldings(nextHoldings)
    persistState(nextHoldings, targets, fxRate, accounts, nextReviews)
  }, [holdings, reviews, targets, fxRate, accounts, persistState])

  // ── Broker trade import ──
  // Apply a plan from planIbkrImport(). Buys blend into the existing average
  // cost by quantity; a sell reduces the position and leaves average cost alone
  // (the standard treatment — cost basis per share doesn't change when you sell
  // some). Duplicates are dropped, every applied row is recorded in
  // importedLots so the same statement can't land twice, and anything you've
  // actually bought stops being a Review candidate. One atomic save.
  const applyTradeImport = useCallback(plan => {
    const rows = (plan || []).filter(r => r.status !== 'duplicate' && Math.abs(r.netQty) > 1e-8)
    if (!rows.length) return { applied: 0, created: 0, clearedFromReview: 0 }

    const next = [...holdings]
    const lots = []
    const bought = new Set()
    let created = 0

    for (const r of rows) {
      bought.add(r.symbol)
      const i = next.findIndex(h => (h.ticker || '').toUpperCase() === r.symbol)
      if (i === -1) {
        created++
        next.push({
          id: uid(), category: r.category, ticker: r.symbol, name: r.name,
          // The sticker comes from the plan (review candidate, existing
          // holding, or listing exchange); the bucket's default is the
          // fallback. It decides the currency, so it can't be left unset.
          region: r.region || DEFAULT_CATEGORY_REGION[r.category] || DEFAULT_REGION,
          shares: r.netQty, cost: r.unitCost, price: r.price,
          targetPct: r.targetPct ?? 0, finclass: false,
          thesis: r.thesis || '', theme: r.theme || '',
        })
      } else {
        const h = next[i]
        const prevShares = h.shares || 0
        const shares = Math.max(0, prevShares + r.netQty)
        const cost = r.netQty > 0 && shares > 0
          ? ((prevShares * (h.cost || 0)) + (r.netQty * r.unitCost)) / shares
          : (h.cost || 0)
        // A watchlist entry (no shares yet) may be carrying a hand-typed
        // placeholder price from the seed data, which would show an absurd P/L
        // until the next price refresh. The execution price is certainly
        // fresher. Once shares are actually held, leave the live price alone.
        const price = prevShares > 0 ? (h.price || r.price) : r.price
        next[i] = { ...h, shares, cost, price }
      }
      lots.push({
        key: r.key, source: 'ibkr', symbol: r.symbol,
        shares: r.netQty, unitCost: r.unitCost, at: new Date().toISOString(),
      })
    }

    const nextReviews = reviews.filter(r => !bought.has((r.ticker || '').toUpperCase()))
    const nextLots = [...importedLots, ...lots]

    setHoldings(next)
    setReviews(nextReviews)
    setImportedLots(nextLots)
    persistState(next, targets, fxRate, accounts, nextReviews, nextLots)

    return { applied: rows.length, created, clearedFromReview: reviews.length - nextReviews.length }
  }, [holdings, reviews, importedLots, targets, fxRate, accounts, persistState])

  return {
    holdings, targets, fxRate, updateFxRate,
    importedLots, applyTradeImport,
    accounts, addAccount, updateAccount, removeAccount, upsertAccountValue,
    reviews, addReview, updateReview, rejectReview, approveReview,
    priceStatus, priceErrors, priceMeta, priceCoverage, lastUpdated, syncStatus,
    holdingValue, holdingCost, categoryTotals, regionTotals,
    addHolding, updateHolding, removeHolding, toggleTag,
    updateTarget, splitGroupEvenly, normalizeGroup, manualRefresh, ready,
  }
}
