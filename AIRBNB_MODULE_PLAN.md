# Airbnb & Tax Module — Plan & Vision

> Companion to CONCEPT.md. Captures the plan for a property-focused section inside
> Budget mode: tracking the Airbnb (the Texas house we moved out of and now rent),
> its profit/loss, and a real federal tax estimate.
> Status: **planning / brainstorm** — not yet built. Last updated: June 15, 2026.

---

## The Situation (in plain words)

Matheus & Melanie moved to Florida and now rent out their house in **Texas** on
Airbnb. The same joint Chase accounts carry **everything**:

- The Florida **apartment** they live in (rent + personal utilities) — personal
- The Texas **house** (mortgage, insurance, utilities, repairs, Airbnb host fees) — business
- Airbnb **payouts** landing as deposits in checking — business income
- All their normal personal spending

There is **no dedicated card** for the property — they use joint cards (one card
each). So the money is fully commingled. The job of this module is to **carve the
property's economics out of the commingled stream**, show how the Airbnb is doing,
and tell them what to set aside for taxes.

> Goal in Matheus's words: *"a one-stop shop with tabs — overview, revenue,
> expenses, projections, taxes — that takes the info we already upload via the
> account and applies all these calculations."*

---

## Decisions locked in (from brainstorm, June 15)

| Question | Decision | Consequence for the build |
|---|---|---|
| How are house vs personal expenses separated? | **Not separated** — commingled joint cards, one per person | Need a **hybrid attribution engine**: auto-suggest by rules, confirm/correct by hand |
| Where is the property? | **Texas** | No state income tax. But property tax + TX hotel occupancy tax matter |
| How exact should taxes be? | **Detailed federal model** (Schedule E) | Build a real income − expenses − depreciation engine, not just a flat % |
| Multiple properties someday? | Yes, eventually | Model a `property` entity now; today there's exactly one |
| Reviews / business-quality metrics? | Later | Out of scope for v1; leave room in the data model |

---

## The core problem & the chosen approach

**Problem:** We can't tell from the account *which* transactions belong to the
Texas house, because the same cards pay for the house, the apartment, and life.

**Approach — a new orthogonal "attribution" dimension.** Today every transaction
gets one of 11 personal categories. We add a *second, independent* axis:

```
transaction
 ├─ category   (existing: home / groceries / dining / …)  → personal budget
 └─ propertyId (new: null | "prop_house")                 → which property, if any
     └─ scheduleE (new: mortgage_interest / repairs / …)  → tax line, if a property expense
```

Rule: **if a transaction is attributed to a property, it leaves the personal
budget and enters that property's P&L** — exactly how `kind: 'transfer'` is already
excluded from spending today. This means the existing budget keeps working
untouched; the Airbnb view is a clean carve-out.

**How attribution happens (hybrid):**

1. **Auto-suggest by rules.** Property-scoped rules tag the obvious ones:
   - Mortgage servicer `SERVICEMAC` → `mortgage_interest` (split, see note)
   - The house's specific utility accounts (the TX electric/water/gas provider
     and account, distinct from the FL apartment's)
   - `AIRBNB` deposits in checking → rental income
   - The house's insurance policy, HOA, lawn/pool service, etc.
2. **Review queue.** Anything plausibly the house but not certain (Home Depot,
   a handyman Zelle, a furniture purchase) lands in a "Needs a decision" inbox:
   tap → House / Personal, pick the Schedule E line.
3. **Manual override always wins** and is remembered (a learned rule so the same
   merchant auto-files next time).

> ⚠️ **Mortgage is not one number.** The single **$3,100 `SERVICEMAC` bank line is
> four things**: principal (~$2,200 P&I minus interest — *not* deductible),
> interest (deductible), escrowed property tax (deductible), and escrowed insurance
> (deductible). The engine must split it, not file it as one "home" expense. v1
> lets the user enter the split from the mortgage statement / Form 1098 / escrow
> analysis rather than guess from the bank line. This is the single most important
> data-quality detail in the whole module.

---

## Data model changes

All inside the existing single-row `budget_state` (JSONB), same sync pattern as today.

### New: `properties[]`

```js
{
  id: 'prop_house',
  name: 'Texas House',
  emoji: '🏡',
  address: '…',
  state: 'TX',
  type: 'airbnb',                  // future: 'long_term', 'personal'
  placedInService: '2026-01-01',   // date rental began — drives depreciation start
  basis: {
    purchasePrice: 0,
    landValue: 0,                  // land is NOT depreciable
    buildingValue: 0,              // depreciable basis = building + capital improvements
    capitalImprovements: 0,
  },
  annualPropertyTax: 0,            // target for the property-tax savings tracker
  active: true,
}
```

### Changed: each `transaction` gains

```js
{
  …existing fields…,
  propertyId: null,         // null = personal; else a property id
  scheduleE: null,          // tax line id when propertyId is set (see categories below)
  attribution: 'auto'|'manual'|'unreviewed',  // drives the review queue
}
```

### New: `propertyRules[]` (learned + seeded)

```js
{ id, propertyId, match: /SERVICEMAC/i, scheduleE: 'mortgage_interest', source: 'manual' }
```

### Migration

`supabase_setup.sql` stays the same shape (JSONB columns absorb new fields). Add a
one-time client-side backfill: existing transactions get `propertyId: null`,
`attribution: 'unreviewed'`. No SQL migration strictly required, but document it.

---

## Schedule E — the tax engine

Residential rental, reported on **Schedule E (Form 1040)**. We model the real lines.

### Income
- **Gross rents** = Airbnb gross earnings. Important: an Airbnb payout deposit is
  *net* of Airbnb's host service fee and sometimes net of occupancy taxes Airbnb
  collects & remits. For accuracy we want **gross income** and **host fees** as a
  deductible expense — best sourced from the **Airbnb earnings CSV**, not the bank
  deposit (see Ingestion).

### Deductible expenses (Schedule E line map)
| Line | What it captures here |
|---|---|
| Advertising | Listing promotion, photography |
| Auto & travel | Trips to the property (mileage) |
| Cleaning & maintenance | Turnover cleaning, supplies |
| Commissions | **Airbnb host service fees** |
| Insurance | Landlord/STR policy |
| Legal & professional | Accountant, LLC fees |
| Management fees | Co-host / property manager |
| Mortgage interest | Interest portion only (from 1098) |
| Repairs | Fixes that don't add value (vs. improvements → depreciated) |
| Supplies | Consumables, furnishings under threshold |
| Taxes | **Property tax** + TX hotel tax the host remits |
| Utilities | The house's electric/water/gas/internet |
| Depreciation | Calculated, see below |
| Other | Everything else, itemized |

### Depreciation (the piece people forget)
- Residential rental real property: **straight-line over 27.5 years**.
- Depreciable basis = **building value + capital improvements** (land excluded).
- **Mid-month convention** in the year placed in service.
- Annual depreciation ≈ `buildingBasis / 27.5`, prorated in year 1.
- Furniture/appliances follow shorter schedules (5–7 yr) — v2 nicety; v1 can lump
  into "Other" or a simple furnishings line.

### The output
```
Net rental income (loss) = Gross rents − deductible expenses − depreciation
```

### Tax nuances we must surface (not silently assume)
1. **You're taxed on net profit, not gross.** A net **loss** generally does *not*
   create tax — it usually *reduces* other tax. This directly answers Matheus's
   "do we still pay taxes on a loss?" question: federally, no — losses help you,
   subject to the limits below.
2. **Passive Activity Loss rules.** Rental losses are passive. Up to **$25,000**
   of loss can offset ordinary income *if* MAGI < $100k (phases out to $150k) and
   you "actively participate." Excess loss is **suspended and carried forward**.
   The engine should label a loss as "usable now" vs "carried forward."
3. **Self-employment tax flag.** Plain rental income is **not** subject to SE tax.
   But short-term rentals with **substantial guest services** (hotel-like) can be
   pushed to **Schedule C + SE tax**. This is a judgment call — the module should
   *flag it for a CPA*, not decide it.
4. **QBI deduction** (up to 20% of net rental income) may apply — show as a
   potential, flagged.
5. **Texas specifics:** no state income tax (nice), but **property tax** is real
   and lumpy, and **TX hotel occupancy tax (6% state + local)** applies to
   short-term stays. **Confirmed:** Airbnb collects & remits the **6% state** HOT
   automatically; the **local city/county HOT (1–9%) is the host's responsibility**
   (register + remit directly). Treat local occupancy tax as its own tracker,
   separate from income tax. Local rate TBD pending the property's city/county.

### The set-aside helper
- Estimate marginal federal rate on **net rental income** (user enters their
  bracket / filing status) → recommend a reserve %.
- **Property-tax handling:** taxes here are **escrowed inside the $3,100 payment**,
  so the lender already smooths the lumpy bill — no separate "save toward the bill"
  pot is needed. Instead, **capture the escrowed property tax + insurance as
  deductible Schedule E expenses.** (Keep the savings-tracker UI available for any
  future property whose taxes are *not* escrowed.)
- Everything labeled clearly: **estimates, not tax advice.**

---

## Data ingestion changes

| Source | Today | Add |
|---|---|---|
| Chase card/checking PDF | Parsed for expenses; income captured but unused | Detect `AIRBNB` deposits → property income; surface house expenses to the attribution engine |
| **Airbnb earnings CSV** | — | **New optional import.** This is the source of truth for gross rent, host fees, cleaning, and occupancy tax collected. Strongly recommended for revenue accuracy |
| Mortgage 1098 / annual statement | — | Manual entry of the interest / principal / escrow split (once a year) |

The Airbnb CSV importer mirrors the existing `statements.js` pattern: parse →
preview → dedupe → persist. It's the cleanest way to get true revenue without
reverse-engineering net deposits.

---

## UI — the Airbnb section

Lives **inside Budget mode** as a sub-area (a "🏡 Airbnb" toggle/sub-tab next to the
existing spending view), with a **property switcher** for the multi-property future.

| Tab | Shows |
|---|---|
| **Overview** | Net cash flow + P&L this month/YTD, occupancy (later), reserve health, "needs a decision" count |
| **Revenue** | Payouts over time, gross vs. fees vs. net, simple forward projection |
| **Expenses** | Schedule E categorized breakdown; fixed monthly (mortgage interest, escrow, utilities) vs. variable (repairs, supplies) |
| **Taxes** | Schedule E summary, depreciation schedule, estimated federal liability + set-aside %, property-tax tracker, occupancy-tax note, CPA flags |
| **Review queue** | The attribution inbox — tap to assign unclear transactions |

Reuses existing UI primitives (`Card`, `Donut`, `ProgressBar`, recharts) and the
Honey/Sea-Glass theme — no new design language.

---

## Phased build plan

| Phase | Scope | Why this order |
|---|---|---|
| **0 — Foundations** | `properties[]` entity, transaction `propertyId`/`scheduleE`/`attribution` fields, backfill, property switcher shell | Everything else needs the data model |
| **1 — Attribution** | Rules engine + review queue + learned overrides; Airbnb deposit detection | Get clean, trustworthy property data first |
| **2 — Airbnb dashboard** | Overview / Revenue / Expenses tabs | The "how's it doing" payoff, on real data |
| **3 — Tax engine** | Schedule E calc, depreciation, set-aside helper, property-tax tracker, CPA flags + disclaimers | Highest-value, highest-care; build on solid data |
| **4 — Polish & future** | Airbnb CSV import, projections, occupancy tax tracker, multi-property, reviews/business metrics | Nice-to-haves once the core is trusted |

---

## Known inputs & working assumptions (June 16, 2026)

Captured from Matheus's answers. Items marked **(estimate)** should be replaced
with real numbers when available; the engine must store them as editable inputs.

| Input | Value | Notes |
|---|---|---|
| Purchase price | **$350,000** (2025) | Was their primary residence before the FL move |
| Total monthly payment (PITI) | **$3,100/mo** | **Actual** (per Matheus). Bundles P&I + escrowed tax & insurance — must be split |
| Loan amount | **~$337,500 (estimate)** | ~$10–15k down (NOT 20%); replace with real balance from statement |
| Mortgage rate | **~6.8% (estimate)** | 2025 TX 30-yr average |
| P&I portion | **~$2,200/mo (estimate)** | Computed from loan + rate |
| Escrow portion | **~$900/mo (estimate)** | Remainder of the $3,100 → property tax + insurance |
| Property tax | **~$7,000/yr (~$580/mo) (estimate)** | TX ≈ 2% of value; **escrowed** (lender pays it) — deductible |
| Insurance | **~$3,800/yr (~$320/mo) (estimate)** | Landlord/STR policy; **escrowed** — deductible |
| Mortgage interest (full yr) | **~$22,800/yr (estimate)** | Early-amortization years; only interest is deductible, not principal |
| Mortgage interest deductible 2026 | **~$12,300 (estimate)** | Only the ~6.5 months *after* placed-in-service |
| Land / building split | **20% / 80% (estimate)** | Replace with county appraisal "land vs improvement" ratio |
| Depreciable building basis | **~$280,000 (estimate)** | = 80% of purchase price (coincidentally near the loan amount — unrelated) |
| Depreciation (full year) | **~$10,180/yr** | $280k ÷ 27.5 |
| Depreciation (2026, year 1) | **~$5,500** | June placed-in-service → 1.970% mid-month factor |
| Placed in service | **June 16, 2026** | First guest. Expenses before this date are *not* rental expenses |
| Owner / filer | **Melanie**, files **single** | House is in her name; couple is not married |
| Income / bracket | **~$150k → 24% federal marginal** | No TX state income tax; below $200k so no 3.8% NIIT |
| Federal set-aside guidance | **~24% of net rental *profit*** | $0 in a loss year |
| State occupancy tax (6%) | **Airbnb collects & remits** | No host action needed |
| Local occupancy tax (1–9%) | **Host's responsibility** | Must register with city/county & remit; **rate TBD pending property city/county** |

### ⚠️ Passive-loss caveat that changes year-1 strategy
Melanie's ~$150k income **fully phases out** the $25,000 special allowance for
deducting rental losses against ordinary income (phaseout runs $100k→$150k MAGI).
Normally a year-1 loss (likely, with depreciation + partial year + startup) would
be **suspended and carried forward**, not refunded now.

**However**, because this is a *short-term* rental (avg. guest stay < 7 days), the
"short-term rental" exception may apply: if the couple **materially participates**,
losses can be treated as **non-passive** and offset ordinary income. This is a
real, high-value CPA question for year one — the engine should **flag it, not
decide it**.

## Remaining open questions

1. **Local occupancy tax** — what city/county is the property in? Needed to look up the local HOT rate + registration. *(Matheus to provide; I'll research the rate.)*
2. **Mortgage 1098** — replace the estimated interest/principal/escrow split when the statement is available.
3. **County appraisal land/improvement values** — replace the estimated 20/80 split (drives depreciation accuracy).
4. **Airbnb earnings CSV** — can it be exported? If yes, prioritize that importer for true gross-rent vs. host-fee data.
5. **Material participation** — confirm with a CPA whether the STR exception makes year-1 losses currently deductible.

---

## Guardrails

- **Not tax advice.** Every tax number is an estimate to *guide set-asides and a CPA
  conversation*, shown with a clear disclaimer.
- **Data stays client-side / in the shared Supabase row**, same trust model as today.
- **Don't break the existing budget.** Attribution is additive; un-attributed
  transactions behave exactly as they do now.
