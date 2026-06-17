// Chase statement parsing — runs entirely in the browser; the file never
// leaves the page. Formats supported:
//   • Chase credit card PDF   (ACCOUNT ACTIVITY: date / description / amount)
//   • Chase checking/savings PDF (TRANSACTION DETAIL: date / desc / amount / balance)
//   • Chase activity CSV      (Details, Posting Date, Description, Amount, Type, Balance)
//   • Chase credit card CSV   (Transaction Date, Post Date, Description, Category, Type, Amount)
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

// Money headed to an investment / brokerage account isn't spent — it's still
// yours, just working. We recognize the usual destinations by description so
// the cashflow overview can show it as retained (green) rather than as a spend.
// Heuristic and easily extended; a tagged-account model can supersede it later.
export const isInvestmentTransfer = desc =>
  /WEALTHFRONT|FIDELITY|VANGUARD|SCHWAB|ROBINHOOD|COINBASE|KRAKEN|INTERACTIVE BROKERS|\bIBKR\b|BETTERMENT|ETRADE|E\*TRADE|TD AMERITRADE|ACORNS|MERRILL|SOFI INVEST|WEBULL|BINANCE\.US|BINANCE US|BROKERAGE/i.test(String(desc || ''))

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

// ── CSV ─────────────────────────────────────────────────────────────
// Minimal RFC-4180 parser: handles quoted fields, embedded commas, and
// doubled "" escapes. Chase descriptions can contain commas, so we can't
// just split on ",".
function parseCsvRows(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  const s = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = '' }
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// MM/DD/YYYY (or MM/DD/YY) → ISO yyyy-mm-dd
function isoFromMDY(s) {
  const [mo, d, y] = s.trim().split('/').map(Number)
  const year = y < 100 ? 2000 + y : y
  return iso(new Date(year, mo - 1, d))
}

const last4FromName = name => {
  const m = String(name).match(/(?:chase|acct|account)[ _-]*(\d{4})/i) || String(name).match(/\b(\d{4})\b/)
  return m ? m[1] : '????'
}

// Chase activity CSV is the same shape for checking and savings exports.
// The Type column tells us exactly what each row is — far more reliable
// than guessing from the description.
const CSV_TRANSFER_TYPES = new Set(['ACCT_XFER', 'LOAN_PMT'])

export function parseChaseCheckingCsv(rows, fileName) {
  const header = rows[0].map(h => h.trim().toLowerCase())
  const col = name => header.indexOf(name)
  const iDate = col('posting date'), iDesc = col('description'), iAmt = col('amount'), iType = col('type'), iBal = col('balance')
  if (iDate < 0 || iDesc < 0 || iAmt < 0) return null

  const txs = []
  const dated = [] // { date, balance, signedAmount } for closing/opening balance
  for (const r of rows.slice(1)) {
    if (!r[iDate] || r[iAmt] == null || r[iAmt] === '') continue
    const amt = parseAmount(r[iAmt])
    if (Number.isNaN(amt)) continue
    const date = isoFromMDY(r[iDate])
    const desc = (r[iDesc] || '').replace(/\s+/g, ' ').trim()
    const type = (r[iType] || '').trim().toUpperCase()
    const bal = iBal >= 0 ? parseAmount(r[iBal]) : NaN
    const balance = Number.isNaN(bal) ? null : bal
    dated.push({ date, balance, signedAmount: amt })

    if (CSV_TRANSFER_TYPES.has(type)) {
      txs.push({ date, desc, amount: Math.abs(amt), kind: 'transfer', category: null, balance })
    } else if (amt > 0) {
      txs.push({ date, desc, amount: amt, kind: 'income', category: null, balance })
    } else {
      txs.push({ date, desc, amount: Math.abs(amt), kind: 'expense', category: categorize(desc), balance })
    }
  }
  if (!txs.length) return null

  // Chase exports newest-first, so the running Balance column lets us recover
  // the account's cash position. Rows share a date, so we lean on file order
  // to break ties: the FIRST row of the newest date is the most recent
  // transaction (its balance is the closing balance); the LAST row of the
  // oldest date is the earliest transaction (its balance minus its own amount
  // is the opening balance). Strict > / <= preserve those first/last picks.
  const withBal = dated.filter(d => d.balance != null)
  let beginningBalance = null, endingBalance = null
  if (withBal.length) {
    const newest = withBal.reduce((a, d) => (d.date > a.date ? d : a))
    const oldest = withBal.reduce((a, d) => (d.date <= a.date ? d : a))
    endingBalance = newest.balance
    beginningBalance = Math.round((oldest.balance - oldest.signedAmount) * 100) / 100
  }

  const dates = dated.map(d => d.date).sort()
  return {
    kind: 'checking', last4: last4FromName(fileName),
    periodStart: dates[0], periodEnd: dates[dates.length - 1],
    beginningBalance, endingBalance, transactions: txs,
  }
}

// Chase credit-card CSV: Transaction Date, Post Date, Description, Category, Type, Amount, Memo
// Purchases come through as negative Amount; "Payment"/"Return" rows are credits.
export function parseChaseCardCsv(rows, fileName) {
  const header = rows[0].map(h => h.trim().toLowerCase())
  const col = name => header.indexOf(name)
  const iDate = col('transaction date'), iDesc = col('description'), iAmt = col('amount'), iType = col('type')
  if (iDate < 0 || iDesc < 0 || iAmt < 0) return null

  const txs = []
  const dates = []
  for (const r of rows.slice(1)) {
    if (!r[iDate] || r[iAmt] == null || r[iAmt] === '') continue
    const amt = parseAmount(r[iAmt])
    if (Number.isNaN(amt)) continue
    const date = isoFromMDY(r[iDate])
    const desc = (r[iDesc] || '').replace(/\s+/g, ' ').trim()
    const type = (r[iType] || '').trim().toLowerCase()
    dates.push(date)

    if (type === 'payment') {
      txs.push({ date, desc, amount: Math.abs(amt), kind: 'transfer', category: null })
    } else if (type === 'fee') {
      txs.push({ date, desc, amount: Math.abs(amt), kind: 'expense', category: 'fees' })
    } else {
      // purchases: positive spend; returns/refunds keep their negative sign
      txs.push({ date, desc, amount: -amt, kind: 'expense', category: categorize(desc) })
    }
  }
  if (!txs.length) return null
  dates.sort()
  return { kind: 'card', last4: last4FromName(fileName), periodStart: dates[0], periodEnd: dates[dates.length - 1], transactions: txs }
}

export function parseStatementCsvText(text, fileName) {
  const rows = parseCsvRows(text)
  if (!rows.length) throw new Error('That CSV looks empty.')
  const header = rows[0].map(h => h.trim().toLowerCase())
  let parsed = null
  if (header.includes('posting date')) parsed = parseChaseCheckingCsv(rows, fileName)
  else if (header.includes('transaction date')) parsed = parseChaseCardCsv(rows, fileName)
  if (!parsed) throw new Error("Couldn't recognize this CSV as a Chase activity export. Expected a header row with Posting Date or Transaction Date.")
  return parsed
}

// ── Entry points ────────────────────────────────────────────────────
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

// Unified entry point — dispatches on file type.
export async function parseStatement(file) {
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv'
  let parsed
  if (isCsv) {
    parsed = parseStatementCsvText(await file.text(), file.name)
  } else {
    return parseStatementPdf(file)
  }
  if (!parsed.transactions.length) throw new Error('Recognized the file but found no transactions in it.')
  parsed.fileName = file.name
  return parsed
}
