# Portfolio Manager — Full Concept & Vision Document

> This document preserves the complete concept behind the project, independent of code.
> If the code is ever lost or rebuilt from scratch, this file + HANDOFF.md is everything needed.
> Last updated: June 11, 2026

---

## Who This Is For

**Matheus Soler & Melanie Garza** — a couple managing shared finances:
- Matheus drives the investment strategy
- Both need access to the same live portfolio view from any device
- Joint Wealthfront cash account (emergency fund)
- Matheus is starting his stock investing journey; crypto positions already exist

## Why This Exists (The Origin)

Matheus tried existing portfolio trackers (investing.com etc.) and found them
clunky. He paid for **FinClass** (Brazilian investment education group) expecting
portfolio tooling — they turned out to be recommendation-only with weak tracking.
Decision: build a custom tracker that fits exactly how he thinks about his money.

Core personal requirement (his words): *"If I can't see how my investments are
doing and if I don't have a clear vision, a visual breakdown of what I'm investing
on and how much in each, I can't [invest]. I need to have a system in place."*

**He has NOT bought most stocks yet.** The tracker is pre-purchase planning first,
live tracking second. Most holdings are seeded with 0 shares — a wishlist with
reference prices, ready for when he buys.

## Investment Strategy Context

1. **FinClass-following**: He'll mirror FinClass's Brazilian portfolio
   recommendations (ações, FIIs, renda fixa). They update their portfolio over
   time and he'll follow along. Their picks are tagged **FC** in the app.
2. **Brazil conviction**: He believes Brazil is well-positioned; wants a
   well-balanced Brazilian portfolio (stocks + FIIs + renda fixa).
3. **AI-infrastructure theses**: His own picks (NOT FinClass), each its own
   bucket so they carry separate targets:
   - **Energy** — CEG (Constellation), VRT (Vertiv), BE (Bloom Energy). Source:
     a US stock recommendation video (whiteboard targets: CEG +40% by 3/26,
     VRT +200% by 6/25, BE +44% by 2/26).
   - **Water** — XYL, ECL, PHO (in review).
   - **Rare earths** — MP, REMX (in review).
4. **Crypto**: Existing real positions (BTC, ETH, XRP, BNB, AVAX) on an
   exchange, currently ~-$960 unrealized.
5. **Planned**: S&P 500 exposure, possibly other international markets.

## Key Design Decisions (and WHY)

| Decision | Rationale |
|---|---|
| Buckets describe the **bet**, not the country: Crypto, Stocks, FIIs, Renda Fixa, International + the thematic sleeves Energy, Water, Rare Earths | His call, June 2026: "US Stocks" was too broad — it silently held the whole energy thesis, and water names had nowhere to go. Each thesis now carries its own target so none can quietly take over. |
| Country = **sticker on the holding** (USA / BR / CHINA / JPN / EUR / GLOBAL), not a bucket | Same call. Where something trades is a property of the holding, not a kind of bet. The sticker also decides the holding's currency and which price API quotes it, so a bucket can hold a B3 name and a NYSE name side by side. |
| Every region except BR settles in USD | The app carries one USD/BRL rate; a second currency would need a second rate. China/Japan/Europe assume the usual route for a US-based investor — a US-listed ADR or ETF, which really is dollar-priced. |
| "By country" bar on the Overview | Splitting BR Stocks / US Stocks into thesis buckets would otherwise have hidden the geographic mix. The stickers add it back as its own view. |
| FinClass = **tag (FC)**, not a bucket | His call: most BR holdings are FC picks; a bucket would duplicate everything. Tag travels across categories. |
| WRLD11/USDB11 → International bucket, BR sticker | They're B3-listed wrappers (VT/BND) but the *intent* is international exposure — the bucket says what the exposure is, the sticker says where it trades (and in which currency) |
| Wealthfront = separate cash card, NOT in allocation % | It's emergency fund, not an investment bet. Counts toward Net Worth only. |
| Renda fixa: price=1, shares=BRL invested | CDB/Tesouro don't have unit prices; track invested amount |
| Dual currency BRL/USD with manual FX rate | BR holdings priced in BRL, unified USD total via editable rate (~5.70) |
| Pre-purchase seeding: 0 shares, cost=price | Wishlist mode — P/L reads zero until real buys happen |
| Priority of views (his ranking) | 1. Allocation % across categories, 2. Total value + P/L, 3. Per-asset performance, 4. Target vs actual rebalancing |

## Allocation Targets (current defaults, sum=100)

stocks 11 / fii 11 / renda_fixa 25 / intl 23 / crypto 10 /
energy 12 / water 5 / rare_earths 3

Derived from FinClass's visible BRL allocation (~94% captured from screenshots,
some rows may be below fold) scaled to leave room for US + crypto sleeves.
Matheus may want the thematic sleeves higher (conviction) — these are starting
points. The old `us_stocks 20` is exactly the new energy 12 + water 5 +
rare_earths 3; saved targets are split in that same proportion on load, so an
existing portfolio's total is preserved to the decimal.

## Seeded Holdings (from real screenshots)

**FinClass picks (all tagged FC), reference price = FC's "preço máximo de compra":**
- Ações: PRIO3 @ R$69.24 (6%), GMAT3 @ R$6.92 (5%), WIZC3 @ R$10.50 (4%)
- FIIs: XPML11 @ R$115 (5%), CPTS11 @ R$8.90 (4%), PSEC11 @ R$81 (3%), PVBI11 @ R$110 (3%)
- Renda Fixa: CDB Daycoval/BTG 104% CDI (15%), JURO11 P/VP≤1.035 (7.5%),
  Tesouro IPCA 2050 min IPCA+6.5% (7.5%), ETF FIXA11/IDKA11 (5%)
- Alternativos: WRLD11/VT (11%), USDB11/BND (6%), ACE Capital (6%), Genoa Radar (6%)

**Energy sleeve (Matheus's own):** CEG ~$280, VRT ~$110, BE ~$35

**Crypto (REAL positions from exchange, April 2026):**
- BTC 0.04718 @ avg $86,845.51
- ETH 0.58505 @ avg $2,874.54
- XRP 161.44525 @ avg $2.00
- BNB 0.0648 @ avg $999.87
- AVAX 3.02711 @ avg $34.30

**Cash:** Wealthfront joint $12,513.43 @ 4.05% APY (manual updates only — no API exists)

## Infrastructure (all FREE tier)

| Piece | Detail |
|---|---|
| GitHub | github.com/MatecaCode/Portifolio-Manager-Project (code) |
| Vercel | project `portfolio-manager-project`, ALREADY connected to the GitHub repo; deploys on push to main → portifolio-manager-project.vercel.app |
| Supabase | org "Portfolio Manager", project id `zyfmuddelxryvoxnqpxl`, AWS us-west-2. NOTE: free tier pauses when inactive — needs restore before use |
| CoinGecko | crypto prices, no key needed |
| Finnhub | US stock prices, key on finnhub.io dashboard (account: matheus.msoler@gmail.com) |
| Brapi | BR stock/FII prices, key on brapi.dev |

⚠️ **DO NOT TOUCH** the Vettale project (Vercel `vettale`/vettale.shop, Supabase
"Vettale's Website" `ieotixprkfglummoobkb`, GitHub Vettale/Vettale2 repos).
That's Matheus's live business website, completely unrelated.

API keys and env var setup: see HANDOFF.md and .env.example.
Supabase table schema: see supabase_setup.sql (single shared row, RLS allow-all
with publishable key — acceptable for a 2-person household app).

## Deployment State (as of June 11, 2026)

- [x] Code complete and building (React 19 + Vite 8)
- [x] Vercel project created + linked to GitHub repo
- [x] Supabase project created (id zyfmuddelxryvoxnqpxl) — was "restoring" after pause
- [x] All API keys obtained
- [ ] Code pushed to GitHub main  ← THE blocker; push triggers everything
- [ ] supabase_setup.sql run in SQL Editor
- [ ] 4 env vars added in Vercel → Settings → Environment Variables
- [ ] First deploy verified

## Roadmap (agreed, in priority order)

1. **Go live** (the 4 unchecked boxes above)
2. **Fix placeholder prices** — WRLD11, USDB11, ACE, GENOA still price=1;
   check if Brapi returns WRLD11/USDB11 directly
3. **Mobile layout** — Holdings grid overflows on phones; Melanie will likely
   use mobile most
4. **Transaction history** — individual buy lots instead of single avg cost;
   new Supabase table
5. **Auth** (maybe) — currently anyone with the URL can edit; fine for now,
   Supabase Auth with two accounts later
6. **CSV export**, **price alerts** (Vercel cron), **renda fixa yield accrual**,
   **Melanie's accounts** as additional CASH_ACCOUNTS entries

## Working Style Notes (for any AI continuing this)

- Matheus sends screenshots and expects data extracted from them into the app
- He prefers being given a recommendation with reasoning over open-ended options
- Tags over buckets when a classification spans categories
- He says "thin class" sometimes in voice transcription — it means FinClass
- Repo name has a typo he's kept: "Portifolio" — don't "fix" it, it matches
  the GitHub/Vercel project names
## Rental Companion — the Texas house (August 2026)

A second "platform" living next to the portfolio: same SunnyHeron brand,
toggled via the 📊 Portfolio / 🏡 Rental switch in the header. Portfolio = what
we keep; Rental = the house in Allen, TX that we moved out of and now rent on
Airbnb.

**It used to be a budget app.** Through mid-2026 this side tracked household
spending: 11 emoji categories, per-category budgets, a donut of where the money
went, a "Coach's corner". That's gone as of August 2026 — Rocket Money does the
day-to-day spending job better and we weren't going to do it twice. What was
worth keeping is the part no budgeting app does: pulling the rental out of the
commingled joint accounts and turning it into a Schedule E year-end report.

**The problem it solves.** The same joint Chase cards and checking pay for the
Florida apartment, the Texas house, and everything else. Nothing marks which
charge is the rental's. So the app imports the statements and asks exactly one
question per line: *is this the house?* Most lines are 👤 Personal and stop
there — they're never totalled, budgeted or charted, they just stay searchable.

**The flow:**
1. Drop in a Chase card/checking statement (PDF or CSV) or a Wealthfront
   savings export — parsed in the browser, previewed before anything saves.
2. The unmistakable lines file themselves: the mortgage servicer
   (`SERVICEMAC`) and the hosting platforms' fees. Airbnb payouts land as
   rental income.
3. Everything else lands as personal. Search it for the ones that were really
   the house — a plumber, a Home Depot run, the Allen utility — and file each
   into a House bucket in one tap.
4. Each House bucket **is** a Schedule E line, so filing a transaction is the
   tax classification. There is no second round of tagging.
5. The Taxes view turns that into the year-end report: Schedule E lines,
   depreciation, the 1098/escrow mortgage split, a set-aside estimate, CPA
   flags, and a watchlist of deductions that never show up as a bank line.

**Teaching it:** 🧠 *Always* learns a merchant ("every Octopus Energy line is
House · Utilities"), ✨ *Rule* builds a plain-English "description contains X →
file as Y" rule, and 🔍 sends an ambiguous merchant (a family Zelle) to a manual
review queue instead of guessing.

**How it's built:**
- `src/lib/statements.js` — pdf.js extracts text in the browser (the file never
  leaves the page); regex parsers for Chase credit card (ACCOUNT ACTIVITY),
  Chase checking (TRANSACTION DETAIL), Chase activity/card CSV and Wealthfront
  CSV. Gotchas handled: double-spaced headers, detached minus signs
  ("- 25.00"), Dec→Jan billing cycles, multi-line FX descriptions. On CSV the
  Type column is authoritative (ACCT_XFER/LOAN_PMT → transfer, credits →
  income). A CSV re-import merges into the matching PDF account and
  transaction-level dedup drops the overlapping rows.
- `src/data/house.js` — one 👤 Personal bucket + the House buckets, each naming
  the Schedule E line it feeds; the two auto-file rules; smart-rule matching.
- `src/data/property.js`, `src/lib/tax.js`, `src/data/taxSources.js` — the
  property + its tax inputs, the pure tax engine (27.5-yr straight-line
  depreciation with the mid-month convention, mortgage split, passive-loss and
  §280A tests, set-aside), and the IRS sources behind every claim.
- `src/hooks/useRental.js` — Supabase `budget_state` shared-row sync (the table
  keeps its original name), localStorage fallback, and the migration that
  collapsed every old personal category into 👤 Personal (schema 4).
- `src/components/Rental.jsx` — the four views: 🏡 the house (cash flow, review
  queue, buckets, search), 🧮 Taxes, 🧠 Rules, 🏦 Accounts.
- Duplicate detection: statement-level (same account + closing date blocked)
  and transaction-level (account+date+amount+description key).
- Bank balances still feed net worth: the closing balance of the newest
  statement flows into a linked portfolio cash account (🏦 Accounts → Sync to).

**Not tax advice.** Every figure in the Taxes view is an estimate to organize
the year and guide a CPA conversation — labelled as such, with the IRS page
behind each rule one tap away.

**Next ideas:** the Airbnb earnings CSV (true gross rent vs. host fees rather
than net payouts), revenue projections, the local hotel-occupancy-tax tracker,
and multi-property support (a House bucket implies the property today).
