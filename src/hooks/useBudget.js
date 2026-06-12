import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

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

export function useBudget() {
  const [accounts, setAccounts]       = useState([])
  const [statements, setStatements]   = useState([])
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets]         = useState({}) // { total: n, perCat: { catId: n } }
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
      }
      setSyncStatus('local')
      setReady(true)
    }
    init()
  }, [])

  const persist = useCallback((acc, sts, txs, bud) => {
    lsSave({ accounts: acc, statements: sts, transactions: txs, budgets: bud })
    if (!supabase) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        const { error } = await supabase.from('budget_state').upsert({
          id: 'shared', accounts: acc, statements: sts, transactions: txs, budgets: bud,
          updated_at: new Date().toISOString(),
        })
        setSyncStatus(error ? 'error' : 'synced')
      } catch { setSyncStatus('error') }
    }, 800)
  }, [])

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
      fileName: parsed.fileName || '', importedAt: new Date().toISOString(),
    }
    let dupes = 0
    const fresh = []
    for (const t of parsed.transactions) {
      const tx = { ...t, id: uid('tx'), accountId: account.id, statementId: statement.id }
      if (existing.has(txKey(tx))) { dupes++; continue }
      fresh.push(tx)
    }
    statement.txCount = fresh.length

    const nextStatements = [...statements, statement]
    const nextTxs = [...transactions, ...fresh]
    setAccounts(nextAccounts)
    setStatements(nextStatements)
    setTransactions(nextTxs)
    persist(nextAccounts, nextStatements, nextTxs, budgets)
    return { added: fresh.length, dupes, accountId: account.id, statementId: statement.id }
  }, [accounts, statements, transactions, budgets, persist])

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

  return {
    ready, syncStatus,
    accounts, statements, transactions, budgets,
    importStatement, renameAccount, removeStatement, recategorize,
    setTotalBudget, setCategoryBudget,
  }
}
