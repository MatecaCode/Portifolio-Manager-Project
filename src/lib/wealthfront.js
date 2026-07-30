import { parseCsvRows } from './statements'

// ── Wealthfront cash / savings importer ─────────────────────────────────────
//
// Export shape:  Transaction date, Description, Type, Amount
//
// There is no balance column, so the balance is the sum of the signed amounts.
// That only holds for the full-history ("All time") export, which is what
// Wealthfront gives you by default — the preview shows the computed balance and
// the date range so a partial export is obvious before anything is saved.
//
// This is emergency savings, not an investment position: it lands on a cash
// account and stays out of the category allocation entirely, so it never
// competes for a slice of the rebalance targets.

export class WealthfrontError extends Error {}

const money = s => {
  const n = parseFloat(String(s ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

const r2 = n => Math.round(n * 100) / 100

// MM/DD/YYYY → ISO, so dates sort lexicographically
function iso(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(String(s || '').trim())
  if (!m) return null
  const y = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

export function parseWealthfrontCash(text) {
  const rows = parseCsvRows(text)
  if (!rows.length) throw new WealthfrontError('That CSV looks empty.')

  const header = rows[0].map(h => h.trim().toLowerCase())
  const at = name => header.indexOf(name)
  const iDate = at('transaction date'), iDesc = at('description'), iType = at('type'), iAmt = at('amount')
  if (iDate < 0 || iAmt < 0) {
    throw new WealthfrontError(
      'This CSV has no "Transaction date" / "Amount" columns. Export from Wealthfront → your Cash Account → Transactions → Download CSV.')
  }

  let balance = 0, deposits = 0, withdrawals = 0, interest = 0
  const dates = []
  const txs = []

  for (const r of rows.slice(1)) {
    if (!r[iDate]) continue
    const amount = money(r[iAmt])
    if (amount == null) continue
    const date = iso(r[iDate])
    const desc = (r[iDesc] || '').replace(/\s+/g, ' ').trim()
    const type = (iType >= 0 ? r[iType] || '' : '').trim()

    balance += amount
    if (/interest/i.test(type)) interest += amount
    else if (amount >= 0) deposits += amount
    else withdrawals += amount

    if (date) dates.push(date)
    txs.push({ date, desc, type, amount })
  }

  if (!txs.length) throw new WealthfrontError('No transactions found in that CSV.')

  dates.sort()
  return {
    kind: 'wealthfront',
    balance: r2(balance),
    deposits: r2(deposits),
    withdrawals: r2(withdrawals),
    interest: r2(interest),
    count: txs.length,
    periodStart: dates[0] || null,
    periodEnd: dates[dates.length - 1] || null,
    transactions: txs,
  }
}

// Which cash account this balance belongs to. Seeded state already carries an
// account with id 'wealthfront'; falling back to a label match keeps working if
// it was renamed, and the caller creates one when there's genuinely none.
export const findWealthfrontAccount = accounts =>
  accounts.find(a => a.id === 'wealthfront') ||
  accounts.find(a => /wealthfront/i.test(a.label || '')) ||
  null
