import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { merchantKey, isAirbnbIncome, PROPERTY_DEFAULTS, TAX_DEFAULTS } from '../data/property'
import { smartRuleMatches, isHouseCategory, HOUSE_EXPENSE_CATEGORIES, PERSONAL } from '../data/house'

const LS_KEY = 'budget_v1'

// Bumped whenever the category list changes in a way that moves already-imported
// transactions. The stamp rides in the `budgets` column — free-form JSON that
// used to hold the spending budgets, so recording it there needs no migration.
const SCHEMA = 4

// Schedule E line -> the house category that now feeds it.
const CATEGORY_FOR_LINE = Object.fromEntries(HOUSE_EXPENSE_CATEGORIES.map(c => [c.scheduleE, c.id]))
const houseCategoryForLine = line => CATEGORY_FOR_LINE[line] || 'house_other'

// Re-file data that predates a category the app has since learned about. The
// stamp stops it re-running once anything has been saved, so a line you
// deliberately moved afterwards is never dragged back.
function migrateState(state) {
  const from = state.meta?.schema || 1
  if (from >= SCHEMA) return state
  let transactions = state.transactions || []
  let merchantRules = state.merchantRules || []
  let smartRules = state.smartRules || []

  if (from < 3) {
    // The rental used to be a second axis: sort a transaction into a budget
    // category, then tag it to the property and pick its Schedule E line
    // separately. That's now one choice, so fold the old tags into it.
    transactions = transactions.map(t => {
      if (!t.propertyId) return t
      return {
        ...t,
        category: t.kind === 'income' ? 'house_income' : houseCategoryForLine(t.scheduleE),
      }
    })
    merchantRules = merchantRules.map(r =>
      r.propertyId ? { id: r.id, key: r.key, category: houseCategoryForLine(r.scheduleE) } : r)
    smartRules = smartRules.map(r =>
      r.propertyId ? { ...r, category: r.category || houseCategoryForLine(r.scheduleE), propertyId: null, scheduleE: null } : r)
  }

  if (from < 4) {
    // Spending tracking is gone (Rocket Money does that now). Every personal
    // budget category collapses into the single "not the rental" bucket; the
    // house categories — the ones the Schedule E report reads — are untouched.
    transactions = transactions.map(t =>
      isHouseCategory(t.category) ? t : { ...t, category: PERSONAL })
    // A learned "always file this merchant in 🛒 Groceries" now points at a
    // category that no longer exists, so it's dropped. Review flags survive:
    // "don't guess this vendor" still means something.
    merchantRules = merchantRules.filter(r => r.action === 'review' || isHouseCategory(r.category))
    smartRules = smartRules
      .map(r => (r.category && !isHouseCategory(r.category)) ? { ...r, category: null } : r)
      .filter(r => r.category || r.review)
  }

  return { ...state, transactions, merchantRules, smartRules, meta: { schema: SCHEMA } }
}

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
// to one transaction. A rule sets the category — which, for a house category,
// is also the tax classification. Used both on import and when a rule is
// applied to existing transactions. Pass a single-rule array to apply just one.
export function applySmartRules(tx, smartRules) {
  if (tx.kind === 'transfer') return tx
  // review wins — never auto-decide a merchant the user marked "it depends"
  if (smartRules.some(r => r.review && smartRuleMatches(r, tx))) {
    return { ...tx, reviewFlag: true }
  }
  const catRule = smartRules.find(r => r.category && smartRuleMatches(r, tx))
  return catRule ? { ...tx, category: catRule.category, reviewFlag: false } : tx
}

// On import, file each transaction using — in order of authority — the user's
// explicit smart rules, then the learned merchant memory, then whatever the
// description-based categorizer already decided in the parser. Anything none of
// them claims stays personal, which is where most lines belong.
//
// Learned merchant rules come in two flavours:
//   • a category rule { key, category }        — always file this vendor here
//   • a review rule   { key, action: 'review' } — the merchant is ambiguous
//        (e.g. a family member's Zelle), so instead of guessing, every matching
//        line is flagged for manual review until the review tag is removed.
function attributeTx(tx, merchantRules, smartRules = []) {
  const next = applySmartRules(tx, smartRules)
  if (next.reviewFlag || next.kind === 'transfer') return next
  const key = merchantKey(next.desc)
  if (merchantRules.some(r => r.key === key && r.action === 'review')) {
    return { ...next, reviewFlag: true }
  }
  // A rental payout carries the platform's name, so it needs no rule.
  if (next.kind === 'income') {
    return isAirbnbIncome(next.desc) ? { ...next, category: 'house_income' } : next
  }
  if (next.kind !== 'expense') return next
  const rule = merchantRules.find(r => r.key === key && r.category)
  return rule ? { ...next, category: rule.category } : next
}

// The rental ledger: imported bank statements, the transactions in them, the
// property and its tax inputs, and the rules that decide which lines are the
// house's. Household spending is deliberately NOT tracked here — every
// transaction is either the rental's or personal, and personal is a dead end.
export function useRental() {
  const [accounts, setAccounts]       = useState([])
  const [statements, setStatements]   = useState([])
  const [transactions, setTransactions] = useState([])
  const [properties, setProperties]   = useState([]) // [{ id, name, emoji, state, ... }]
  // Learned merchant→category memory. Persisted under the old property_rules
  // key: it used to hold merchant→property tags, and migration rewrote those
  // in place rather than asking for a new column.
  const [merchantRules, setMerchantRules] = useState([])
  const [smartRules, setSmartRules]   = useState([]) // user-built "contains → action" rules
  const [syncStatus, setSyncStatus]   = useState('local')
  const [ready, setReady]             = useState(false)
  const saveTimer = useRef(null)
  // Bookkeeping that isn't user data — just the migration stamp. A ref because
  // it never changes after load and shouldn't re-run a single callback.
  const meta = useRef({ schema: SCHEMA })

  // ── Load: Supabase first, fallback localStorage (same pattern as usePortfolio) ──
  useEffect(() => {
    async function init() {
      if (supabase) {
        try {
          setSyncStatus('syncing')
          const { data, error } = await supabase
            .from('budget_state').select('*').eq('id', 'shared').single()
          if (!error && data) {
            const m = migrateState({
              transactions: data.transactions || [], meta: data.budgets || {},
              merchantRules: data.property_rules || [], smartRules: data.smart_rules || [],
            })
            meta.current = m.meta
            setAccounts(data.accounts || [])
            setStatements(data.statements || [])
            setTransactions(m.transactions)
            setProperties(data.properties || [])
            setMerchantRules(m.merchantRules)
            setSmartRules(m.smartRules)
            setSyncStatus('synced')
            setReady(true)
            return
          }
        } catch { /* fall through to localStorage */ }
      }
      const saved = lsLoad()
      if (saved) {
        const m = migrateState({
          transactions: saved.transactions || [],
          // `budgets` is where the stamp has always lived, alongside the
          // spending budgets this app no longer keeps.
          meta: saved.meta || saved.budgets || {},
          // `propertyRules` is the pre-merge name of the same list
          merchantRules: saved.merchantRules || saved.propertyRules || [],
          smartRules: saved.smartRules || [],
        })
        meta.current = m.meta
        setAccounts(saved.accounts || [])
        setStatements(saved.statements || [])
        setTransactions(m.transactions)
        setProperties(saved.properties || [])
        setMerchantRules(m.merchantRules)
        setSmartRules(m.smartRules)
      }
      setSyncStatus('local')
      setReady(true)
    }
    init()
  }, [])

  const persist = useCallback((acc, sts, txs, props = properties, rules = merchantRules, srules = smartRules) => {
    lsSave({ accounts: acc, statements: sts, transactions: txs, meta: meta.current, properties: props, merchantRules: rules, smartRules: srules })
    if (!supabase) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        const { error } = await supabase.from('budget_state').upsert({
          id: 'shared', accounts: acc, statements: sts, transactions: txs, budgets: meta.current,
          properties: props, property_rules: rules, smart_rules: srules,
          updated_at: new Date().toISOString(),
        })
        setSyncStatus(error ? 'error' : 'synced')
      } catch { setSyncStatus('error') }
    }, 800)
  }, [properties, merchantRules, smartRules])

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
    let dupes = 0
    let tagged = 0
    const fresh = []
    for (const t of parsed.transactions) {
      const base = { ...t, id: uid('tx'), accountId: account.id, statementId: statement.id, reviewFlag: false }
      if (existing.has(txKey(base))) { dupes++; continue }
      const tx = attributeTx(base, merchantRules, smartRules)
      if (isHouseCategory(tx.category)) tagged++
      fresh.push(tx)
    }
    statement.txCount = fresh.length

    const nextStatements = [...statements, statement]
    const nextTxs = [...transactions, ...fresh]
    setAccounts(nextAccounts)
    setStatements(nextStatements)
    setTransactions(nextTxs)
    persist(nextAccounts, nextStatements, nextTxs)
    return {
      added: fresh.length, dupes, tagged, accountId: account.id, statementId: statement.id,
      kind: parsed.kind, endingBalance: parsed.endingBalance ?? null, periodEnd: parsed.periodEnd,
    }
  }, [accounts, statements, transactions, merchantRules, smartRules, persist])

  // Latest known cash position for an account = ending balance of its most
  // recent statement. Cards never carry a balance (they owe, they don't hold).
  const accountBalance = useCallback(accountId => {
    const sts = statements.filter(s => s.accountId === accountId && s.endingBalance != null)
    if (!sts.length) return null
    return sts.reduce((a, s) => (s.periodEnd > a.periodEnd ? s : a)).endingBalance
  }, [statements])

  // Map a bank account to a portfolio cash account so balances flow over.
  const linkAccount = useCallback((id, portfolioAccountId) => {
    setAccounts(prev => {
      const next = prev.map(a => a.id === id ? { ...a, portfolioAccountId: portfolioAccountId || null } : a)
      persist(next, statements, transactions)
      return next
    })
  }, [statements, transactions, persist])

  const renameAccount = useCallback((id, name) => {
    setAccounts(prev => {
      const next = prev.map(a => a.id === id ? { ...a, name } : a)
      persist(next, statements, transactions)
      return next
    })
  }, [statements, transactions, persist])

  const removeStatement = useCallback(id => {
    const nextStatements = statements.filter(s => s.id !== id)
    const nextTxs = transactions.filter(t => t.statementId !== id)
    // drop accounts that no longer have any statements
    const liveAccountIds = new Set(nextStatements.map(s => s.accountId))
    const nextAccounts = accounts.filter(a => liveAccountIds.has(a.id))
    setStatements(nextStatements)
    setTransactions(nextTxs)
    setAccounts(nextAccounts)
    persist(nextAccounts, nextStatements, nextTxs)
  }, [accounts, statements, transactions, persist])

  const recategorize = useCallback((txId, category) => {
    setTransactions(prev => {
      const next = prev.map(t => t.id === txId ? { ...t, category } : t)
      persist(accounts, statements, next)
      return next
    })
  }, [accounts, statements, persist])

  // ── properties ──
  const addProperty = useCallback((partial = {}) => {
    const prop = { id: uid('prop'), ...PROPERTY_DEFAULTS, ...partial }
    const next = [...properties, prop]
    setProperties(next)
    persist(accounts, statements, transactions, next)
    return prop
  }, [accounts, statements, transactions, properties, persist])

  const updateProperty = useCallback((id, patch) => {
    const next = properties.map(p => p.id === id ? { ...p, ...patch } : p)
    setProperties(next)
    persist(accounts, statements, transactions, next)
  }, [accounts, statements, transactions, properties, persist])

  // Patch a property's tax-engine inputs. Deep-merges the two nested objects
  // (form1098, escrow) so a partial patch never wipes the other fields, and
  // backfills TAX_DEFAULTS for properties created before the tax phase.
  const updatePropertyTax = useCallback((id, patch = {}) => {
    const next = properties.map(p => {
      if (p.id !== id) return p
      const prev = p.tax || {}
      return {
        ...p,
        tax: {
          ...TAX_DEFAULTS, ...prev, ...patch,
          form1098: { ...TAX_DEFAULTS.form1098, ...prev.form1098, ...(patch.form1098 || {}) },
          escrow: { ...TAX_DEFAULTS.escrow, ...prev.escrow, ...(patch.escrow || {}) },
        },
      }
    })
    setProperties(next)
    persist(accounts, statements, transactions, next)
  }, [accounts, statements, transactions, properties, persist])

  const removeProperty = useCallback(id => {
    const nextProps = properties.filter(p => p.id !== id)
    // House categories are no longer wired to a property id, so removing the
    // property leaves its transactions filed exactly where they were — they'd
    // be right again the moment a property comes back.
    setProperties(nextProps)
    persist(accounts, statements, transactions, nextProps)
  }, [accounts, statements, transactions, properties, persist])

  // "Always file this merchant here" — re-files every line from the vendor and
  // teaches the rule so next month's import lands in the same place. The plain
  // recategorize() above stays a one-off, so a single odd charge doesn't rewrite
  // a merchant's history.
  const recategorizeMerchant = useCallback((desc, category) => {
    const key = merchantKey(desc)
    const nextRules = [...merchantRules.filter(r => r.key !== key), { id: uid('rule'), key, category }]
    const nextTxs = transactions.map(t =>
      (t.kind === 'expense' && merchantKey(t.desc) === key) ? { ...t, category, reviewFlag: false } : t)
    setMerchantRules(nextRules)
    setTransactions(nextTxs)
    persist(accounts, statements, nextTxs, properties, nextRules)
  }, [accounts, statements, transactions, properties, merchantRules, persist])

  // Flag (or unflag) a merchant for manual review. While on, nothing is
  // auto-decided for that vendor — every matching line lands in the review box
  // until you remove the tag, at which point normal auto-filing resumes.
  const setMerchantReview = useCallback((desc, on) => {
    const key = merchantKey(desc)
    let nextRules, nextTxs
    if (on) {
      nextRules = [...merchantRules.filter(r => r.key !== key), { id: uid('rule'), key, action: 'review' }]
      // pull every line from the merchant into review — flagging "it depends"
      // means each occurrence should be decided by hand from now on.
      nextTxs = transactions.map(t =>
        (t.kind !== 'transfer' && merchantKey(t.desc) === key) ? { ...t, reviewFlag: true } : t)
    } else {
      nextRules = merchantRules.filter(r => !(r.key === key && r.action === 'review'))
      // clear the flag — these go back to normal unfiled candidates
      nextTxs = transactions.map(t =>
        (t.reviewFlag && merchantKey(t.desc) === key) ? { ...t, reviewFlag: false } : t)
    }
    setMerchantRules(nextRules)
    setTransactions(nextTxs)
    persist(accounts, statements, nextTxs, properties, nextRules)
  }, [accounts, statements, transactions, properties, merchantRules, persist])

  // File a single review line for THIS occurrence only. Unlike
  // recategorizeMerchant it deliberately learns no rule, so the merchant stays
  // in review and the next statement's lines come back for another decision.
  const resolveReview = useCallback((txId, category) => {
    const nextTxs = transactions.map(t => t.id === txId
      ? { ...t, category: category || t.category, reviewFlag: false }
      : t)
    setTransactions(nextTxs)
    persist(accounts, statements, nextTxs)
  }, [accounts, statements, transactions, persist])

  // ── smart rules (user-built "description contains → action") ──
  // Create a rule and, by default, sweep it across existing transactions too so
  // the user sees it take effect immediately (not just on the next import).
  const addSmartRule = useCallback((rule, applyExisting = true) => {
    const r = { id: uid('srule'), enabled: true, contains: '', category: null, review: false, ...rule }
    const nextRules = [...smartRules, r]
    const nextTxs = applyExisting
      ? transactions.map(t => smartRuleMatches(r, t) ? applySmartRules(t, [r]) : t)
      : transactions
    setSmartRules(nextRules)
    setTransactions(nextTxs)
    persist(accounts, statements, nextTxs, properties, merchantRules, nextRules)
    return r
  }, [accounts, statements, transactions, properties, merchantRules, smartRules, persist])

  const updateSmartRule = useCallback((id, patch) => {
    const nextRules = smartRules.map(r => r.id === id ? { ...r, ...patch } : r)
    setSmartRules(nextRules)
    persist(accounts, statements, transactions, properties, merchantRules, nextRules)
  }, [accounts, statements, transactions, properties, merchantRules, smartRules, persist])

  const removeSmartRule = useCallback(id => {
    const nextRules = smartRules.filter(r => r.id !== id)
    setSmartRules(nextRules)
    persist(accounts, statements, transactions, properties, merchantRules, nextRules)
  }, [accounts, statements, transactions, properties, merchantRules, smartRules, persist])

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
    persist(accounts, statements, nextTxs, properties, merchantRules, smartRules)
    return count
  }, [accounts, statements, transactions, properties, merchantRules, smartRules, persist])

  return {
    ready, syncStatus,
    accounts, statements, transactions, properties, merchantRules, smartRules,
    importStatement, renameAccount, removeStatement, recategorize, recategorizeMerchant,
    addProperty, updateProperty, updatePropertyTax, removeProperty,
    setMerchantReview, resolveReview,
    addSmartRule, updateSmartRule, removeSmartRule, applySmartRule,
    accountBalance, linkAccount,
  }
}
