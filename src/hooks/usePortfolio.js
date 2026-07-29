import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPrices } from '../lib/prices'
import { SEED_HOLDINGS, DEFAULT_TARGETS, CATEGORIES, CASH_ACCOUNTS, SEED_REVIEWS,
         DEFAULT_CATEGORY_REGION, DEFAULT_REGION, REGIONS, holdingCurrency, holdingRegion } from '../data/portfolio'
import { migrateHoldings, migrateReviews, migrateTargets } from '../lib/migrate'

const LS_KEY = 'portfolio_v4'

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
  const [targets, setTargets]         = useState(DEFAULT_TARGETS)
  const [fxRate, setFxRate]           = useState(5.70)
  const [priceStatus, setPriceStatus] = useState('idle')
  const [priceErrors, setPriceErrors] = useState({})
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
      setSyncStatus('local')
      setReady(true)
    }
    init()
  }, [])

  // ── Save debounced ──
  const persistState = useCallback((h, t, fx, acc, rev) => {
    lsSave({ holdings: h, targets: t, fxRate: fx, accounts: acc, reviews: rev })
    if (!supabase) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        const row = { id: 'shared', holdings: h, targets: t, fx_rate: fx, accounts: acc, reviews: rev, updated_at: new Date().toISOString() }
        let { error } = await supabase.from('portfolio_state').upsert(row)
        // Self-heal: if the `reviews` column hasn't been added yet, save
        // everything else (reviews stay in localStorage) instead of failing
        // the whole write. Cloud sync of reviews begins once the column exists.
        if (error && /review/i.test(error.message || '')) {
          const { reviews, ...rest } = row
          ;({ error } = await supabase.from('portfolio_state').upsert(rest))
        }
        setSyncStatus(error ? 'error' : 'synced')
      } catch { setSyncStatus('error') }
    }, 800)
  }, [])

  // ── Price refresh ──
  const refreshPrices = useCallback(async (currentHoldings) => {
    if (!currentHoldings?.length) return
    setPriceStatus('loading')
    const { prices, errors } = await fetchAllPrices(currentHoldings)
    setPriceErrors(errors)
    if (Object.keys(prices).length === 0) { setPriceStatus('error'); return }

    setHoldings(prev => {
      const updated = prev.map(h => {
        const p = prices[h.ticker?.toUpperCase()]
        return p ? { ...h, price: p.price } : h
      })
      persistState(updated, targets, fxRate, accounts, reviews)
      return updated
    })
    setPriceStatus('live')
    setLastUpdated(new Date())
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
        ticker: '', name: '', shares: 0, cost: 0, price: 0, finclass: false }]
      persistState(next, targets, fxRate, accounts, reviews)
      return next
    })
  }, [targets, fxRate, accounts, reviews, persistState])

  const updateHolding = useCallback((id, field, value) => {
    setHoldings(prev => {
      const next = prev.map(h => {
        if (h.id !== id) return h
        const num = ['shares','cost','price'].includes(field)
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

  return {
    holdings, targets, fxRate, updateFxRate,
    accounts, addAccount, updateAccount, removeAccount,
    reviews, addReview, updateReview, rejectReview, approveReview,
    priceStatus, priceErrors, lastUpdated, syncStatus,
    holdingValue, holdingCost, categoryTotals, regionTotals,
    addHolding, updateHolding, removeHolding, toggleTag,
    updateTarget, manualRefresh, ready,
  }
}
