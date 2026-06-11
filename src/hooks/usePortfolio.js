import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPrices } from '../lib/prices'
import { SEED_HOLDINGS, DEFAULT_TARGETS, CATEGORIES, CASH_ACCOUNTS } from '../data/portfolio'

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
      setSyncStatus('local')
      setReady(true)
    }
    init()
  }, [])

  // ── Save debounced ──
  const persistState = useCallback((h, t, fx, acc) => {
    lsSave({ holdings: h, targets: t, fxRate: fx, accounts: acc })
    if (!supabase) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        const { error } = await supabase.from('portfolio_state').upsert({
          id: 'shared', holdings: h, targets: t, fx_rate: fx, accounts: acc, updated_at: new Date().toISOString()
        })
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
      persistState(updated, targets, fxRate, accounts)
      return updated
    })
    setPriceStatus('live')
    setLastUpdated(new Date())
  }, [targets, fxRate, accounts, persistState])

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
      const next = [...prev, { id: uid(), category: categoryId, ticker: '', name: '', shares: 0, cost: 0, price: 0, finclass: false, energy: false }]
      persistState(next, targets, fxRate, accounts)
      return next
    })
  }, [targets, fxRate, accounts, persistState])

  const updateHolding = useCallback((id, field, value) => {
    setHoldings(prev => {
      const next = prev.map(h => {
        if (h.id !== id) return h
        const num = ['shares','cost','price'].includes(field)
        return { ...h, [field]: num ? (parseFloat(value) || 0) : value }
      })
      persistState(next, targets, fxRate, accounts)
      return next
    })
  }, [targets, fxRate, accounts, persistState])

  const removeHolding = useCallback(id => {
    setHoldings(prev => { const next = prev.filter(h => h.id !== id); persistState(next, targets, fxRate, accounts); return next })
  }, [targets, fxRate, accounts, persistState])

  const toggleTag = useCallback((id, tag) => {
    setHoldings(prev => { const next = prev.map(h => h.id === id ? { ...h, [tag]: !h[tag] } : h); persistState(next, targets, fxRate, accounts); return next })
  }, [targets, fxRate, accounts, persistState])

  const updateTarget = useCallback((catId, value) => {
    setTargets(prev => { const next = { ...prev, [catId]: parseFloat(value) || 0 }; persistState(holdings, next, fxRate, accounts); return next })
  }, [holdings, fxRate, accounts, persistState])

  const updateFxRate = useCallback(val => {
    const rate = parseFloat(val) || 5.70
    setFxRate(rate)
    persistState(holdings, targets, rate, accounts)
  }, [holdings, targets, accounts, persistState])

  const manualRefresh = useCallback(() => refreshPrices(holdings), [holdings, refreshPrices])

  // ── Cash accounts CRUD ──
  const addAccount = useCallback(() => {
    setAccounts(prev => {
      const next = [...prev, { id: uid(), label: '', note: '', value: 0, apy: null }]
      persistState(holdings, targets, fxRate, next)
      return next
    })
  }, [holdings, targets, fxRate, persistState])

  const updateAccount = useCallback((id, field, value) => {
    setAccounts(prev => {
      const next = prev.map(a => {
        if (a.id !== id) return a
        const num = ['value', 'apy'].includes(field)
        return { ...a, [field]: num ? (parseFloat(value) || 0) : value }
      })
      persistState(holdings, targets, fxRate, next)
      return next
    })
  }, [holdings, targets, fxRate, persistState])

  const removeAccount = useCallback(id => {
    setAccounts(prev => { const next = prev.filter(a => a.id !== id); persistState(holdings, targets, fxRate, next); return next })
  }, [holdings, targets, fxRate, persistState])

  return {
    holdings, targets, fxRate, updateFxRate,
    accounts, addAccount, updateAccount, removeAccount,
    priceStatus, priceErrors, lastUpdated, syncStatus,
    holdingValue, holdingCost, categoryTotals,
    addHolding, updateHolding, removeHolding, toggleTag,
    updateTarget, manualRefresh, ready,
  }
}
