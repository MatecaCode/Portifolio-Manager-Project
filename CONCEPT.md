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

## Budget Companion (planned — placeholder shipped June 2026)

A second "platform" living next to the portfolio: same SunnyHeron brand, warm
"Honey" palette instead of Sea Glass, toggled via the 📊 Portfolio / 💸 Budget
switch in the header (next to the sync chip). Portfolio = what we keep;
Budget = what we spend.

**The vision (Matheus's words, paraphrased):** take a Chase credit card or
account statement and break the expenses into a clean, fun budgeting view —
detail when we want it, plus category sections showing where the most money
goes, and recommendations on how to decrease expenses next month. Must be fun,
not plain. Also needs a way to set up a budget if we want a goal to aim for.

**Planned flow:**
1. Drop in a Chase statement (CSV or PDF) — no bank logins, file-only
2. Auto-categorize every transaction into emoji categories
   (🏠 Home, 🛒 Groceries, 🌮 Dining out, 🎢 Fun & travel, 🚗 Transport,
   📺 Subscriptions, 🧺 Everything else) with learnable merchant rules and
   one-tap re-filing
3. Monthly recap: spent vs budget per category, donut breakdown, and a
   "Coach's corner" with painless ways to cut spending (over-budget nudges,
   unused-subscription hunting, savings-to-portfolio framing)
4. Budget goals: per-category caps or one monthly cap, with live progress bars
   and playful reward framing ("stay under and the difference funds taco night")

**Reference apps (successful cases to borrow from):**
- **YNAB** — every dollar gets a job (zero-based budgeting)
- **Copilot Money** — delightful auto-categorization, best-in-class fun design
- **Monarch Money** — shared finances built for couples
- **Rocket Money** — unused-subscription detection and cancellation nudges

**Current state (June 2026): functional v1.** PDF + CSV import works end-to-end:
- `src/lib/statements.js` — pdf.js (v4, kept for older-browser compat) extracts
  text in the browser (file never leaves the page); regex parsers for Chase
  credit card (ACCOUNT ACTIVITY) and Chase checking (TRANSACTION DETAIL)
  formats. Gotchas handled: double-spaced headers, detached minus signs
  ("- 25.00"), Dec→Jan billing cycles, multi-line FX descriptions.
- CSV import too (`parseStatement` dispatches on extension): Chase activity
  CSV (Details, Posting Date, Description, Amount, **Type**, Balance) and
  Chase card CSV (Transaction Date, …, Type, Amount). The Type column is
  authoritative — ACCT_XFER/LOAN_PMT → transfer, credits → income, debits →
  categorized expense — more reliable than guessing from the description.
  CSV is the long-term format (Chase only offers ~recent months as PDF).
  last4 comes from the filename ("Chase9269_Activity_…"); RFC-4180 parser
  handles quoted descriptions with embedded commas. A CSV re-import merges
  into the matching PDF account and transaction-level dedup drops the
  overlapping rows (verified: PDF 29 + CSV 141 − 23 overlaps = 147).
- `src/data/budget.js` — 11 emoji categories + ordered merchant rules
  (H-E-B PHARMACY→health before H-E-B→groceries, UBER EATS before UBER, etc.)
- `src/hooks/useBudget.js` — Supabase `budget_state` shared-row sync (table
  applied as migration `create_budget_state`), localStorage fallback.
- Duplicate detection: statement-level (same account + closing date blocked)
  and transaction-level (account+date+amount+description key).
- Transfers (card payments, savings moves) are excluded from spending so the
  same dollar never counts twice; checking deposits tracked as income.
- UI: import preview before save, per-account profiles (rename inline,
  tap to include/exclude, "Combine all"), month picker, category drill-down
  with per-transaction recategorize, total + per-category budgets,
  data-driven Coach's corner, statement list with undo-import.
- Verified against real statements: card ···7448 reconciles to the penny
  ($2,792.04 = purchases + fee − refund); checking ···9269 all 29 rows.

**Next ideas:** merchant-rule learning from manual recategorizations, more
bank formats (Wealthfront cash), monthly recap story like the Growth tab,
subscription/recurring detection view, budget rollover.
