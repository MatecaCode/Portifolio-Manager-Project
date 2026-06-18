import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { merchantKey, suggestScheduleE, isAirbnbIncome, guessScheduleE, PROPERTY_DEFAULTS } from '../data/property'
import { smartRuleMatches } from '../data/budget'

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
  savings:  { emoji: '🏛️', label: 'Wealthfront Savings' },
}

// Apply the user's explicit "smart rules" (description contains <phrase> → do X)
// to one transaction. Category applies to any expense; tag/review carry the same
// meaning as the learned memory below. Used both on import and when a rule is
// applied to existing transactions. Pass a single-rule array to apply just one.
export function applySmartRules(tx, smartRules) {
  let next = tx
  if (next.kind === 'expense') {
    const catRule = smartRules.find(r => r.category && smartRuleMatches(r, next))
    if (catRule) next = { ...next, category: catRule.category }
  }
  if (next.kind === 'transfer') return next
  // review wins — never auto-decide a merchant the user marked "it depends"
  if (smartRules.some(r => r.review && smartRuleMatches(r, next))) {
    return { ...next, propertyId: null, scheduleE: null, reviewFlag: true }
  }
  const tagRule = smartRules.find(r => r.propertyId && smartRuleMatches(r, next))
  if (tagRule) {
    return {
      ...next, propertyId: tagRule.propertyId, reviewFlag: false,
      scheduleE: tagRule.scheduleE || (next.kind === 'expense' ? guessScheduleE(next.category) : null),
    }
  }
  return next
}

// On import, auto-attribute the obvious house items + anything a rule covers.
// Order of authority: the user's explicit smart rules first, then the learned
// merchant memory. Everything else stays personal (propertyId null) until tagged.
//
// Learned merchant rules come in two flavours:
//   • a tag rule    { key, propertyId, scheduleE } — auto-files to the property
//   • a review rule { key, action: 'review' }       — the merchant is ambiguous
//        (e.g. a family member's Zelle), so instead of guessing, every matching
//        line is flagged for manual review until the review tag is removed.
function attributeTx(tx, defaultPropId, propertyRules, smartRules = []) {
  // 1) explicit user rules win (category + tag/review)
  const next = applySmartRules(tx, smartRules)
  if (next.reviewFlag || next.propertyId) return next
  if (next.kind === 'transfer') return next
  // 2) learned merchant memory — only when a property exists to attribute to
  if (!defaultPropId) return next
  const key = merchantKey(next.desc)
  if (propertyRules.some(r => r.key === key && r.action === 'review')) {
    return { ...next, propertyId: null, scheduleE: null, reviewFlag: true }
  }
  if (next.kind === 'income') {
    return isAirbnbIncome(next.desc) ? { ...next, propertyId: defaultPropId, scheduleE: null } : next
  }
  if (next.kind !== 'expense') return next
  const auto = suggestScheduleE(next.desc)
  if (auto) return { ...next, propertyId: defaultPropId, scheduleE: auto }
  const rule = propertyRules.find(r => r.key === key && r.action !== 'review')
  if (rule) return { ...next, propertyId: rule.propertyId, scheduleE: rule.scheduleE }
  return next
}

export function useBudget() {
  const [accounts, setAccounts]       = useState([])
  const [statements, setStatements]   = useState([])
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets]         = useState({}) // { total: n, perCat: { catId: n } }
  const [properties, setProperties]   = useState([]) // [{ id, name, emoji, state, ... }]
  const [propertyRules, setPropertyRules] = useState([]) // learned merchant→property memory
  const [smartRules, setSmartRules]   = useState([]) // user-built "contains → action" rules
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
            setSmartRules(data.smart_rules || [])
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
        setSmartRules(saved.smartRules || [])
      }
      setSyncStatus('local')
      setReady(true)
    }
    init()
  }, [])

  const persist = useCallback((acc, sts, txs, bud, props = properties, rules = propertyRules, srules = smartRules) => {
    lsSave({ accounts: acc, statements: sts, transactions: txs, budgets: bud, properties: props, propertyRules: rules, smartRules: srules })
    if (!supabase) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        const { error } = await supabase.from('budget_state').upsert({
          id: 'shared', accounts: acc, statements: sts, transactions: txs, budgets: bud,
          properties: props, property_rules: rules, smart_rules: srules,
          updated_at: new Date().toISOString(),
        })
        setSyncStatus(error ? 'error' : 'synced')
      } catch { setSyncStatus('error') }
    }, 800)
  }, [properties, propertyRules, smartRules])

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
      // Some exports (e.g. Wealthfront) carry no account number — skip the
      // "···????" suffix so the profile reads cleanly as just its label.
      const hasLast4 = parsed.last4 && parsed.last4 !== '????'
      account = {
        id: uid('acc'),
        kind: parsed.kind,
        last4: parsed.last4,
        emoji: d.emoji,
        name: accountName || (hasLast4 ? `${d.label} ···${parsed.last4}` : d.label),
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
      const base = { ...t, id: uid('tx'), accountId: account.id, statementId: statement.id, propertyId: null, scheduleE: null, reviewFlag: false }
      if (existing.has(txKey(base))) { dupes++; continue }
      const tx = attributeTx(base, defaultPropId, propertyRules, smartRules)
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
  }, [accounts, statements, transactions, budgets, properties, propertyRules, smartRules, persist])

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
    // drop the house-tag from any smart rule pointing here; keep the rule only
    // if it still does something (sets a category or sends to review)
    const nextSmart = smartRules
      .map(r => r.propertyId === id ? { ...r, propertyId: null, scheduleE: null } : r)
      .filter(r => r.category || r.review || r.propertyId)
    setProperties(nextProps); setTransactions(nextTxs); setPropertyRules(nextRules); setSmartRules(nextSmart)
    persist(accounts, statements, nextTxs, budgets, nextProps, nextRules, nextSmart)
  }, [accounts, statements, transactions, budgets, properties, propertyRules, smartRules, persist])

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

  // Flag (or unflag) a merchant for manual review. While on, the AI stops
  // auto-deciding that vendor — every matching line lands in the review box
  // until you remove the tag, at which point normal auto-tagging resumes.
  const setMerchantReview = useCallback((desc, on) => {
    const key = merchantKey(desc)
    let nextRules, nextTxs
    if (on) {
      nextRules = [...propertyRules.filter(r => r.key !== key), { id: uid('rule'), key, action: 'review' }]
      // pull the merchant's lines into review — including ones already tagged to
      // the property, since flagging "it depends" means every occurrence should
      // be decided by hand from now on.
      nextTxs = transactions.map(t =>
        (t.kind !== 'transfer' && merchantKey(t.desc) === key)
          ? { ...t, propertyId: null, scheduleE: null, reviewFlag: true } : t)
    } else {
      nextRules = propertyRules.filter(r => !(r.key === key && r.action === 'review'))
      // clear the flag — these go back to normal untagged candidates
      nextTxs = transactions.map(t =>
        (t.reviewFlag && merchantKey(t.desc) === key) ? { ...t, reviewFlag: false } : t)
    }
    setPropertyRules(nextRules)
    setTransactions(nextTxs)
    persist(accounts, statements, nextTxs, budgets, properties, nextRules)
  }, [accounts, statements, transactions, budgets, properties, propertyRules, persist])

  // Resolve a single review line — house or personal — for THIS occurrence only.
  // Unlike tagTransaction it deliberately learns no rule, so the merchant stays
  // in review and the next statement's lines come back for another decision.
  const resolveReview = useCallback((txId, propertyId, scheduleE) => {
    const tx = transactions.find(t => t.id === txId)
    if (!tx) return
    const resolvedSE = !propertyId ? null
      : (scheduleE || (tx.kind === 'expense' ? guessScheduleE(tx.category) : null))
    const nextTxs = transactions.map(t => t.id === txId
      ? { ...t, propertyId: propertyId || null, scheduleE: resolvedSE, reviewFlag: false }
      : t)
    setTransactions(nextTxs)
    persist(accounts, statements, nextTxs, budgets, properties, propertyRules)
  }, [accounts, statements, transactions, budgets, properties, propertyRules, persist])

  // ── smart rules (user-built "description contains → action") ──
  // Create a rule and, by default, sweep it across existing transactions too so
  // the user sees it take effect immediately (not just on the next import).
  const addSmartRule = useCallback((rule, applyExisting = true) => {
    const r = {
      id: uid('srule'), enabled: true, contains: '',
      category: null, propertyId: null, scheduleE: null, review: false,
      ...rule,
    }
    const nextRules = [...smartRules, r]
    const nextTxs = applyExisting
      ? transactions.map(t => smartRuleMatches(r, t) ? applySmartRules(t, [r]) : t)
      : transactions
    setSmartRules(nextRules)
    setTransactions(nextTxs)
    persist(accounts, statements, nextTxs, budgets, properties, propertyRules, nextRules)
    return r
  }, [accounts, statements, transactions, budgets, properties, propertyRules, smartRules, persist])

  const updateSmartRule = useCallback((id, patch) => {
    const nextRules = smartRules.map(r => r.id === id ? { ...r, ...patch } : r)
    setSmartRules(nextRules)
    persist(accounts, statements, transactions, budgets, properties, propertyRules, nextRules)
  }, [accounts, statements, transactions, budgets, properties, propertyRules, smartRules, persist])

  const removeSmartRule = useCallback(id => {
    const nextRules = smartRules.filter(r => r.id !== id)
    setSmartRules(nextRules)
    persist(accounts, statements, transactions, budgets, properties, propertyRules, nextRules)
  }, [accounts, statements, transactions, budgets, properties, propertyRules, smartRules, persist])

  // Re-apply one rule to every existing transaction it matches; returns the count.
  const applySmartRule = useCallback(id => {
    const r = smartRules.find(x => x.id === id)
    if (!r) return 0
    let count = 0
    const nextTxs = transactions.map(t => {
      if (!smartRuleMatches(r, t)) return t
      count++
      return applySmartRules(t, [r])
    })
    setTransactions(nextTxs)
    persist(accounts, statements, nextTxs, budgets, properties, propertyRules, smartRules)
    return count
  }, [accounts, statements, transactions, budgets, properties, propertyRules, smartRules, persist])

  return {
    ready, syncStatus,
    accounts, statements, transactions, budgets, properties, propertyRules, smartRules,
    importStatement, renameAccount, removeStatement, recategorize,
    setTotalBudget, setCategoryBudget,
    addProperty, updateProperty, removeProperty, tagTransaction,
    setMerchantReview, resolveReview,
    addSmartRule, updateSmartRule, removeSmartRule, applySmartRule,
    accountBalance, linkAccount,
  }
}
