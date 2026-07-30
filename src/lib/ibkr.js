import { extractPdfRows } from './statements'
import { COINGECKO_IDS } from '../data/portfolio'

// ── Interactive Brokers importer ────────────────────────────────────────────
//
// Reads the "Trade Confirmation Report" PDF from IBKR → Performance & Reports.
// Two properties of that file break naive parsing, and both are handled here:
//
//  1. Pages are rendered at rotate=90, so a visual table row shares an x
//     coordinate rather than a y. extractPdfRows() normalises that through the
//     page viewport before grouping.
//
//  2. Every trade is printed three times — once per execution venue (the "-"
//     and "IBKR" rows, which is how IBKR reports the fractional and whole-share
//     halves of a fill) and once more as a "Total <SYM> (Bought)" subtotal.
//     Summing the visible BUY rows would double or triple every position, so we
//     read ONLY the subtotal rows: they are IBKR's own per-symbol aggregate for
//     the statement period, which is exactly the number we want.

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']

const num = s => {
  if (s == null) return null
  const n = parseFloat(String(s).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

// Round to 8 dp so float noise from fractional shares never shows up as a
// phantom 1e-17 difference when comparing against an earlier import.
const r8 = n => Math.round(n * 1e8) / 1e8

// "July 1, 2026 - July 31, 2026"
const PERIOD_RE = new RegExp(
  `(${MONTHS.join('|')})\\s+(\\d{1,2}),\\s*(\\d{4})\\s*[-–]\\s*(${MONTHS.join('|')})\\s+(\\d{1,2}),\\s*(\\d{4})`, 'i')

const pad = n => String(n).padStart(2, '0')
const isoOf = (mon, d, y) => `${y}-${pad(MONTHS.indexOf(mon.toLowerCase()) + 1)}-${pad(d)}`

export class ImportError extends Error {}

export function parseIbkrRows(rows) {
  const flat = rows.map(cells => cells.join(' | '))
  const whole = flat.join('\n')

  if (!/Interactive Brokers/i.test(whole)) {
    throw new ImportError("This doesn't look like an Interactive Brokers report — no IBKR header found.")
  }

  // ── Statement period (used as the de-duplication scope) ──
  const pm = PERIOD_RE.exec(whole)
  const period = pm
    ? { start: isoOf(pm[1], +pm[2], pm[3]), end: isoOf(pm[4], +pm[5], pm[6]),
        label: `${pm[1]} ${pm[2]}, ${pm[3]} – ${pm[4]} ${pm[5]}, ${pm[6]}` }
    : null

  // ── Account number ──
  let account = null
  for (const cells of rows) {
    if (/^Account$/i.test(cells[0] || '') && cells[1]) {
      account = String(cells[1]).split(/\s+/)[0]
      break
    }
  }

  // ── Instrument descriptions (fallback names only) ──
  // Long descriptions wrap onto a second visual row, so a lone trailing cell
  // gets appended to whatever symbol we saw last.
  const names = {}
  let inInstruments = false
  let lastSym = null
  for (const cells of rows) {
    const line = cells.join(' | ')
    if (/Financial Instrument Information/i.test(line)) { inInstruments = true; continue }
    if (!inInstruments) continue
    if (/^Symbol\b/i.test(cells[0] || '') && /Description/i.test(line)) continue
    if (/Order Types|Notes|Legal Notes|Codes/i.test(line)) { inInstruments = false; continue }
    if (cells.length === 1 && lastSym && /^[A-Z][A-Z0-9 .&/-]*$/.test(cells[0])) {
      names[lastSym] = `${names[lastSym]} ${cells[0]}`.trim()
      continue
    }
    if (cells.length >= 3 && /^[A-Z][A-Z0-9.]{0,7}$/.test(cells[0]) && cells[1]) {
      lastSym = cells[0]
      names[lastSym] = cells[1]
    }
  }

  // ── Trades: the per-symbol subtotal rows only (see note 2 above) ──
  const trades = []
  for (const cells of rows) {
    const m = /^Total\s+([A-Za-z0-9.]{1,8})\s+\((Bought|Sold)\)$/.exec(cells[0] || '')
    if (!m) continue
    const symbol = m[1].toUpperCase()
    const side = m[2].toLowerCase() === 'sold' ? 'SELL' : 'BUY'
    const [qtyRaw, price, proceeds, comm] = [cells[1], cells[2], cells[3], cells[4]].map(num)
    if (qtyRaw == null || price == null) continue

    // IBKR prints sells with a negative quantity; derive the sign from the
    // (Bought)/(Sold) label so we don't depend on that formatting.
    const qty = side === 'SELL' ? -Math.abs(qtyRaw) : Math.abs(qtyRaw)
    const gross = proceeds != null ? Math.abs(proceeds) : Math.abs(qty) * price
    const fees = Math.abs(comm ?? 0)

    trades.push({
      symbol, side, qty: r8(qty), price, gross, comm: fees,
      // IBKR's own "Avg Price" column is cost-basis inclusive of commissions,
      // so folding them in here keeps the app reconcilable against the broker.
      unitCost: Math.abs(qty) > 0 ? (gross + fees) / Math.abs(qty) : price,
      description: names[symbol] || null,
    })
  }

  if (!trades.length) {
    throw new ImportError(
      'No trades found in this IBKR report. Make sure it is a Trade Confirmation or Activity report covering a period when you actually traded.')
  }

  return {
    source: 'ibkr',
    account,
    period,
    trades,
    cashOut: r8(trades.reduce((a, t) => a + (t.side === 'BUY' ? t.gross + t.comm : -(t.gross - t.comm)), 0)),
    totalComm: r8(trades.reduce((a, t) => a + t.comm, 0)),
  }
}

export async function parseIbkrFile(file) {
  if (!/\.pdf$/i.test(file.name)) {
    throw new ImportError(
      `Only IBKR PDF reports are supported right now (got "${file.name}"). Download the Trade Confirmation report as PDF from Performance & Reports.`)
  }
  let rows
  try {
    rows = await extractPdfRows(file)
  } catch {
    throw new ImportError("Couldn't read that PDF — it may be password-protected or corrupted.")
  }
  return parseIbkrRows(rows)
}

// ── Planning ────────────────────────────────────────────────────────────────
// Turn a parsed statement into a reviewable list of "what would change",
// without touching any state. Nothing is applied until the user confirms.

const periodKey = period => period ? `${period.start}..${period.end}` : 'unknown-period'

export function planIbkrImport(parsed, { holdings = [], reviews = [], importedLots = [] }) {
  const scope = periodKey(parsed.period)

  return parsed.trades.map(t => {
    // De-duplication is per source+period+symbol and compares quantities, so
    // re-importing the same statement is a no-op, while re-importing a *reissued*
    // statement that now contains an extra fill applies only the difference.
    const key = `ibkr|${scope}|${t.symbol}`
    const already = r8(importedLots.filter(l => l.key === key).reduce((a, l) => a + (l.shares || 0), 0))
    const netQty = r8(t.qty - already)

    const holding = holdings.find(h => (h.ticker || '').toUpperCase() === t.symbol) || null
    const review = reviews.find(r => (r.ticker || '').toUpperCase() === t.symbol) || null
    const category = COINGECKO_IDS[t.symbol] ? 'crypto' : (review?.category || holding?.category || 'us_stocks')

    let status
    if (Math.abs(netQty) < 1e-8) status = 'duplicate'
    else if (netQty < 0) status = 'sell'
    else if (!holding) status = 'new'
    else if ((holding.shares || 0) > 0) status = 'add'
    else status = 'first-buy'

    return {
      ...t, key, netQty, already, status, category,
      holdingId: holding?.id || null,
      existingShares: holding?.shares || 0,
      existingCost: holding?.cost || 0,
      fromReview: !!review,
      reviewId: review?.id || null,
      name: holding?.name || review?.name || t.description || t.symbol,
      targetPct: review?.groupPct ?? null,
      thesis: review?.thesis || '',
      theme: review?.theme || '',
    }
  })
}

export const importSummary = plan => ({
  total: plan.length,
  applying: plan.filter(r => r.status !== 'duplicate').length,
  duplicates: plan.filter(r => r.status === 'duplicate').length,
  newPositions: plan.filter(r => r.status === 'new').length,
  fromReview: plan.filter(r => r.status !== 'duplicate' && r.fromReview).length,
  cash: r8(plan.filter(r => r.status !== 'duplicate')
    .reduce((a, r) => a + (r.netQty > 0 ? Math.abs(r.netQty) * r.unitCost : -Math.abs(r.netQty) * r.unitCost), 0)),
})
