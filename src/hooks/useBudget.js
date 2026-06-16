import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { merchantKey, suggestScheduleE, isAirbnbIncome, guessScheduleE, PROPERTY_DEFAULTS } from '../data/property'

const LS_KEY = 'budget_v1'

function lsLoad() {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function lsSave(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

const uid = p => p + '_' + Math.random().toString(36).slice(2, 10)
const txKey = t => [t.accountId, t.date, Number(t.amount).toFixed(2), t.kind, t.desc.toUpperCase().replace(/\s+/g, ' ').trim()].join('|')

const ACCOUNT_DEFAULTS = {
  card:     { emoji: '💳', label: 'Chase Card' },
  checking: { emoji: '🏦', label: 'Chase Checking' },
}

// On import, auto-attribute the obvious house items + anything a learned
// merchant rule already covers. Everything else stays personal (propertyId null)
// until the user tags it. Only runs when a property exists to attribute to.
function attributeTx(tx, defaultPropId, rules) {
  if (!defaultPropId) return tx
  if (tx.kind === 'income') {
    return isAirbnbIncome(tx.desc) ? { ...tx, propertyId: defaultPropId, scheduleE: null } : tx
  }
  if (tx.kind !== 'expense') return tx
  const auto = suggestScheduleE(tx.desc)
  if (auto) return { ...tx, propertyId: defaultPropId, scheduleE: auto }
  const rule = rules.find(r => r.key === merchantKey(tx.desc))
  if (rule) return { ...tx, propertyId: rule.propertyId, scheduleE: rule.scheduleE }
  return tx
}

export function useBudget() {
  const [accounts, setAccounts]       = useState([])
  const [statements, setStatements]   = useState([])
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets]         = useState({}) // { total: n, perCat: { catId: n } }
  const [properties, setProperties]   = useState([]) // [{ id, name, emoji, state, ... }]
  const [propertyRules, setPropertyRules] = useState([]) // learned merchant→property memory
  const [syncStatus, setSyncStatus]   = useState('local')
  const [ready, setReady]             = useState(false)
  const saveTimer = useRef(null)

  // ── Load: Supabase first, fallback localStorage (same pattern as usePortfolio) ──
  useEffect(() => {
    async function init() {
      if (supabase) {
        try {
          setSyncStatus('syncing')
          const { data, error } = await supabase
            .from('budget_state').select('*').eq('id', 'shared').single()
          if (!error && data) {
            setAccounts(data.accounts || [])
            setStatements(data.statements || [])
            setTransactions(data.transactions || [])
            setBudgets(data.budgets || {})
            setProperties(data.properties || [])
            setPropertyRules(data.property_rules || [])
            setSyncStatus('synced')
            setReady(true)
            return
          }
        } catch { /* fall through to localStorage */ }
      }
      const saved = lsLoad()
      if (saved) {
        setAccounts(saved.accounts || [])
        setStatements(saved.statements || [])
        setTransactions(saved.transactions || [])
        setBudgets(saved.budgets || {})
        setProperties(saved.properties || [])
        setPropertyRules(saved.propertyRules || [])
      }
      setSyncStatus('local')
      setReady(true)
    }
    init()
  }, [])

  const persist = useCallback((acc, sts, txs, bud, props = properties, rules = propertyRules) => {
    lsSave({ accounts: acc, statements: sts, transactions: txs, budgets: bud, properties: props, propertyRules: rules })
    if (!supabase) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        const { error } = await supabase.from('budget_state').upsert({
          id: 'shared', accounts: acc, statements: sts, transactions: txs, budgets: bud,
          properties: props, property_rules: rules,
          updated_at: new Date().toISOString(),
        })
        setSyncStatus(error ? 'error' : 'synced')
      } catch { setSyncStatus('error') }
    }, 800)
  }, [properties, propertyRules])

  // ── Import a parsed statement. Returns a result summary. ──
  const importStatement = useCallback((parsed, accountName) => {
    // 1. statement-level duplicate: same account + same closing date
    const stKey = `${parsed.kind}:${parsed.last4}:${parsed.periodEnd}`
    if (statements.some(s => s.key === stKey)) {
      return { duplicateStatement: true }
    }

    // 2. find or create the account profile
    let account = accounts.find(a => a.last4 === parsed.last4 && a.kind === parsed.kind)
    let nextAccounts = accounts
    if (!account) {
      const d = ACCOUNT_DEFAULTS[parsed.kind] || { emoji: '🧾', label: 'Account' }
      account = {
        id: uid('acc'),
        kind: parsed.kind,
        last4: parsed.last4,
        emoji: d.emoji,
        name: accountName || `${d.label} ···${parsed.last4}`,
      }
      nextAccounts = [...accounts, account]
    }

    // 3. transaction-level duplicates against everything already stored
    //    (protects against overlapping uploads; identical rows WITHIN this
    //    statement are kept — the statement itself is the source of truth)
    const existing = new Set(transactions.map(txKey))
    const statement = {
      id: uid('st'), key: stKey, accountId: account.id,
      periodStart: parsed.periodStart, periodEnd: parsed.periodEnd,
      beginningBalance: parsed.beginningBalance ?? null,
      endingBalance: parsed.endingBalance ?? null,
      fileName: parsed.fileName || '', importedAt: new Date().toISOString(),
    }
    const defaultPropId = properties[0]?.id || null
    let dupes = 0
    let tagged = 0
    const fresh = []
    for (const t of parsed.transactions) {
      const base = { ...t, id: uid('tx'), accountId: account.id, statementId: statement.id, propertyId: null, scheduleE: null }
      if (existing.has(txKey(base))) { dupes++; continue }
      const tx = attributeTx(base, defaultPropId, propertyRules)
      if (tx.propertyId) tagged++
      fresh.push(tx)
    }
    statement.txCount = fresh.length

    const nextStatements = [...statements, statement]
    const nextTxs = [...transactions, ...fresh]
    setAccounts(nextAccounts)
    setStatements(nextStatements)
    setTransactions(nextTxs)
    persist(nextAccounts, nextStatements, nextTxs, budgets)
    return {
      added: fresh.length, dupes, tagged, accountId: account.id, statementId: statement.id,
      kind: parsed.kind, endingBalance: parsed.endingBalance ?? null, periodEnd: parsed.periodEnd,
    }
  }, [accounts, statements, transactions, budgets, properties, propertyRules, persist])

  // Latest known cash position for an account = ending balance of its most
  // recent statement. Cards never carry a balance (they owe, they don't hold).
  const accountBalance = useCallback(accountId => {
    const sts = statements.filter(s => s.accountId === accountId && s.endingBalance != null)
    if (!sts.length) return null
    return sts.reduce((a, s) => (s.periodEnd > a.periodEnd ? s : a)).endingBalance
  }, [statements])

  // Map a budget account to a portfolio cash account so balances flow over.
  const linkAccount = useCallback((id, portfolioAccountId) => {
    setAccounts(prev => {
      const next = prev.map(a => a.id === id ? { ...a, portfolioAccountId: portfolioAccountId || null } : a)
      persist(next, statements, transactions, budgets)
      return next
    })
  }, [statements, transactions, budgets, persist])

  const renameAccount = useCallback((id, name) => {
    setAccounts(prev => {
      const next = prev.map(a => a.id === id ? { ...a, name } : a)
      persist(next, statements, transactions, budgets)
      return next
    })
  }, [statements, transactions, budgets, persist])

  const removeStatement = useCallback(id => {
    const nextStatements = statements.filter(s => s.id !== id)
    const nextTxs = transactions.filter(t => t.statementId !== id)
    // drop accounts that no longer have any statements
    const liveAccountIds = new Set(nextStatements.map(s => s.accountId))
    const nextAccounts = accounts.filter(a => liveAccountIds.has(a.id))
    setStatements(nextStatements)
    setTransactions(nextTxs)
    setAccounts(nextAccounts)
    persist(nextAccounts, nextStatements, nextTxs, budgets)
  }, [accounts, statements, transactions, budgets, persist])

  const recategorize = useCallback((txId, category) => {
    setTransactions(prev => {
      const next = prev.map(t => t.id === txId ? { ...t, category } : t)
      persist(accounts, statements, next, budgets)
      return next
    })
  }, [accounts, statements, budgets, persist])

  const setTotalBudget = useCallback(value => {
    setBudgets(prev => {
      const next = { ...prev, total: parseFloat(value) || 0 }
      persist(accounts, statements, transactions, next)
      return next
    })
  }, [accounts, statements, transactions, persist])

  const setCategoryBudget = useCallback((catId, value) => {
    setBudgets(prev => {
      const perCat = { ...(prev.perCat || {}) }
      const n = parseFloat(value)
      if (n > 0) perCat[catId] = n; else delete perCat[catId]
      const next = { ...prev, perCat }
      persist(accounts, statements, transactions, next)
      return next
    })
  }, [accounts, statements, transactions, persist])

  // ── properties ──
  const addProperty = useCallback((partial = {}) => {
    const prop = { id: uid('prop'), ...PROPERTY_DEFAULTS, ...partial }
    const next = [...properties, prop]
    setProperties(next)
    persist(accounts, statements, transactions, budgets, next, propertyRules)
    return prop
  }, [accounts, statements, transactions, budgets, properties, propertyRules, persist])

  const updateProperty = useCallback((id, patch) => {
    const next = properties.map(p => p.id === id ? { ...p, ...patch } : p)
    setProperties(next)
    persist(accounts, statements, transactions, budgets, next, propertyRules)
  }, [accounts, statements, transactions, budgets, properties, propertyRules, persist])

  const removeProperty = useCallback(id => {
    const nextProps = properties.filter(p => p.id !== id)
    const nextTxs = transactions.map(t => t.propertyId === id ? { ...t, propertyId: null, scheduleE: null } : t)
    const nextRules = propertyRules.filter(r => r.propertyId !== id)
    setProperties(nextProps); setTransactions(nextTxs); setPropertyRules(nextRules)
    persist(accounts, statements, nextTxs, budgets, nextProps, nextRules)
  }, [accounts, statements, transactions, budgets, properties, propertyRules, persist])

  // Tag (or untag) a transaction to a property. Tagging an expense also teaches
  // the merchant-memory rule so the same vendor auto-files next time.
  const tagTransaction = useCallback((txId, propertyId, scheduleE) => {
    const tx = transactions.find(t => t.id === txId)
    if (!tx) return
    const resolvedSE = !propertyId ? null
      : (scheduleE || tx.scheduleE || (tx.kind === 'expense' ? guessScheduleE(tx.category) : null))
    const nextTxs = transactions.map(t => t.id === txId ? { ...t, propertyId: propertyId || null, scheduleE: resolvedSE } : t)
    let nextRules = propertyRules
    if (propertyId && tx.kind === 'expense') {
      const key = merchantKey(tx.desc)
      nextRules = [...propertyRules.filter(r => r.key !== key), { id: uid('rule'), key, propertyId, scheduleE: resolvedSE }]
    }
    setTransactions(nextTxs)
    setPropertyRules(nextRules)
    persist(accounts, statements, nextTxs, budgets, properties, nextRules)
  }, [accounts, statements, transactions, budgets, properties, propertyRules, persist])

  return {
    ready, syncStatus,
    accounts, statements, transactions, budgets, properties, propertyRules,
    importStatement, renameAccount, removeStatement, recategorize,
    setTotalBudget, setCategoryBudget,
    addProperty, updateProperty, removeProperty, tagTransaction,
    accountBalance, linkAccount,
  }
}
