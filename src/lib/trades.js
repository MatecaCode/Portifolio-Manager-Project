// IBKR Trade Confirmation Report parsing — runs entirely in the browser; the
// file never leaves the page.
//
// Two things about this report shape the whole parser:
//
// 1. It's landscape content on a portrait page (page.rotate === 90), so the
//    axis that runs along a visual row is transform[5], not transform[4].
//
// 2. Every fractional-share fill prints TWICE — once with the exchange shown
//    as "-" and once as "IBKR" — with identical quantity, price and
//    commission. They are the same fill, not two fills: the "Total SYM
//    (Bought)" line equals ONE of them, and the grand total equals the sum of
//    one line per symbol. Summing both would silently double every position,
//    so fills are deduped and then reconciled against the report's own totals.
//    A parse that doesn't reconcile is refused rather than applied.
import { loadPdfjs } from './statements'

// Where a listing exchange puts a holding on the map (drives currency + quotes).
const EXCHANGE_REGION = {
  NYSE: 'us', NASDAQ: 'us', ARCA: 'us', AMEX: 'us', BATS: 'us', IEX: 'us', 'NYSENAT': 'us',
  BVMF: 'br', BOVESPA: 'br', B3: 'br',
  SEHK: 'china', SGX: 'global', TSEJ: 'japan', LSE: 'europe', IBIS: 'europe', AEB: 'europe',
}
export const regionForExchange = ex => EXCHANGE_REGION[(ex || '').toUpperCase()] || 'us'

// ── PDF → rows of text ──────────────────────────────────────────────────
function axesFor(rotate) {
  switch (((rotate % 360) + 360) % 360) {
    // rows run down transform[4]; cells run right-to-left along transform[5]
    case 90:  return { row: i => i.transform[4], rowDir: 1,  cell: i => i.transform[5], cellDir: -1 }
    case 180: return { row: i => i.transform[5], rowDir: 1,  cell: i => i.transform[4], cellDir: -1 }
    case 270: return { row: i => i.transform[4], rowDir: -1, cell: i => i.transform[5], cellDir: 1 }
    default:  return { row: i => i.transform[5], rowDir: -1, cell: i => i.transform[4], cellDir: 1 }
  }
}

export async function extractRows(file) {
  const pdfjs = await loadPdfjs()
  const data = file.arrayBuffer ? await file.arrayBuffer() : file
  const doc = await pdfjs.getDocument({ data }).promise
  const out = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const ax = axesFor(page.rotate)
    const rows = []
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue
      const key = ax.row(item)
      let row = rows.find(r => Math.abs(r.key - key) <= 2.5)
      if (!row) { row = { key, items: [] }; rows.push(row) }
      row.items.push({ pos: ax.cell(item), str: item.str })
    }
    rows.sort((a, b) => (a.key - b.key) * ax.rowDir)
    for (const row of rows) {
      out.push(row.items.sort((a, b) => (a.pos - b.pos) * ax.cellDir)
        .map(i => i.str).join(' ').replace(/\s+/g, ' ').trim())
    }
  }
  return out
}

// ── Row patterns ────────────────────────────────────────────────────────
const N = String.raw`-?[\d,]+(?:\.\d+)?`
const num = s => parseFloat(String(s).replace(/,/g, ''))

// One executed fill. Anchored on the BUY/SELL token and the two dates, which
// are the unambiguous landmarks; the numeric columns sit to their left in a
// fixed order: fee, commission, proceeds, price, quantity.
const FILL_RE = new RegExp(
  String.raw`(${N})\s+(${N})\s+(${N})\s+(${N})\s+(${N})\s+` +
  String.raw`(BUY|SELL)\s+(\S+)\s+` +
  String.raw`(\d{4}-\d{2}-\d{2})\s+` +
  String.raw`(\d{4}-\d{2}-\d{2}),\s*(\d{2}:\d{2}:\d{2})\s+` +
  String.raw`([A-Z][A-Z0-9.]{0,7})\b`
)

// "0.00 -0.08 -7.98 280.0100 0.0285 Total ECL (Bought)"
const SUBTOTAL_RE = new RegExp(
  String.raw`(${N})\s+(${N})\s+(${N})\s+(${N})\s+(${N})\s+Total\s+([A-Z][A-Z0-9.]{0,7})\s+\((Bought|Sold)\)`
)

// "0.00 -0.36 -35.97 Total"
const GRAND_TOTAL_RE = new RegExp(String.raw`^(${N})\s+(${N})\s+(${N})\s+Total$`)

// "COMMON 1 NYSE ECL US2788651006 6682 ECOLAB INC ECL" — the long name is
// best-effort; it wraps onto its own row for some instruments.
const INSTRUMENT_RE = /^(COMMON|ETF|PREFERRED|FUND|ADR)\s+\d+\s+([A-Z]+)\s+[A-Z0-9.]+\s+([A-Z]{2}[A-Z0-9]{9}\d)\s+\d+\s*(.*)$/

// A fill is identified by everything except the exchange column — that's the
// one field the duplicated line differs on, and it's also what makes the id
// stable across re-imports of the same (or an overlapping) report.
export const tradeId = t => `${t.ticker}|${t.datetime}|${t.quantity}|${t.price}|${t.proceeds}`

export function parseTradeRows(rows) {
  const fills = []
  const subtotals = []
  const instruments = {}
  let grandTotal = null

  for (const row of rows) {
    const inst = row.match(INSTRUMENT_RE)
    if (inst) {
      const tail = inst[4].trim().split(/\s+/).filter(Boolean)
      const symbol = tail[tail.length - 1]
      if (symbol) {
        instruments[symbol] = {
          exchange: inst[2],
          isin: inst[3],
          name: tail.slice(0, -1).join(' ') || null,
        }
      }
      continue
    }

    const sub = row.match(SUBTOTAL_RE)
    if (sub) {
      subtotals.push({
        ticker: sub[6], side: sub[7] === 'Bought' ? 'BUY' : 'SELL',
        commission: num(sub[2]), proceeds: num(sub[3]), quantity: num(sub[5]),
      })
      continue
    }

    const grand = row.match(GRAND_TOTAL_RE)
    if (grand) { grandTotal = { commission: num(grand[2]), proceeds: num(grand[3]) }; continue }

    const f = row.match(FILL_RE)
    if (f) {
      fills.push({
        ticker: f[11],
        side: f[6],
        exchange: f[7] === '-' ? null : f[7],
        settleDate: f[8],
        datetime: `${f[9]}T${f[10]}`,
        quantity: Math.abs(num(f[5])),
        price: num(f[4]),
        proceeds: num(f[3]),
        commission: num(f[2]),
        fee: num(f[1]),
      })
    }
  }

  // Collapse the duplicated agency/affiliate lines, keeping whichever copy
  // names an exchange so the sticker can be inferred.
  const seen = new Map()
  for (const f of fills) {
    const id = tradeId(f)
    const prev = seen.get(id)
    if (!prev) seen.set(id, f)
    else if (!prev.exchange && f.exchange) seen.set(id, f)
  }
  const trades = [...seen.values()]
    .map(t => ({
      ...t,
      id: tradeId(t),
      name: instruments[t.ticker]?.name || null,
      region: regionForExchange(t.exchange || instruments[t.ticker]?.exchange),
      source: 'ibkr',
    }))
    .sort((a, b) => a.datetime.localeCompare(b.datetime))

  return { trades, subtotals, grandTotal, duplicatesCollapsed: fills.length - trades.length }
}

const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol

// The report carries its own checksums. Use them: a parse that doesn't
// reconcile means a row was missed or double-counted, and applying it would
// corrupt positions silently.
export function reconcile({ trades, subtotals, grandTotal }) {
  const problems = []

  for (const s of subtotals) {
    const mine = trades.filter(t => t.ticker === s.ticker && t.side === s.side)
    const qty = mine.reduce((a, t) => a + t.quantity, 0)
    if (!near(qty, Math.abs(s.quantity), 0.00005)) {
      problems.push(`${s.ticker}: parsed ${qty} shares but the report subtotal says ${Math.abs(s.quantity)}`)
    }
    const proceeds = mine.reduce((a, t) => a + t.proceeds, 0)
    if (!near(proceeds, s.proceeds)) {
      problems.push(`${s.ticker}: parsed ${proceeds.toFixed(2)} but the report subtotal says ${s.proceeds.toFixed(2)}`)
    }
  }

  if (grandTotal) {
    const proceeds = trades.reduce((a, t) => a + t.proceeds, 0)
    const commission = trades.reduce((a, t) => a + t.commission, 0)
    if (!near(proceeds, grandTotal.proceeds)) {
      problems.push(`Total: parsed ${proceeds.toFixed(2)} but the report says ${grandTotal.proceeds.toFixed(2)}`)
    }
    if (!near(commission, grandTotal.commission)) {
      problems.push(`Commission: parsed ${commission.toFixed(2)} but the report says ${grandTotal.commission.toFixed(2)}`)
    }
  }

  return problems
}

export async function parseTradeConfirmation(file) {
  const rows = await extractRows(file)
  const parsed = parseTradeRows(rows)
  if (!parsed.trades.length) {
    throw new Error('No trades found in this file. Trade Confirmation Reports export from IBKR under Performance & Reports → Statements → Trade Confirmations; a page printed to PDF from the browser has no readable text.')
  }
  return { ...parsed, problems: reconcile(parsed) }
}

// ── Trades → positions ──────────────────────────────────────────────────
// Average-cost method, commission folded into the basis: the fee is money
// spent to own the thing, so it belongs in what the position cost. Selling
// removes shares at the running average and leaves the average untouched.
export function positionsFromTrades(trades) {
  const positions = {}
  for (const t of [...trades].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''))) {
    const key = (t.ticker || '').toUpperCase()
    if (!key) continue
    const p = positions[key] || (positions[key] = {
      ticker: key, shares: 0, spent: 0, fills: 0, name: null, region: null, lastTrade: null, lastPrice: 0,
    })
    const qty = Math.abs(t.quantity || 0)
    if (t.side === 'SELL') {
      const avg = p.shares > 0 ? p.spent / p.shares : 0
      p.shares = Math.max(0, p.shares - qty)
      p.spent = Math.max(0, p.spent - avg * qty)
    } else {
      p.shares += qty
      p.spent += Math.abs(t.proceeds || 0) + Math.abs(t.commission || 0)
    }
    p.fills++
    p.name = t.name || p.name
    p.region = t.region || p.region
    p.lastTrade = t.datetime || p.lastTrade
    p.lastPrice = t.price || p.lastPrice
  }
  return Object.values(positions).map(p => ({
    ...p,
    cost: p.shares > 0 ? p.spent / p.shares : 0,
  }))
}

// Merge freshly parsed trades into the stored ledger, skipping any fill that
// is already there — re-importing the same report, or an overlapping date
// range, is a no-op.
export function mergeTrades(ledger, incoming) {
  const known = new Set((ledger || []).map(t => t.id || tradeId(t)))
  const added = (incoming || []).filter(t => !known.has(t.id || tradeId(t)))
  return { trades: [...(ledger || []), ...added], added }
}
