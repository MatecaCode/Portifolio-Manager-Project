// Tax engine — pure calculations for the Schedule E year-end report + depreciation.
//
// ⚠️ NOTHING here is tax advice. Every figure this file produces is an ESTIMATE for
// a licensed CPA to review before filing. The rules encoded below were verified
// against current IRS guidance (see AIRBNB_MODULE_PLAN.md → Phase 3):
//   • Schedule E (Form 1040) lines 5–19 ...... 2025 instructions (i1040se)
//   • Depreciation ........................... Pub 527: straight-line, 27.5-yr GDS,
//                                              mid-month convention; land excluded;
//                                              converted residence → basis is the
//                                              LESSER of adjusted basis or FMV.
//   • Passive activity ($25k allowance) ...... Pub 925 ($100k–$150k MAGI phaseout)
//   • Standard mileage ....................... 2025 = 70¢/mi, 2026 = 72.5¢/mi
//   • NIIT (3.8%) ............................ Topic 559 ($200k single / $250k MFJ)
//
// Keep this file free of tax *decisions* we shouldn't make automatically (material
// participation, SE tax, QBI) — those surface as CPA flags, never as auto-answers.
import { isHouseCategory, scheduleELineFor } from '../data/house'

// ── constants ──────────────────────────────────────────────────────────────
export const RECOVERY_YEARS = 27.5
export const ANNUAL_DEPR_RATE = 1 / RECOVERY_YEARS // 3.636%/yr steady state

// IRS first-year % for 27.5-yr residential rental, mid-month convention, by month
// placed in service (index 0 = Jan … 11 = Dec). Equals (12 − m + 0.5) / 12 ÷ 27.5.
export const MID_MONTH_YEAR1 = [
  0.03485, 0.03182, 0.02879, 0.02576, 0.02273, 0.01970,
  0.01667, 0.01364, 0.01061, 0.00758, 0.00455, 0.00152,
]

// Business standard mileage rate (Schedule E line 6, property trips).
export const MILEAGE_RATE = { 2024: 0.67, 2025: 0.70, 2026: 0.725 }
export const mileageRate = year => MILEAGE_RATE[year] ?? MILEAGE_RATE[2026]

// Passive activity loss — Pub 925 special $25k allowance + MAGI phaseout.
export const SPECIAL_ALLOWANCE = 25000
export const PAL_PHASEOUT_START = 100000
export const PAL_PHASEOUT_END = 150000

// Net investment income tax (3.8%) MAGI thresholds — Topic 559.
export const NIIT_THRESHOLD = { single: 200000, mfj: 250000, mfs: 125000, hoh: 200000 }

// Schedule E (Form 1040) expense lines, in filing order. `mortgage`, `improvements`
// and `unclassified` are intentionally absent: the PITI holding bucket is split into
// its deductible pieces (12/16/9), capital work is depreciated (18), and unclassified
// items are held out of totals until a CPA rules on them.
export const SCHEDULE_E_LINES = {
  advertising:       { line: 5,  label: 'Advertising' },
  auto_travel:       { line: 6,  label: 'Auto and travel' },
  cleaning:          { line: 7,  label: 'Cleaning and maintenance' },
  commissions:       { line: 8,  label: 'Commissions' },
  insurance:         { line: 9,  label: 'Insurance' },
  legal:             { line: 10, label: 'Legal and other professional fees' },
  management:        { line: 11, label: 'Management fees' },
  mortgage_interest: { line: 12, label: 'Mortgage interest paid to banks' },
  other_interest:    { line: 13, label: 'Other interest' },
  repairs:           { line: 14, label: 'Repairs' },
  supplies:          { line: 15, label: 'Supplies' },
  taxes:             { line: 16, label: 'Taxes' },
  utilities:         { line: 17, label: 'Utilities' },
  depreciation:      { line: 18, label: 'Depreciation expense' },
  other:             { line: 19, label: 'Other' },
}

// ── small helpers ──────────────────────────────────────────────────────────
export function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const monthNum = iso => {
  const m = Number(String(iso || '').slice(5, 7))
  return m >= 1 && m <= 12 ? m : null
}
export const yearOf = iso => {
  const y = Number(String(iso || '').slice(0, 4))
  return y >= 1900 ? y : null
}

// ── depreciation ────────────────────────────────────────────────────────────

// Depreciable BUILDING basis for a residence converted to a rental (Pub 527):
// take the lesser of (adjusted basis, FMV) at conversion, then subtract land
// (land is never depreciable). Returns null when we can't compute it yet — the
// report treats a null as "required input missing", never as $0.
export function buildingBasis(tax = {}, property = {}) {
  const override = num(tax.buildingBasisOverride)
  if (override != null) return Math.max(0, override)

  const adj = num(tax.adjustedBasisAtConversion) ?? num(property.purchasePrice)
  const fmv = num(tax.fmvAtConversion)
  // Lesser-of rule only when both are known; otherwise use whichever we have.
  const total = adj != null && fmv != null ? Math.min(adj, fmv) : (adj ?? fmv)
  if (total == null) return null

  const land = num(tax.landValue) != null
    ? num(tax.landValue)
    : total * ((num(property.landPct) ?? 0) / 100)
  return Math.max(0, total - (land || 0))
}

// Straight-line depreciation for ONE asset in a given tax year. Year 1 uses the
// mid-month factor for the month placed in service; later years use 3.636%, with
// the final fractional year clamped so total depreciation never exceeds basis.
// businessUsePct (<100 only if there's personal use) scales the whole schedule.
export function assetDepreciation(basis, placedInService, year, businessUsePct = 100) {
  const b = num(basis)
  const inYear = yearOf(placedInService)
  const m = monthNum(placedInService)
  if (!b || b <= 0 || inYear == null || m == null || !year || year < inYear) return 0

  const db = b * ((num(businessUsePct) ?? 100) / 100)
  const y1 = db * MID_MONTH_YEAR1[m - 1]
  const per = db * ANNUAL_DEPR_RATE
  const k = year - inYear // 0 = first (partial) year
  const cumBefore = k === 0 ? 0 : y1 + per * (k - 1)
  const thisYear = k === 0 ? y1 : per
  return Math.max(0, Math.min(thisYear, db - cumBefore))
}

// Full depreciation picture for a property in `year`: the building plus each
// capital improvement on its own 27.5-yr clock. `items` drives the report's
// depreciation schedule; `total` feeds Schedule E line 18.
export function depreciationForYear(tax = {}, property = {}, year) {
  const inSvc = tax.placedInService || property.placedInService
  const biz = tax.businessUsePct
  const bBasis = buildingBasis(tax, property)

  const items = []
  const buildingAmt = assetDepreciation(bBasis, inSvc, year, biz)
  items.push({ label: 'Building', basis: bBasis, placedInService: inSvc, amount: buildingAmt })

  for (const ci of tax.capitalImprovements || []) {
    const when = ci.placedInService || inSvc
    const amt = assetDepreciation(ci.amount, when, year, biz)
    items.push({ label: ci.desc || 'Capital improvement', basis: num(ci.amount), placedInService: when, amount: amt })
  }
  const total = items.reduce((a, it) => a + it.amount, 0)
  return { total, items, buildingBasis: bBasis, placedInService: inSvc }
}

// ── mortgage split ──────────────────────────────────────────────────────────
// The one PITI bank line is four things; only three are deductible and they land
// on different Schedule E lines. Sourced from Form 1098 + the year-end escrow
// analysis, never guessed from the bank feed. Principal is not deductible.
export function mortgageSplit(tax = {}) {
  const interest = num(tax.form1098?.mortgageInterest) || 0
  const points = num(tax.form1098?.points) || 0
  const propertyTax = num(tax.escrow?.propertyTax) || 0
  const insurance = num(tax.escrow?.insurance) || 0
  return {
    interest, points, propertyTax, insurance,
    toLine12: interest + points, // mortgage interest paid to banks
    toLine16: propertyTax,        // taxes
    toLine9: insurance,           // insurance
    deductible: interest + points + propertyTax + insurance,
    hasData: interest + points + propertyTax + insurance > 0,
  }
}

// ── Schedule E summary ──────────────────────────────────────────────────────
// Builds the year-end report for one property + tax year. Tagged-transaction
// totals per line, augmented by the mortgage split; depreciation on line 18;
// net income/(loss). PITI, capital, and unclassified are surfaced separately so
// nothing is double-counted or silently swept into a deduction.
export function scheduleESummary({ transactions = [], property, tax = {}, year }) {
  // The category is the classification: filing a transaction into a House
  // bucket on the Rental tab is what puts it on a Schedule E line here.
  // One property today, so a house category implies which one.
  const txs = transactions.filter(t => isHouseCategory(t.category) && yearOf(t.date) === year)

  const income = txs
    .filter(t => t.kind === 'income')
    .reduce((a, t) => a + t.amount, 0)

  const byCat = {}
  let pitiPaid = 0, capitalTagged = 0, unclassified = 0
  for (const t of txs) {
    if (t.kind !== 'expense') continue
    const id = scheduleELineFor(t.category) || 'other'
    if (id === 'mortgage') { pitiPaid += t.amount; continue }         // split via 1098/escrow
    if (id === 'improvements') { capitalTagged += t.amount; continue } // depreciated, not expensed
    if (id === 'unclassified') { unclassified += t.amount; continue }  // held for CPA
    byCat[id] = (byCat[id] || 0) + t.amount
  }

  // Augment the deductible lines from the mortgage statement inputs.
  const ms = mortgageSplit(tax)
  byCat.mortgage_interest = (byCat.mortgage_interest || 0) + ms.toLine12
  byCat.taxes = (byCat.taxes || 0) + ms.toLine16
  byCat.insurance = (byCat.insurance || 0) + ms.toLine9

  const depreciation = depreciationForYear(tax, property, year)

  const lines = Object.entries(SCHEDULE_E_LINES)
    .filter(([id]) => id !== 'depreciation')
    .map(([id, meta]) => ({ id, ...meta, amount: byCat[id] || 0 }))
    .filter(l => l.amount > 0)
  if (depreciation.total > 0) {
    lines.push({ id: 'depreciation', line: 18, label: SCHEDULE_E_LINES.depreciation.label, amount: depreciation.total })
  }
  lines.sort((a, z) => a.line - z.line)

  const totalExpenses = lines.reduce((a, l) => a + l.amount, 0)
  const net = income - totalExpenses

  return {
    year, income, lines, totalExpenses, net, depreciation, mortgage: ms,
    pitiPaid, capitalTagged, unclassified, txCount: txs.length,
  }
}

// ── set-aside helper ────────────────────────────────────────────────────────
// Estimate to reserve = marginal rate × net PROFIT (nothing to set aside on a loss).
export function setAside(netProfit, marginalRatePct) {
  if (!(netProfit > 0)) return 0
  return netProfit * ((num(marginalRatePct) ?? 0) / 100)
}

// ── §280A personal-use test ─────────────────────────────────────────────────
// A dwelling is "used as a home" if personal use exceeds the GREATER of 14 days
// or 10% of the days rented at a fair rental price — which then limits deductions.
// We compute the test and warn; we never silently prorate or decide it.
export function personalUseFlag(tax = {}) {
  const personalUseDays = num(tax.personalUseDays) || 0
  const fairRentalDays = num(tax.fairRentalDays)
  const threshold = Math.max(14, fairRentalDays != null ? fairRentalDays * 0.1 : 0)
  return { personalUseDays, fairRentalDays, threshold, usedAsHome: personalUseDays > threshold }
}

// ── passive activity + NIIT (informational booleans for the flag panel) ──────
export function palAllowance(magi, filingStatus = 'single') {
  const m = num(magi)
  if (m == null) return null
  const capBase = filingStatus === 'mfs' ? SPECIAL_ALLOWANCE / 2 : SPECIAL_ALLOWANCE
  const start = filingStatus === 'mfs' ? PAL_PHASEOUT_START / 2 : PAL_PHASEOUT_START
  if (m <= start) return capBase
  return Math.max(0, capBase - (m - start) * 0.5)
}

export function niitApplies(magi, filingStatus = 'single') {
  const m = num(magi)
  if (m == null) return null
  return m > (NIIT_THRESHOLD[filingStatus] ?? NIIT_THRESHOLD.single)
}

// Average guest stay ≤ 7 days takes an STR out of the §469 "rental activity"
// definition — a gateway (not a conclusion) for the material-participation question.
export function shortTermExceptionPossible(tax = {}) {
  const avg = num(tax.avgStayDays)
  return avg != null && avg <= 7
}

// ── required-input gate ─────────────────────────────────────────────────────
// Which figures are still missing before any depreciation/net number should be
// treated as anything but a rough draft. Drives the "DRAFT" watermark alongside
// the user's explicit `confirmed` tick.
export function missingInputs(tax = {}, property = {}) {
  const miss = []
  if (buildingBasis(tax, property) == null) miss.push('Depreciable basis (purchase price / adjusted basis)')
  if (num(tax.fmvAtConversion) == null) miss.push('FMV at conversion (for the lesser-of-basis rule)')
  if (!(tax.placedInService || property.placedInService)) miss.push('Placed-in-service date')
  if (num(tax.landValue) == null && num(property.landPct) == null) miss.push('Land value or land %')
  if (num(tax.form1098?.mortgageInterest) == null) miss.push('Form 1098 mortgage interest (box 1)')
  return miss
}

export function isReportFinal(tax = {}, property = {}) {
  return !!tax.confirmed && missingInputs(tax, property).length === 0
}
