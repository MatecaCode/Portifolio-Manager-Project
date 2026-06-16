// Chase statement parsing — runs entirely in the browser; the PDF never
// leaves the page. Two formats supported:
//   • Chase credit card statements  (ACCOUNT ACTIVITY: date / description / amount)
//   • Chase checking/savings        (TRANSACTION DETAIL: date / description / amount / balance)
import { categorize } from '../data/budget'

// pdfjs is loaded lazily so the (large) library and worker only download
// when someone actually imports a statement.
let pdfjsPromise = null
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }
  return pdfjsPromise
}

// Extract text as visual lines: group items by y position, sort by x.
export async function extractPdfLines(file) {
  const pdfjs = await loadPdfjs()
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const lines = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const rows = []
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue
      const y = item.transform[5]
      const x = item.transform[4]
      let row = rows.find(r => Math.abs(r.y - y) <= 2.5)
      if (!row) { row = { y, items: [] }; rows.push(row) }
      row.items.push({ x, str: item.str })
    }
    rows.sort((a, b) => b.y - a.y)
    for (const row of rows) {
      lines.push(row.items.sort((a, b) => a.x - b.x).map(i => i.str).join('  ').trim())
    }
  }
  return lines
}

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']

// some PDFs emit the minus sign as its own text item ("- 25.00")
const parseAmount = s => parseFloat(String(s).replace(/[$,\s]/g, ''))

// Resolve MM/DD against the statement period (handles Dec→Jan cycles)
function resolveDate(mmdd, start, end) {
  const [m, d] = mmdd.split('/').map(Number)
  for (const y of [start.getFullYear(), end.getFullYear()]) {
    const dt = new Date(y, m - 1, d)
    if (dt >= new Date(start.getTime() - 6 * 864e5) && dt <= new Date(end.getTime() + 6 * 864e5)) return dt
  }
  return new Date(end.getFullYear(), m - 1, d)
}

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const isTransferDesc = desc =>
  /AUTOMATIC PAYMENT|PAYMENT[\s-]*THANK YOU|ONLINE PAYMENT|MOBILE PAYMENT|PAYMENT TO CHASE CARD|ONLINE TRANSFER|TRANSFER TO\s+SAV|TRANSFER FROM\s+SAV|EPAY|AUTOPAY/i.test(desc)

// PDF extractors don't agree on column spacing — collapse runs of spaces
// so the header/transaction regexes see one canonical layout.
const normalize = lines => lines.map(l => l.replace(/\s+/g, ' ').trim())

// ── Chase credit card ──────────────────────────────────────────────
export function parseCard(rawLines) {
  const lines = normalize(rawLines)
  let last4 = null, start = null, end = null
  const txs = []
  let section = null

  for (const line of lines) {
    let m = line.match(/Account Number[:\s]+[X\s*]*(\d{4})\b/i)
    if (m && !last4) last4 = m[1]
    m = line.match(/Opening\/Closing Date\s+(\d{2}\/\d{2}\/\d{2})\s*-\s*(\d{2}\/\d{2}\/\d{2})/i)
    if (m) {
      const p = s => { const [mo, d, y] = s.split('/').map(Number); return new Date(2000 + y, mo - 1, d) }
      start = p(m[1]); end = p(m[2])
    }
  }
  if (!start || !end) return null

  for (const line of lines) {
    if (/PAYMENTS AND OTHER CREDITS/i.test(line)) { section = 'credits'; continue }
    if (/^PURCHASE\b/i.test(line)) { section = 'purchase'; continue }
    if (/FEES CHARGED/i.test(line) && !/TOTAL FEES/i.test(line)) { section = 'fees'; continue }
    if (/INTEREST CHARGED|INTEREST CHARGES|Totals Year-to-Date/i.test(line)) { section = null; continue }
    if (!section) continue

    const m = line.match(/^(\d{2}\/\d{2})\s+(?:&\s+)?(.+?)\s+(-\s?\$?[\d,]*\.\d{2}|\$?[\d,]*\.\d{2})$/)
    if (!m) continue
    const desc = m[2].replace(/\s{2,}/g, ' ').trim()
    if (/TOTAL FEES|TOTAL INTEREST/i.test(desc)) continue
    const amt = parseAmount(m[3])
    const date = iso(resolveDate(m[1], start, end))

    if (section === 'credits' && isTransferDesc(desc)) {
      txs.push({ date, desc, amount: Math.abs(amt), kind: 'transfer', category: null })
    } else if (section === 'fees') {
      txs.push({ date, desc, amount: amt, kind: 'expense', category: 'fees' })
    } else {
      // purchases are positive spend; credit-section refunds come in negative
      txs.push({ date, desc, amount: amt, kind: 'expense', category: categorize(desc) })
    }
  }
  return { kind: 'card', last4: last4 || '????', periodStart: iso(start), periodEnd: iso(end), transactions: txs }
}

// ── Chase checking / savings ───────────────────────────────────────
export function parseChecking(rawLines) {
  const lines = normalize(rawLines)
  let last4 = null, start = null, end = null
  let beginningBalance = null, endingBalance = null
  const txs = []
  let inDetail = false

  for (const line of lines) {
    let m = line.match(/Account Number[:\s]+(\d{6,})/i)
    if (m && !last4) last4 = m[1].slice(-4)
    m = line.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})\s+through\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})/i)
    if (m && !start) {
      const mi = s => MONTHS.indexOf(s.toLowerCase())
      if (mi(m[1]) >= 0 && mi(m[4]) >= 0) {
        start = new Date(Number(m[3]), mi(m[1]), Number(m[2]))
        end = new Date(Number(m[6]), mi(m[4]), Number(m[5]))
      }
    }
    // CHECKING/SAVINGS SUMMARY: capture the statement's cash position.
    // First match wins so the summary value isn't overwritten by the
    // identical "Ending Balance" marker at the foot of the detail table.
    m = line.match(/Beginning Balance\s+\$?(-?[\d,]+\.\d{2})/i)
    if (m && beginningBalance == null) beginningBalance = parseAmount(m[1])
    m = line.match(/Ending Balance\s+\$?(-?[\d,]+\.\d{2})/i)
    if (m && endingBalance == null) endingBalance = parseAmount(m[1])
  }
  if (!start || !end) return null

  for (const line of lines) {
    if (/TRANSACTION DETAIL/i.test(line)) { inDetail = true; continue }
    if (/\*end\*transaction detail|Ending Balance/i.test(line)) { inDetail = false; continue }
    if (!inDetail) continue

    // date  description  amount  running-balance
    const m = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+(-\s?[\d,]+\.\d{2}|[\d,]+\.\d{2})\s+(-\s?\$?[\d,]+\.\d{2}|\$?[\d,]+\.\d{2})$/)
    if (!m) continue
    const desc = m[2].replace(/\s{2,}/g, ' ').trim()
    const amt = parseAmount(m[3])
    const bal = parseAmount(m[4])
    const date = iso(resolveDate(m[1], start, end))

    if (isTransferDesc(desc)) {
      txs.push({ date, desc, amount: Math.abs(amt), kind: 'transfer', category: null, balance: bal })
    } else if (amt > 0) {
      txs.push({ date, desc, amount: amt, kind: 'income', category: null, balance: bal })
    } else {
      txs.push({ date, desc, amount: Math.abs(amt), kind: 'expense', category: categorize(desc), balance: bal })
    }
  }
  // Fallback: if the summary line wasn't found, the last transaction's
  // running balance is the closing cash position.
  if (endingBalance == null && txs.length) endingBalance = txs[txs.length - 1].balance ?? null
  return {
    kind: 'checking', last4: last4 || '????',
    periodStart: iso(start), periodEnd: iso(end),
    beginningBalance, endingBalance, transactions: txs,
  }
}

// ── Entry point ────────────────────────────────────────────────────
export async function parseStatementPdf(file) {
  const lines = await extractPdfLines(file)
  const text = normalize(lines).join('\n')
  const looksCard = /ACCOUNT ACTIVITY/i.test(text) && /Minimum Payment/i.test(text)
  const looksChecking = /TRANSACTION DETAIL/i.test(text) && /(CHECKING|SAVINGS) SUMMARY/i.test(text)

  let parsed
  if (looksCard) parsed = parseCard(lines)
  else if (looksChecking) parsed = parseChecking(lines)
  else parsed = parseCard(lines) || parseChecking(lines)

  if (!parsed) throw new Error("Couldn't recognize this PDF as a Chase card or account statement.")
  if (!parsed.transactions.length) throw new Error('Recognized the statement but found no transactions in it.')
  parsed.fileName = file.name
  return parsed
}
