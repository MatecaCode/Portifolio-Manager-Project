// Statement parser tests.
//
// The parsers are the app's only data entry: a row misread here becomes a wrong
// balance in net worth or a deduction that never reaches Schedule E. The PDF
// parsers take already-extracted text lines, so they're tested directly on
// realistic Chase layouts without needing a PDF.
//
// Category assertions are limited to the two rules that auto-file the rental —
// the mortgage servicer and the booking-platform fees. Everything else is a
// judgment call the user makes in the app, not something a parser should decide.
import { describe, it, expect } from 'vitest'
import {
  CASH_ACCOUNT_KINDS,
  isCashAccount,
  parseCard,
  parseChaseCardCsv,
  parseChaseCheckingCsv,
  parseChecking,
  parseCsvRows,
  parseStatementCsvText,
  parseWealthfrontCsv,
} from './statements'

const byDesc = (txs, re) => txs.find(t => re.test(t.desc))

describe('isCashAccount', () => {
  it('counts checking and savings, not a credit card', () => {
    expect(CASH_ACCOUNT_KINDS).toEqual(['checking', 'savings'])
    expect(isCashAccount('checking')).toBe(true)
    expect(isCashAccount('savings')).toBe(true)
    expect(isCashAccount('card')).toBe(false)
    expect(isCashAccount(undefined)).toBe(false)
  })
})

describe('parseCsvRows', () => {
  it('keeps commas and quotes that live inside a quoted field', () => {
    const rows = parseCsvRows('a,"HOME DEPOT #0512, ANNA TX",c\n1,2,3\n')
    expect(rows).toEqual([['a', 'HOME DEPOT #0512, ANNA TX', 'c'], ['1', '2', '3']])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsvRows('x,"say ""hi"" now"')).toEqual([['x', 'say "hi" now']])
  })

  it('strips a BOM and handles CRLF and a missing final newline', () => {
    expect(parseCsvRows('﻿a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('preserves empty trailing fields', () => {
    expect(parseCsvRows('a,b,\n')).toEqual([['a', 'b', '']])
  })

  it('returns nothing for empty input', () => {
    expect(parseCsvRows('')).toEqual([])
  })
})

// ── Chase checking CSV ──────────────────────────────────────────────────────
// Chase exports newest-first, and both ends of this ledger have two rows sharing
// a date — which is what forces the parser to break the tie on file order.
// Chronologically, from an opening balance of 8,000.00:
//   01/05 −142.35 · 01/05 −60.00 · 01/15 −500.00 · 01/28 −1,850.00 · 01/28 +2,400.00
const CHECKING_CSV = [
  'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #',
  'CREDIT,01/28/2025,"AIRBNB PAYOUTS 5551212 PPD ID: 9876543210",2400.00,ACH_CREDIT,7847.65,',
  'DEBIT,01/28/2025,"SERVICEMAC LLC MTG PYMT PPD ID: 1112223334",-1850.00,ACH_DEBIT,5447.65,',
  'DEBIT,01/15/2025,"Online Transfer to SAV ...4321 transaction",-500.00,ACCT_XFER,7297.65,',
  'DEBIT,01/05/2025,"ATM WITHDRAWAL 000123 ANNA TX",-60.00,ATM,7797.65,',
  'DEBIT,01/05/2025,"HOME DEPOT #0512, ANNA TX",-142.35,DEBIT_CARD,7857.65,',
].join('\n')

describe('parseChaseCheckingCsv', () => {
  const parsed = parseChaseCheckingCsv(parseCsvRows(CHECKING_CSV), 'Chase1234_Activity_20250131.csv')

  it('reads the account and period off the file', () => {
    expect(parsed.kind).toBe('checking')
    expect(parsed.last4).toBe('1234')
    expect(parsed.periodStart).toBe('2025-01-05')
    expect(parsed.periodEnd).toBe('2025-01-28')
    expect(parsed.transactions).toHaveLength(5)
  })

  it('classifies by the Type column, not by guessing at the description', () => {
    const { transactions: txs } = parsed
    expect(byDesc(txs, /AIRBNB PAYOUTS/)).toMatchObject({ kind: 'income', amount: 2400, category: null })
    expect(byDesc(txs, /SERVICEMAC/)).toMatchObject({ kind: 'expense', amount: 1850 })
    expect(byDesc(txs, /Online Transfer/)).toMatchObject({ kind: 'transfer', amount: 500, category: null })
  })

  it('auto-files the mortgage servicer as the rental’s mortgage', () => {
    expect(byDesc(parsed.transactions, /SERVICEMAC/).category).toBe('house_mortgage')
  })

  it('stores expenses as positive amounts with the sign carried by kind', () => {
    for (const t of parsed.transactions) expect(t.amount).toBeGreaterThan(0)
  })

  it('recovers the closing balance from the newest row', () => {
    expect(parsed.endingBalance).toBe(7847.65)
  })

  it('recovers the opening balance by backing the oldest row’s own amount out', () => {
    // 7,857.65 (balance after the Home Depot charge) + 142.35 = 8,000.00
    expect(parsed.beginningBalance).toBe(8000)
  })

  it('breaks a same-date tie by file order — first row is the most recent', () => {
    // Both 01/28 rows are dated the same; the payout is listed first, so its
    // balance is the closing one. Taking the other would understate cash by $2,400.
    expect(parsed.endingBalance).not.toBe(5447.65)
    // Same tie at the other end: the LAST 01/05 row is the earliest transaction,
    // so the opening balance is backed out of that one. Taking the ATM row
    // instead would report an opening balance of 7,857.65.
    expect(parsed.beginningBalance).not.toBe(7857.65)
  })

  it('keeps the description intact through the quoted comma', () => {
    expect(byDesc(parsed.transactions, /HOME DEPOT/).desc).toBe('HOME DEPOT #0512, ANNA TX')
  })

  it('rejects a file without the columns it needs', () => {
    expect(parseChaseCheckingCsv(parseCsvRows('Date,Thing\n01/01/2025,x'), 'x.csv')).toBeNull()
    expect(parseChaseCheckingCsv(parseCsvRows(CHECKING_CSV.split('\n')[0]), 'x.csv')).toBeNull()
  })

  it('leaves the balances null when the export has no Balance column', () => {
    const noBal = [
      'Details,Posting Date,Description,Amount,Type',
      'DEBIT,01/05/2025,COFFEE,-4.25,DEBIT_CARD',
    ].join('\n')
    const p = parseChaseCheckingCsv(parseCsvRows(noBal), 'chase_5678.csv')
    expect(p.endingBalance).toBeNull()
    expect(p.beginningBalance).toBeNull()
    expect(p.transactions[0].balance).toBeNull()
  })
})

// ── Chase credit-card CSV ───────────────────────────────────────────────────
const CARD_CSV = [
  'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
  '01/20/2025,01/21/2025,"AIRBNB SERVICE FEE",Travel,Sale,-42.00,',
  '01/18/2025,01/19/2025,"Payment Thank You - Web",,Payment,850.00,',
  '01/15/2025,01/16/2025,"ANNUAL MEMBERSHIP FEE",Fees,Fee,-95.00,',
  '01/10/2025,01/11/2025,"TARGET 00012345 ANNA TX",Shopping,Return,18.75,',
].join('\n')

describe('parseChaseCardCsv', () => {
  const parsed = parseChaseCardCsv(parseCsvRows(CARD_CSV), 'Chase9876_Activity.csv')

  it('flips the card’s negative purchases into positive spend', () => {
    expect(byDesc(parsed.transactions, /AIRBNB/)).toMatchObject({ kind: 'expense', amount: 42 })
  })

  it('keeps a refund negative so it nets against the month’s spend', () => {
    expect(byDesc(parsed.transactions, /TARGET/)).toMatchObject({ kind: 'expense', amount: -18.75 })
  })

  it('treats the card payment as a transfer, not income', () => {
    expect(byDesc(parsed.transactions, /Payment Thank You/)).toMatchObject({ kind: 'transfer', amount: 850 })
  })

  it('auto-files the booking platform’s fee against the rental', () => {
    expect(byDesc(parsed.transactions, /AIRBNB/).category).toBe('house_fees')
  })

  it('files a card fee under the fees category', () => {
    expect(byDesc(parsed.transactions, /MEMBERSHIP FEE/)).toMatchObject({ kind: 'expense', amount: 95, category: 'fees' })
  })

  it('dates the period from the transaction dates, not the post dates', () => {
    expect(parsed.kind).toBe('card')
    expect(parsed.last4).toBe('9876')
    expect(parsed.periodStart).toBe('2025-01-10')
    expect(parsed.periodEnd).toBe('2025-01-20')
  })

  it('returns null when there is nothing to import', () => {
    expect(parseChaseCardCsv(parseCsvRows(CARD_CSV.split('\n')[0]), 'x.csv')).toBeNull()
  })
})

// ── Wealthfront cash CSV ────────────────────────────────────────────────────
const WF_CSV = [
  'Transaction date,Description,Type,Amount',
  '01/31/2025,Interest payment,Interest,12.34',
  '01/15/2025,Deposit from Chase,Deposit,1000.00',
  '01/02/2025,Withdrawal to Chase,Withdrawal,-250.00',
].join('\n')

describe('parseWealthfrontCsv', () => {
  const parsed = parseWealthfrontCsv(parseCsvRows(WF_CSV), 'wealthfront_5150.csv')

  it('counts interest as income and moves between own accounts as transfers', () => {
    expect(byDesc(parsed.transactions, /Interest/)).toMatchObject({ kind: 'income', amount: 12.34 })
    expect(byDesc(parsed.transactions, /Deposit/)).toMatchObject({ kind: 'transfer', amount: 1000 })
    expect(byDesc(parsed.transactions, /Withdrawal/)).toMatchObject({ kind: 'transfer', amount: 250 })
  })

  it('rebuilds the balance by summing signed amounts, since there is no balance column', () => {
    expect(parsed.kind).toBe('savings')
    expect(parsed.beginningBalance).toBe(0)
    expect(parsed.endingBalance).toBe(762.34) // 12.34 + 1000 − 250
  })

  it('rounds the rebuilt balance to cents', () => {
    const p = parseWealthfrontCsv(parseCsvRows([
      'Transaction date,Description,Type,Amount',
      '01/03/2025,Interest payment,Interest,0.07',
      '01/02/2025,Interest payment,Interest,0.01',
      '01/01/2025,Deposit,Deposit,0.02',
    ].join('\n')), 'wealthfront_5150.csv')
    expect(p.endingBalance).toBe(0.1)
  })
})

describe('parseStatementCsvText', () => {
  it('sends a Posting Date export to the checking parser', () => {
    expect(parseStatementCsvText(CHECKING_CSV, 'Chase1234.csv').kind).toBe('checking')
  })

  it('sends a Post Date + Category export to the card parser', () => {
    expect(parseStatementCsvText(CARD_CSV, 'Chase9876.csv').kind).toBe('card')
  })

  it('recognizes a Wealthfront export by what it lacks', () => {
    expect(parseStatementCsvText(WF_CSV, 'wealthfront_5150.csv').kind).toBe('savings')
  })

  it('explains itself rather than importing garbage', () => {
    expect(() => parseStatementCsvText('', 'x.csv')).toThrow(/empty/i)
    expect(() => parseStatementCsvText('Foo,Bar\n1,2', 'x.csv')).toThrow(/Couldn't recognize/i)
  })
})

// ── Chase checking PDF ──────────────────────────────────────────────────────
// A December→January statement, which is where MM/DD dates are ambiguous.
const CHECKING_PDF = [
  'JPMorgan Chase Bank, N.A.',
  'Account Number:  000000123456789',
  'December 20, 2024 through January 19, 2025',
  'CHECKING SUMMARY',
  'Beginning Balance    $3,000.00',
  'Deposits and Additions    2,400.00',
  'Ending Balance    $3,050.00',
  'TRANSACTION DETAIL',
  '12/28   SERVICEMAC LLC MTG PYMT PPD ID 1112223334   -1,850.00   1,150.00',
  '01/05   Airbnb Payouts PPD ID 5551212   2,400.00   3,550.00',
  '01/10   Online Transfer To Sav ...4321   -500.00   3,050.00',
  'Ending Balance   $3,050.00',
  '*end*transaction detail',
  'SAVINGS SUMMARY',
  'Beginning Balance   $12,000.00',
  'Ending Balance   $12,004.11',
  'Page 1 of 2',
]

describe('parseChecking (PDF lines)', () => {
  const parsed = parseChecking(CHECKING_PDF)

  it('reads the account, period and summary balances', () => {
    expect(parsed.kind).toBe('checking')
    expect(parsed.last4).toBe('6789')
    expect(parsed.periodStart).toBe('2024-12-20')
    expect(parsed.periodEnd).toBe('2025-01-19')
    expect(parsed.beginningBalance).toBe(3000)
    expect(parsed.endingBalance).toBe(3050)
  })

  it('resolves MM/DD against the period across a December→January cycle', () => {
    const txs = parsed.transactions
    expect(byDesc(txs, /SERVICEMAC/).date).toBe('2024-12-28')
    expect(byDesc(txs, /Airbnb Payouts/).date).toBe('2025-01-05')
  })

  it('classifies each detail row and keeps its running balance', () => {
    const txs = parsed.transactions
    expect(txs).toHaveLength(3)
    expect(byDesc(txs, /SERVICEMAC/)).toMatchObject({ kind: 'expense', amount: 1850, category: 'house_mortgage', balance: 1150 })
    expect(byDesc(txs, /Airbnb Payouts/)).toMatchObject({ kind: 'income', amount: 2400, category: null, balance: 3550 })
    expect(byDesc(txs, /Online Transfer/)).toMatchObject({ kind: 'transfer', amount: 500, category: null, balance: 3050 })
  })

  it('ignores everything outside the transaction detail table', () => {
    expect(parsed.transactions.map(t => t.desc).join(' ')).not.toMatch(/Deposits and Additions|Page 1/)
  })

  it('keeps the first balance in the file — later sections don’t displace it', () => {
    // This statement repeats "Ending Balance" at the foot of the detail table
    // and again for the savings account below it. The checking summary at the
    // top is the one that belongs to this account.
    expect(parsed.endingBalance).toBe(3050)
    expect(parsed.beginningBalance).toBe(3000)
  })

  it('falls back to the last running balance when the summary is missing', () => {
    const noSummary = CHECKING_PDF.filter(l => !/Balance/.test(l))
    const p = parseChecking(noSummary)
    expect(p.beginningBalance).toBeNull()
    expect(p.endingBalance).toBe(3050)
  })

  it('returns null when it cannot find a statement period', () => {
    expect(parseChecking(CHECKING_PDF.filter(l => !/through/.test(l)))).toBeNull()
  })
})

// ── Chase credit-card PDF ───────────────────────────────────────────────────
const CARD_PDF = [
  'Account Number:  XXXX XXXX XXXX 4321',
  'Opening/Closing Date  01/05/25 - 02/04/25',
  'Minimum Payment: $35.00',
  'ACCOUNT ACTIVITY',
  'PAYMENTS AND OTHER CREDITS',
  '01/12   Payment Thank You - Web   -850.00',
  'PURCHASE',
  '01/15   AIRBNB SERVICE FEE SAN FRANCISCO CA   42.00',
  '01/20   TARGET 00012345 ANNA TX   63.19',
  'FEES CHARGED',
  '01/25   ANNUAL MEMBERSHIP FEE   95.00',
  '02/04   TOTAL FEES CHARGED   95.00',
  'TOTAL FEES CHARGED   95.00',
  'INTEREST CHARGED',
  '01/31   PURCHASE INTEREST CHARGE   0.00',
]

describe('parseCard (PDF lines)', () => {
  const parsed = parseCard(CARD_PDF)

  it('reads the account and the statement cycle', () => {
    expect(parsed.kind).toBe('card')
    expect(parsed.last4).toBe('4321')
    expect(parsed.periodStart).toBe('2025-01-05')
    expect(parsed.periodEnd).toBe('2025-02-04')
  })

  it('reads a payment as a transfer and a purchase as spend', () => {
    const txs = parsed.transactions
    expect(byDesc(txs, /Payment Thank You/)).toMatchObject({ kind: 'transfer', amount: 850, category: null, date: '2025-01-12' })
    expect(byDesc(txs, /TARGET/)).toMatchObject({ kind: 'expense', amount: 63.19 })
  })

  it('auto-files the booking platform’s fee against the rental', () => {
    expect(byDesc(parsed.transactions, /AIRBNB/)).toMatchObject({ kind: 'expense', amount: 42, category: 'house_fees' })
  })

  it('picks up the fees section without double-counting its total row', () => {
    expect(byDesc(parsed.transactions, /^ANNUAL MEMBERSHIP FEE/)).toMatchObject({ amount: 95, category: 'fees' })
    // The section's own total is a summary, not a charge. Importing it would
    // book the annual fee twice.
    expect(byDesc(parsed.transactions, /TOTAL FEES/)).toBeUndefined()
  })

  it('stops at the interest section rather than importing finance charges as spend', () => {
    expect(byDesc(parsed.transactions, /INTEREST CHARGE/)).toBeUndefined()
    expect(parsed.transactions).toHaveLength(4)
  })

  it('returns null when it cannot find the statement cycle', () => {
    expect(parseCard(CARD_PDF.filter(l => !/Opening\/Closing/.test(l)))).toBeNull()
  })
})
