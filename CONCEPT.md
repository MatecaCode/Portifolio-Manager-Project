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
3. **US energy thesis**: His own picks (NOT FinClass): CEG (Constellation),
   VRT (Vertiv), BE (Bloom Energy). Tagged **EN**. Source: a US stock
   recommendation video (whiteboard targets: CEG +40% by 3/26, VRT +200% by
   6/25, BE +44% by 2/26).
4. **Crypto**: Existing real positions (BTC, ETH, XRP, BNB, AVAX) on an
   exchange, currently ~-$960 unrealized.
5. **Planned**: S&P 500 exposure, possibly other international markets.

## Key Design Decisions (and WHY)

| Decision | Rationale |
|---|---|
| 6 category buckets: BR Stocks, FIIs, Renda Fixa, US Stocks, International, Crypto | Matches how Matheus mentally organizes money |
| FinClass = **tag (FC)**, not a bucket | His call: most BR holdings are FC picks; a bucket would duplicate everything. Tag travels across categories. |
| Energy = **tag (EN)**, not a bucket | Same logic; only 3 stocks now, may grow across categories |
| WRLD11/USDB11 → International category | They're B3-listed wrappers (VT/BND) but the *intent* is international exposure — categorized by intent, his explicit choice |
| Wealthfront = separate cash card, NOT in allocation % | It's emergency fund, not an investment bet. Counts toward Net Worth only. |
| Renda fixa: price=1, shares=BRL invested | CDB/Tesouro don't have unit prices; track invested amount |
| Dual currency BRL/USD with manual FX rate | BR holdings priced in BRL, unified USD total via editable rate (~5.70) |
| Pre-purchase seeding: 0 shares, cost=price | Wishlist mode — P/L reads zero until real buys happen |
| Priority of views (his ranking) | 1. Allocation % across categories, 2. Total value + P/L, 3. Per-asset performance, 4. Target vs actual rebalancing |

## Allocation Targets (current defaults, sum=100)

br_stocks 11 / fii 11 / renda_fixa 25 / us_stocks 20 / intl 23 / crypto 10

Derived from FinClass's visible BRL allocation (~94% captured from screenshots,
some rows may be below fold) scaled to leave room for US + crypto sleeves.
Matheus may want US higher (conviction) — these are starting points.

## Seeded Holdings (from real screenshots)

**FinClass picks (all tagged FC), reference price = FC's "preço máximo de compra":**
- Ações: PRIO3 @ R$69.24 (6%), GMAT3 @ R$6.92 (5%), WIZC3 @ R$10.50 (4%)
- FIIs: XPML11 @ R$115 (5%), CPTS11 @ R$8.90 (4%), PSEC11 @ R$81 (3%), PVBI11 @ R$110 (3%)
- Renda Fixa: CDB Daycoval/BTG 104% CDI (15%), JURO11 P/VP≤1.035 (7.5%),
  Tesouro IPCA 2050 min IPCA+6.5% (7.5%), ETF FIXA11/IDKA11 (5%)
- Alternativos: WRLD11/VT (11%), USDB11/BND (6%), ACE Capital (6%), Genoa Radar (6%)

**Energy picks (tagged EN, Matheus's own):** CEG ~$280, VRT ~$110, BE ~$35

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

**Current state:** `src/components/Budget.jsx` is a full visual placeholder
with sample data (sample May month, $3,500 budget) so the layout can be felt
and iterated on before any parsing/storage is wired up. Nothing is functional
yet by design. Future data likely needs a Supabase `transactions` table +
category rules table.
