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

> ⚠️ **Mortgage is not one number.** A `SERVICEMAC` payment bundles principal
> (not deductible), interest (deductible), and often escrowed property tax +
> insurance (deductible, but in the year actually paid out of escrow). v1 can let
> the user enter the annual split from the mortgage statement / Form 1098 rather
> than guess from the bank line. This is the single most important data-quality
> detail in the whole module.

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
   short-term stays. Airbnb remits the *state* portion in many cases; **local**
   may be the host's job. Treat occupancy tax as its own tracker, separate from
   income tax. **Verify what Airbnb actually remits for this listing.**

### The set-aside helper
- Estimate marginal federal rate on **net rental income** (user enters their
  bracket / filing status) → recommend a reserve %.
- **Property-tax savings tracker:** divide `annualPropertyTax` by 12, show a
  "build toward the bill" progress bar with an actual reserve balance.
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

## Open questions to settle before Phase 0

1. **Mortgage split source** — pull from the annual 1098/escrow statement (recommended) or estimate per-payment? Affects how the `SERVICEMAC` line is handled.
2. **Property cost basis** — do we have purchase price + a land vs. building split (often from the county appraisal)? Needed for depreciation.
3. **Placed-in-service date** — when did it first become a rental? Drives year-1 depreciation and which expenses are pre-rental (capitalized) vs deductible.
4. **Airbnb CSV** — can we export the earnings CSV? If yes, revenue accuracy jumps a lot and we should prioritize that importer.
5. **Filing status / bracket & active-participation** — needed for the set-aside % and the $25k passive-loss allowance.
6. **What does Airbnb remit** for this listing (state vs. local occupancy tax)? Determines whether we track a local tax liability.

---

## Guardrails

- **Not tax advice.** Every tax number is an estimate to *guide set-asides and a CPA
  conversation*, shown with a clear disclaimer.
- **Data stays client-side / in the shared Supabase row**, same trust model as today.
- **Don't break the existing budget.** Attribution is additive; un-attributed
  transactions behave exactly as they do now.
