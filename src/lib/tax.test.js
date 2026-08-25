// Tax engine tests.
//
// These lock down the IRS rules encoded in tax.js — the mid-month depreciation
// table, the lesser-of-basis rule, the PITI split, and what is allowed to reach
// a Schedule E line. A wrong number here is a wrong number on a filed return,
// so the assertions are written against the rule, not against whatever the code
// happens to return today.
import { describe, it, expect } from 'vitest'
import {
  ANNUAL_DEPR_RATE,
  MID_MONTH_YEAR1,
  RECOVERY_YEARS,
  SCHEDULE_E_LINES,
  assetDepreciation,
  buildingBasis,
  depreciationForYear,
  isReportFinal,
  mileageRate,
  missingInputs,
  mortgageSplit,
  niitApplies,
  num,
  palAllowance,
  personalUseFlag,
  scheduleESummary,
  setAside,
  shortTermExceptionPossible,
  yearOf,
} from './tax'

// A converted residence: bought for more than it was worth at conversion, so
// the lesser-of rule bites, 20% of it is land, and it went on the market in June.
const PROPERTY = { landPct: 20 }
const TAX = {
  adjustedBasisAtConversion: 400000,
  fmvAtConversion: 350000,
  placedInService: '2025-06-15',
  form1098: { mortgageInterest: 14200, points: 1800 },
  escrow: { propertyTax: 6400, insurance: 2100 },
}
const BUILDING = 280000 // min(400k, 350k) − 20% land

describe('num / yearOf', () => {
  it('treats blank and unparseable input as unknown, not zero', () => {
    expect(num(null)).toBeNull()
    expect(num(undefined)).toBeNull()
    expect(num('')).toBeNull()
    expect(num('n/a')).toBeNull()
    expect(num('1,200')).toBeNull() // commas must be stripped before it gets here
    expect(num(Infinity)).toBeNull()
  })

  it('keeps a real zero distinct from unknown', () => {
    expect(num(0)).toBe(0)
    expect(num('0')).toBe(0)
    expect(num('1200.55')).toBe(1200.55)
  })

  it('reads the year off an ISO date and rejects anything else', () => {
    expect(yearOf('2025-06-15')).toBe(2025)
    expect(yearOf('')).toBeNull()
    expect(yearOf(undefined)).toBeNull()
    expect(yearOf('0025-01-01')).toBeNull()
  })
})

describe('MID_MONTH_YEAR1', () => {
  // Pub 946 Table A-6: the first-year percentage for 27.5-yr residential rental
  // property is (12 − month + 0.5) / 12 ÷ 27.5 — half a month in the month it
  // was placed in service.
  it('matches the mid-month convention for every month', () => {
    expect(MID_MONTH_YEAR1).toHaveLength(12)
    MID_MONTH_YEAR1.forEach((factor, i) => {
      expect(factor).toBeCloseTo((11.5 - i) / 12 / RECOVERY_YEARS, 5)
    })
  })

  it('gives June 1.970% and December the thinnest slice', () => {
    expect(MID_MONTH_YEAR1[5]).toBe(0.01970)
    expect(MID_MONTH_YEAR1[11]).toBe(0.00152)
    expect(ANNUAL_DEPR_RATE).toBeCloseTo(0.036364, 6)
  })
})

describe('mileageRate', () => {
  it('uses the year’s published rate, and the newest one for unknown years', () => {
    expect(mileageRate(2025)).toBe(0.70)
    expect(mileageRate(2024)).toBe(0.67)
    expect(mileageRate(2031)).toBe(0.725)
  })
})

describe('buildingBasis', () => {
  it('takes the lesser of adjusted basis and FMV, then removes land', () => {
    expect(buildingBasis(TAX, PROPERTY)).toBe(BUILDING)
  })

  it('uses whichever figure it has when only one is known', () => {
    expect(buildingBasis({ adjustedBasisAtConversion: 400000 }, PROPERTY)).toBe(320000)
    expect(buildingBasis({ fmvAtConversion: 350000 }, PROPERTY)).toBe(280000)
  })

  it('falls back to the purchase price when no adjusted basis was entered', () => {
    expect(buildingBasis({ fmvAtConversion: 500000 }, { purchasePrice: 400000, landPct: 20 })).toBe(320000)
  })

  it('prefers an explicit land value over the land percentage', () => {
    expect(buildingBasis({ ...TAX, landValue: 60000 }, PROPERTY)).toBe(290000)
  })

  it('honours a manual override and never returns a negative basis', () => {
    expect(buildingBasis({ ...TAX, buildingBasisOverride: 300000 }, PROPERTY)).toBe(300000)
    expect(buildingBasis({ ...TAX, buildingBasisOverride: -5 }, PROPERTY)).toBe(0)
    expect(buildingBasis({ ...TAX, landValue: 900000 }, PROPERTY)).toBe(0)
  })

  it('returns null — not 0 — when there is nothing to compute from', () => {
    expect(buildingBasis({}, {})).toBeNull()
  })
})

describe('assetDepreciation', () => {
  it('applies the mid-month factor in the first year', () => {
    // 280,000 × 1.970% (June) = 5,516
    expect(assetDepreciation(BUILDING, '2025-06-15', 2025)).toBeCloseTo(5516, 6)
  })

  it('runs at the full straight-line rate from the second year', () => {
    expect(assetDepreciation(BUILDING, '2025-06-15', 2026)).toBeCloseTo(BUILDING / 27.5, 6)
    expect(assetDepreciation(BUILDING, '2025-06-15', 2030)).toBeCloseTo(BUILDING / 27.5, 6)
  })

  it('claims nothing before the asset is in service', () => {
    expect(assetDepreciation(BUILDING, '2025-06-15', 2024)).toBe(0)
  })

  it('scales by business use when there is personal use', () => {
    expect(assetDepreciation(BUILDING, '2025-06-15', 2025, 50)).toBeCloseTo(2758, 6)
  })

  it('never deducts more than the basis over the asset’s life', () => {
    let total = 0
    for (let y = 2025; y <= 2060; y++) total += assetDepreciation(BUILDING, '2025-06-15', y)
    expect(total).toBeCloseTo(BUILDING, 6)
    // and the tail years are exhausted, not still running
    expect(assetDepreciation(BUILDING, '2025-06-15', 2060)).toBe(0)
  })

  it('returns 0 rather than NaN on missing or malformed input', () => {
    expect(assetDepreciation(0, '2025-06-15', 2025)).toBe(0)
    expect(assetDepreciation(null, '2025-06-15', 2025)).toBe(0)
    expect(assetDepreciation(BUILDING, 'sometime in June', 2025)).toBe(0)
    expect(assetDepreciation(BUILDING, '2025-13-01', 2025)).toBe(0)
    expect(assetDepreciation(BUILDING, '2025-06-15', null)).toBe(0)
  })
})

describe('depreciationForYear', () => {
  const withRoof = {
    ...TAX,
    capitalImprovements: [{ desc: 'New roof', amount: 12000, placedInService: '2026-03-10' }],
  }

  it('puts each capital improvement on its own clock', () => {
    const y2026 = depreciationForYear(withRoof, PROPERTY, 2026)
    expect(y2026.items).toHaveLength(2)
    expect(y2026.items[0].amount).toBeCloseTo(BUILDING / 27.5, 6)   // building, full year
    expect(y2026.items[1].amount).toBeCloseTo(12000 * 0.02879, 6)   // roof, first year, March
    expect(y2026.total).toBeCloseTo(BUILDING / 27.5 + 12000 * 0.02879, 6)
  })

  it('claims nothing for an improvement made after the year being filed', () => {
    const y2025 = depreciationForYear(withRoof, PROPERTY, 2025)
    expect(y2025.items[1].amount).toBe(0)
    expect(y2025.total).toBeCloseTo(5516, 6)
  })

  it('dates an improvement from the building when it has no date of its own', () => {
    const t = { ...TAX, capitalImprovements: [{ desc: 'Fence', amount: 6000 }] }
    const y = depreciationForYear(t, PROPERTY, 2025)
    expect(y.items[1].placedInService).toBe('2025-06-15')
    expect(y.items[1].amount).toBeCloseTo(6000 * 0.01970, 6)
  })

  it('reports the basis it used so the view can show its work', () => {
    const y = depreciationForYear(TAX, PROPERTY, 2025)
    expect(y.buildingBasis).toBe(BUILDING)
    expect(y.placedInService).toBe('2025-06-15')
  })
})

describe('mortgageSplit', () => {
  it('routes each piece of the escrowed payment to its own Schedule E line', () => {
    const ms = mortgageSplit(TAX)
    expect(ms.toLine12).toBe(16000) // interest + points
    expect(ms.toLine16).toBe(6400)  // property tax
    expect(ms.toLine9).toBe(2100)   // insurance
    expect(ms.deductible).toBe(24500)
    expect(ms.hasData).toBe(true)
  })

  it('ignores principal — it is not deductible', () => {
    const ms = mortgageSplit({ ...TAX, form1098: { ...TAX.form1098, principal: 9000 } })
    expect(ms.deductible).toBe(24500)
  })

  it('reports no data rather than zeroes when nothing has been entered', () => {
    const ms = mortgageSplit({})
    expect(ms.deductible).toBe(0)
    expect(ms.hasData).toBe(false)
  })
})

describe('scheduleESummary', () => {
  const TXS = [
    { date: '2025-03-01', kind: 'income',   category: 'house_income',   amount: 30000 },
    { date: '2025-04-12', kind: 'expense',  category: 'house_repairs',  amount: 1200 },
    { date: '2025-05-02', kind: 'expense',  category: 'house_cleaning', amount: 800 },
    { date: '2025-06-01', kind: 'expense',  category: 'house_mortgage', amount: 24000 }, // PITI
    { date: '2025-07-01', kind: 'expense',  category: 'house_improve',  amount: 15000 }, // capital
    { date: '2025-08-01', kind: 'expense',  category: 'house_cpa',      amount: 500 },   // unclassified
    { date: '2025-09-01', kind: 'transfer', category: 'house_income',   amount: 999 },
    { date: '2025-10-01', kind: 'expense',  category: 'groceries',      amount: 250 },   // not the rental
    { date: '2024-04-12', kind: 'expense',  category: 'house_repairs',  amount: 4444 },  // prior year
  ]
  const run = (over = {}) =>
    scheduleESummary({ transactions: TXS, property: PROPERTY, tax: TAX, year: 2025, ...over })
  const amountOn = (s, id) => s.lines.find(l => l.id === id)?.amount

  it('counts only the rental’s transactions, only in the year being filed', () => {
    const s = run()
    expect(s.txCount).toBe(7) // the groceries line and the 2024 repair are out
    expect(s.income).toBe(30000) // the transfer is not income
  })

  it('holds PITI, capital work and CPA questions out of the deductions', () => {
    const s = run()
    expect(s.pitiPaid).toBe(24000)
    expect(s.capitalTagged).toBe(15000)
    expect(s.unclassified).toBe(500)
    expect(s.lines.map(l => l.id)).not.toContain('mortgage')
    expect(s.lines.map(l => l.id)).not.toContain('improvements')
    expect(s.lines.map(l => l.id)).not.toContain('unclassified')
    // the whole point: none of that money is inside the expense total
    expect(s.totalExpenses).toBeLessThan(24000 + 15000 + 500)
  })

  it('adds the 1098 and escrow figures to lines 9, 12 and 16', () => {
    const s = run()
    expect(amountOn(s, 'mortgage_interest')).toBe(16000)
    expect(amountOn(s, 'taxes')).toBe(6400)
    expect(amountOn(s, 'insurance')).toBe(2100)
  })

  it('totals the filed lines and depreciation into net income', () => {
    const s = run()
    expect(amountOn(s, 'repairs')).toBe(1200)
    expect(amountOn(s, 'cleaning')).toBe(800)
    expect(amountOn(s, 'depreciation')).toBeCloseTo(5516, 6)
    expect(s.totalExpenses).toBeCloseTo(32016, 6)
    expect(s.net).toBeCloseTo(-2016, 6)
    expect(s.totalExpenses).toBeCloseTo(s.lines.reduce((a, l) => a + l.amount, 0), 6)
  })

  it('lists lines in filing order and leaves empty ones off the form', () => {
    const s = run()
    expect(s.lines.map(l => l.line)).toEqual([7, 9, 12, 14, 16, 18])
    expect(s.lines.every(l => l.amount > 0)).toBe(true)
    expect(s.lines.map(l => l.id)).not.toContain('advertising')
  })

  it('files a house category with no explicit line under Other', () => {
    const s = scheduleESummary({
      transactions: [{ date: '2025-02-01', kind: 'expense', category: 'house_other', amount: 300 }],
      property: {}, tax: {}, year: 2025,
    })
    expect(amountOn(s, 'other')).toBe(300)
    expect(s.totalExpenses).toBe(300)
    expect(s.net).toBe(-300)
  })

  it('produces an empty, non-NaN report with no data at all', () => {
    const s = scheduleESummary({ year: 2025 })
    expect(s.income).toBe(0)
    expect(s.lines).toEqual([])
    expect(s.totalExpenses).toBe(0)
    expect(s.net).toBe(0)
    expect(s.depreciation.total).toBe(0)
  })

  it('keeps every Schedule E line id in the table it reports against', () => {
    for (const l of run().lines) expect(SCHEDULE_E_LINES[l.id]).toBeTruthy()
  })
})

describe('setAside', () => {
  it('reserves the marginal rate on a profit and nothing on a loss', () => {
    expect(setAside(10000, 24)).toBe(2400)
    expect(setAside(-2016, 24)).toBe(0)
    expect(setAside(0, 24)).toBe(0)
    expect(setAside(10000, null)).toBe(0)
  })
})

describe('personalUseFlag (§280A)', () => {
  it('uses the greater of 14 days or 10% of the days rented', () => {
    expect(personalUseFlag({ personalUseDays: 20, fairRentalDays: 100 }).usedAsHome).toBe(true)  // vs 14
    expect(personalUseFlag({ personalUseDays: 20, fairRentalDays: 300 }).usedAsHome).toBe(false) // vs 30
    expect(personalUseFlag({ personalUseDays: 40, fairRentalDays: 300 }).threshold).toBe(30)
  })

  it('does not trip at exactly the threshold — the test is “more than”', () => {
    expect(personalUseFlag({ personalUseDays: 14, fairRentalDays: 100 }).usedAsHome).toBe(false)
  })

  it('defaults to no personal use and the 14-day floor', () => {
    const f = personalUseFlag({})
    expect(f.personalUseDays).toBe(0)
    expect(f.threshold).toBe(14)
    expect(f.usedAsHome).toBe(false)
  })
})

describe('palAllowance (Pub 925)', () => {
  it('gives the full $25k below the phaseout and phases out at 50¢ on the dollar', () => {
    expect(palAllowance(80000)).toBe(25000)
    expect(palAllowance(100000)).toBe(25000)
    expect(palAllowance(120000)).toBe(15000)
    expect(palAllowance(150000)).toBe(0)
    expect(palAllowance(300000)).toBe(0)
  })

  it('halves both the allowance and the phaseout start for married-filing-separately', () => {
    expect(palAllowance(40000, 'mfs')).toBe(12500)
    expect(palAllowance(60000, 'mfs')).toBe(7500)
    expect(palAllowance(75000, 'mfs')).toBe(0)
  })

  it('returns null when MAGI is unknown', () => {
    expect(palAllowance(null)).toBeNull()
    expect(palAllowance('')).toBeNull()
  })
})

describe('niitApplies', () => {
  it('applies above the filing-status threshold, not at it', () => {
    expect(niitApplies(250001, 'mfj')).toBe(true)
    expect(niitApplies(250000, 'mfj')).toBe(false)
    expect(niitApplies(200001)).toBe(true)
    expect(niitApplies(130000, 'mfs')).toBe(true)
  })

  it('returns null when MAGI is unknown', () => {
    expect(niitApplies(null)).toBeNull()
  })
})

describe('shortTermExceptionPossible', () => {
  it('opens the door at an average stay of 7 days or less', () => {
    expect(shortTermExceptionPossible({ avgStayDays: 7 })).toBe(true)
    expect(shortTermExceptionPossible({ avgStayDays: 3.5 })).toBe(true)
    expect(shortTermExceptionPossible({ avgStayDays: 8 })).toBe(false)
    expect(shortTermExceptionPossible({})).toBe(false)
  })
})

describe('missingInputs / isReportFinal', () => {
  const COMPLETE = { ...TAX, landValue: 70000 }

  it('is satisfied once every required figure is present', () => {
    expect(missingInputs(COMPLETE, PROPERTY)).toEqual([])
  })

  it('names what is still missing', () => {
    const miss = missingInputs({}, {})
    expect(miss.some(m => /basis/i.test(m))).toBe(true)
    expect(miss.some(m => /FMV/i.test(m))).toBe(true)
    expect(miss.some(m => /placed-in-service/i.test(m))).toBe(true)
    expect(miss.some(m => /land/i.test(m))).toBe(true)
    expect(miss.some(m => /1098/.test(m))).toBe(true)
  })

  it('accepts a land percentage in place of a land value', () => {
    expect(missingInputs(TAX, PROPERTY)).toEqual([])
    expect(missingInputs(TAX, {}).some(m => /land/i.test(m))).toBe(true)
  })

  it('needs both a complete input set and the user’s explicit tick', () => {
    expect(isReportFinal(COMPLETE, PROPERTY)).toBe(false)                        // not confirmed
    expect(isReportFinal({ ...COMPLETE, confirmed: true }, PROPERTY)).toBe(true)
    expect(isReportFinal({ confirmed: true }, {})).toBe(false)                   // confirmed but incomplete
  })
})
