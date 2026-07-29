import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPrices } from '../lib/prices'
import { SEED_HOLDINGS, DEFAULT_TARGETS, CATEGORIES, CASH_ACCOUNTS, SEED_REVIEWS } from '../data/portfolio'

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
            setHoldings(data.holdings?.length ? data.holdings : SEED_HOLDINGS)
            setAccounts(data.accounts?.length ? data.accounts : CASH_ACCOUNTS)
            setTargets(data.targets && Object.keys(data.targets).length ? data.targets : DEFAULT_TARGETS)
            setFxRate(data.fx_rate || 5.70)
            // reviews: an empty cloud list is a legit "reviewed everything" state,
            // so respect any array. Only seed when the column is absent (undefined)
            // and there's no local copy either.
            if (Array.isArray(data.reviews)) setReviews(data.reviews)
            else setReviews(lsLoad()?.reviews ?? SEED_REVIEWS)
            setSyncStatus('synced')
            setReady(true)
            return
          }
        } catch {}
      }
      // Fallback to localStorage
      const saved = lsLoad()
      setHoldings(saved?.holdings?.length ? saved.holdings : SEED_HOLDINGS)
      setAccounts(saved?.accounts?.length ? saved.accounts : CASH_ACCOUNTS)
      setTargets(saved?.targets || DEFAULT_TARGETS)
      setFxRate(saved?.fxRate || 5.70)
      setReviews(saved?.reviews ?? SEED_REVIEWS)
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

  const holdingValue = useCallback(h => {
    const cat = CATEGORIES.find(c => c.id === h.category)
    return toUSD((h.shares || 0) * (h.price || 0), cat?.currency || 'USD')
  }, [toUSD])

  const holdingCost = useCallback(h => {
    const cat = CATEGORIES.find(c => c.id === h.category)
    return toUSD((h.shares || 0) * (h.cost || 0), cat?.currency || 'USD')
  }, [toUSD])

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

  // ── CRUD ──
  const uid = () => 'h_' + Math.random().toString(36).slice(2, 9)

  const addHolding = useCallback(categoryId => {
    setHoldings(prev => {
      const next = [...prev, { id: uid(), category: categoryId, ticker: '', name: '', shares: 0, cost: 0, price: 0, targetPct: 0, finclass: false, energy: false }]
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

  const removeAccount = useCallback(id => {
    setAccounts(prev => { const next = prev.filter(a => a.id !== id); persistState(holdings, targets, fxRate, next, reviews); return next })
  }, [holdings, targets, fxRate, reviews, persistState])

  // ── Investments-for-review CRUD ──
  const addReview = useCallback(() => {
    setReviews(prev => {
      const next = [...prev, { id: 'r_' + Math.random().toString(36).slice(2, 9), ticker: '', name: '', category: 'us_stocks', theme: '', groupPct: 0, thesis: '', link: null, source: 'Manual' }]
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
      id: uid(), category: r.category, ticker: (r.ticker || '').toUpperCase(), name: r.name,
      shares: 0, cost: 0, price: 0, finclass: false, energy: false,
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
    holdingValue, holdingCost, categoryTotals,
    addHolding, updateHolding, removeHolding, toggleTag,
    updateTarget, splitGroupEvenly, normalizeGroup, manualRefresh, ready,
  }
}
