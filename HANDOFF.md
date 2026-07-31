# Portfolio Manager — Claude Code Handoff

## What This Is

A shared investment portfolio tracker for Matheus & Melanie. React + Vite SPA deployed to Vercel, with Supabase for real-time sync between their devices and three live price APIs.

**Repo:** https://github.com/MatecaCode/Portifolio-Manager-Project  
**Local directory:** `C:\Documents\GitHub\Portifolio Repo`  
**Stack:** React 19, Vite 8, Supabase, Recharts, Lucide React, CSS Modules

---

## Immediate First Tasks (Do These Before Anything Else)

### 1. Extract the zip into the local directory
The source code is in the zip downloaded from Claude.ai. Extract the contents of `portfolio-app/` into:
```
C:\Documents\GitHub\Portifolio Repo\
```
So the structure is:
```
C:\Documents\GitHub\Portifolio Repo\
  src\
  public\
  package.json
  vite.config.js
  vercel.json
  supabase_setup.sql
  .env.example
  README.md
  ...
```

### 2. Create `.env.local`
Copy `.env.example` to `.env.local` and fill in the real values from each
provider's dashboard. **Never commit it** — `*.local` is gitignored.

Real keys do not belong in this file, in `.env.example`, or anywhere else in
the repo: this repository is public. See `SECURITY.md`.

### 3. Run Supabase setup SQL
1. Go to https://supabase.com → your project
2. Open **SQL Editor → New query**
3. Paste and run the entire contents of `supabase_setup.sql`

This creates the tables with RLS enabled, restricted to signed-in users, and
seeds the single shared row.

### 3b. Create the sign-in accounts
The app is gated behind Supabase Auth. In the dashboard:
- **Authentication → Users → Add user** — create one account for each of you
- **Authentication → Providers → Email** — turn **off** public sign-ups

Skipping the second step defeats the first: anyone could register themselves
into the `authenticated` role and reach the shared data.

### 4. Install and run locally
```bash
cd "C:\Documents\GitHub\Portifolio Repo"
npm install
npm run dev
```

### 5. Push to GitHub and deploy to Vercel
```bash
git init
git remote add origin https://github.com/MatecaCode/Portifolio-Manager-Project.git
git add -A
git commit -m "feat: initial portfolio tracker"
git branch -M main
git push -u origin main
```
Then in Vercel:
- Import `MatecaCode/Portifolio-Manager-Project`
- Add the 4 env vars from step 2 under **Settings → Environment Variables**
- Deploy — Vercel auto-detects Vite, no config needed beyond `vercel.json`

---

## Project Structure

```
src/
  App.jsx                  # Root: tab routing, passes portfolio hook props down
  App.module.css           # App shell + nav tab styles
  main.jsx                 # React entry point
  index.css                # Global CSS vars, fonts, body styles

  data/
    portfolio.js           # CATEGORIES (the buckets), REGIONS (the country stickers),
                           # SEED_HOLDINGS, DEFAULT_TARGETS, SEED_REVIEWS, CASH_ACCOUNTS
                           # Edit here to add/remove holdings, buckets or stickers

  hooks/
    usePortfolio.js        # THE main hook — all state, Supabase sync, price refresh, CRUD

  lib/
    supabase.js            # Supabase client (returns null if env vars missing — safe)
    prices.js              # fetchAllPrices() — calls CoinGecko + Brapi + Finnhub in parallel
    migrate.js             # Brings saved state onto the bucket + sticker model (idempotent)
    trades.js              # IBKR Trade Confirmation PDF → fills → positions + average cost

  components/
    Header.jsx / .css      # Sticky header: logo, price status badge, sync status badge
    Overview.jsx / .css    # Tab 1: cash card, metric cards, donut chart, legend, tag breakdown
    Holdings.jsx / .css    # Tab 2: holdings table grouped by category, inline editing
    Rebalance.jsx / .css   # Tab 3: target % inputs, bar chart actual vs target, buy/trim hints
```

---

## Data Architecture

### Supabase table: `portfolio_state`
Single-row table — one shared record for the couple:
```sql
id          text primary key  -- always 'shared'
holdings    jsonb             -- array of holding objects (see shape below)
targets     jsonb             -- { stocks: 11, fii: 11, renda_fixa: 25, intl: 23, crypto: 10, energy: 12, water: 5, rare_earths: 3 }
reviews     jsonb             -- candidate investments awaiting a decision
trades      jsonb             -- imported broker fills; shares + cost are DERIVED from this
fx_rate     numeric           -- USD/BRL rate, e.g. 5.70
updated_at  timestamptz
```

### Holding object shape
```js
{
  id:        string,   // 'h_abc123' — random uid
  category:  string,   // the bet: 'crypto' | 'stocks' | 'fii' | 'renda_fixa' | 'intl' | 'energy' | 'water' | 'rare_earths'
  region:    string,   // the sticker: 'us' | 'br' | 'china' | 'japan' | 'europe' | 'global'
  ticker:    string,   // 'BTC', 'PRIO3', 'CEG', etc.
  name:      string,   // Display name
  shares:    number,   // Quantity held (or BRL invested for renda_fixa)
  cost:      number,   // Average cost per unit in its region's currency
  price:     number,   // Current price per unit in its region's currency (auto-updated by price service)
  finclass:  boolean,  // Tagged as FinClass recommendation
}
```

### Two independent axes
The **bucket** says what kind of bet it is; the **sticker** says where it lives.
They're independent, so Stocks can hold a B3 name and a NYSE name at once.

| Bucket | What belongs there |
|---|---|
| `crypto` | Coins and tokens |
| `stocks` | Individual companies, any country |
| `fii` | Brazilian real-estate funds |
| `renda_fixa` | BR bonds/CDs — manual, price=1, qty=BRL invested |
| `intl` | Broad world funds and multimercado managers |
| `energy` | Thematic sleeve — AI power: generation, grid gear, on-site power |
| `water` | Thematic sleeve — AI water: treatment, pumps, cooling |
| `rare_earths` | Thematic sleeve — magnets, mining, strategic metals |

The sticker carries the currency **and** the price source — that's the whole
reason it exists as data rather than as a label:

| Sticker | code | currency | Price source |
|---|---|---|---|
| `us` | USA | USD | Finnhub |
| `br` | BR | BRL | Brapi |
| `china` / `japan` / `europe` | CHINA / JPN / EUR | USD | Finnhub (assumes a US-listed ADR or ETF) |
| `global` | GLOBAL | USD | Finnhub, or CoinGecko for the crypto bucket |

Adding a region with a currency other than USD/BRL means adding an FX rate —
the app carries a single USD/BRL rate today. All values are converted to USD
for the overview total using the stored `fx_rate`.

### Broker imports (`src/lib/trades.js`, Import tab)
IBKR **Trade Confirmation Report** PDFs (Performance & Reports → Statements →
Trade Confirmations). Parsed in the browser; the file never leaves the page.

Three things the parser has to get right, all of them load-bearing:

| Trap | Handling |
|---|---|
| The report is landscape content on a portrait page (`page.rotate === 90`) | Rows run along `transform[4]`, cells along `transform[5]` — `extractRows()` picks the axes from the page rotation |
| Every fractional fill prints **twice** (exchange `-` and `IBKR`, identical qty/price/comm) | Deduped on everything except the exchange column. Summing both would double every position |
| A misread row would silently corrupt positions | `reconcile()` checks the parse against the report's own per-symbol subtotals and grand total. A parse that doesn't add up is **refused**, not applied |

`trades` in `portfolio_state` is a **ledger, not a snapshot** — `shares` and
`cost` are derived from it via `positionsFromTrades()`, so re-importing the same
confirmation is a no-op (fills are keyed on symbol + timestamp + qty + price +
proceeds) and each new day's file just extends the history.

**Commission is folded into cost basis** (his call): a position's cost is
`(Σ proceeds + Σ commission) / shares`. At his order sizes IBKR charges the 1%
maximum, so a freshly imported position correctly shows ≈ −1% P/L.

An import writes **only** `shares` and `cost`. Targets, buckets and stickers are
never rewritten — a ticker already in the Review list brings its bucket, sticker
and thesis along and is cleared from Review; anything unrecognised is placed by
hand on the preview screen.

### Migrating saved state (`src/lib/migrate.js`)
Runs on every load, against both the Supabase row and the localStorage copy,
and is idempotent. `br_stocks`/`us_stocks` → `stocks` + the matching sticker;
EN-tagged holdings → `energy`; review candidates themed Water/Rare earths →
their sleeve. Targets: the old `us_stocks` weight is split 12:5:3 across
energy/water/rare_earths so the total is preserved exactly. Only *legacy*
records get promoted — once something sits in a new bucket, that's a deliberate
choice and a stale theme string won't drag it back.

---

## Price Service (`src/lib/prices.js`)

`fetchAllPrices(holdings)` runs three fetches in parallel:

| Source | Assets | Auth | Rate limit |
|---|---|---|---|
| CoinGecko | BTC, ETH, XRP, BNB, AVAX, SOL | None (free) | ~30 req/min |
| Brapi | All BR tickers (PRIO3, XPML11, etc.) | `VITE_BRAPI_KEY` | Free tier |
| Finnhub | Everything with a USD sticker (CEG, VRT, BE…) | `VITE_FINNHUB_KEY` | 60 req/min free |

Routing is by sticker, not by bucket: `region.quotes` picks the API, the crypto
bucket always goes to CoinGecko, and `renda_fixa` plus GENOA are skipped
entirely (manual, price=1).

**To add a new crypto:** Add its CoinGecko ID to `GECKO_IDS` in `prices.js`.  
**To add a new US stock:** Add it to any bucket with the USA sticker — Finnhub handles any US ticker.  
**To add a new BR stock/FII:** Add it with the BR sticker — Brapi handles any B3 ticker.

Auto-refreshes every 5 minutes (gentle on free-tier API limits). Manual refresh via the header button.

---

## Sync Architecture (`src/hooks/usePortfolio.js`)

Load order on startup:
1. Try Supabase → `portfolio_state` where `id = 'shared'`
2. If Supabase unavailable → fall back to `localStorage` key `portfolio_v4`

Save on every change (debounced 800ms):
1. Always writes to `localStorage` immediately (instant, offline-safe)
2. Then upserts to Supabase if available

This means:
- Both Matheus and Melanie see the same data when online
- The app works fully offline, syncs when reconnected
- `syncStatus` in the header shows: `synced` / `syncing` / `error` / `local`

---

## Known Issues & Next Steps

### Must fix before showing to Melanie
- [ ] **Supabase SQL not run yet** — table doesn't exist, app runs in local-only mode until done
- [ ] **Wealthfront balance is hardcoded** — it's `$12,513.43` in `src/data/portfolio.js` → `CASH_ACCOUNTS`. No live API for Wealthfront exists; update manually when balance changes.
- [x] **WRLD11/USDB11 now fetched from Brapi** — `intl` category switched to BRL (all four holdings are BRL-denominated Brazilian vehicles). ACE-CAP/GENOA are CVM funds with no public quote API: track them like renda fixa (price=1, qty=BRL invested).

### Nice to have next
- [ ] **Transaction history** — right now only tracks current position (shares + avg cost). Adding a `transactions` table in Supabase would let you see individual lots, track buys over time, compute FIFO/LIFO cost basis.
- [x] **Mobile layout** — Holdings rows now collapse to a labeled 3-column card layout below 720px.
- [ ] **Push notifications** — Vercel cron + Supabase edge function to alert when a holding hits a price target.
- [ ] **CSV export** — add a button on Holdings tab to download current positions as CSV.
- [ ] **Melanie's Wealthfront** — the `CASH_ACCOUNTS` array in `portfolio.js` supports multiple accounts. Just add another entry when she connects hers.
- [ ] **Brazilian renda fixa yield tracking** — currently price=1, qty=BRL invested. Could add a `yield` field and compute accrued interest for CDB/Tesouro positions.

---

## Key Files to Edit for Common Tasks

**Add a new holding to the seed data:**
→ `src/data/portfolio.js` → `SEED_HOLDINGS` array

**Add a new bucket (e.g. "Defense"):**
→ `src/data/portfolio.js` → `CATEGORIES` array (set `kind: 'core' | 'theme'` and a `blurb`)  
→ `src/data/portfolio.js` → `DEFAULT_TARGETS` + `DEFAULT_CATEGORY_REGION`  
→ `src/index.css` → a `--cat-*` color var  
→ `src/components/Holdings.jsx` → add the id to the matching `SECTIONS` order  
Nothing to touch in `prices.js` — quotes follow the sticker, not the bucket.

**Add a new country sticker (e.g. India):**
→ `src/data/portfolio.js` → `REGIONS` array (`currency` + `quotes` + `tip`)  
→ `src/index.css` → a `--reg-*` var and a `.region-<id>` badge color pair  
A currency other than USD/BRL also needs an FX rate — `toUSD()` in
`usePortfolio.js` only knows the stored USD/BRL one.

**Add a new crypto with live price:**
→ `src/lib/prices.js` → `GECKO_IDS` object (find the ID at coingecko.com/coins/list)

**Change the refresh interval:**
→ `src/hooks/usePortfolio.js` → `setInterval(..., 60000)` — change `60000` (ms)

**Update Wealthfront balance:**
→ `src/data/portfolio.js` → `CASH_ACCOUNTS[0].value`

**Change the app title / names:**
→ `src/components/Header.jsx` → subtitle text  
→ `index.html` → `<title>` tag

---

## Environment Variables Summary

| Variable | Where to get it | Used in |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API | `src/lib/supabase.js` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API (anon, **not** service_role) | `src/lib/supabase.js` |
| `VITE_FINNHUB_KEY` | finnhub.io/dashboard | `src/lib/prices.js` |
| `VITE_BRAPI_KEY` | brapi.dev | `src/lib/prices.js` |

All prefixed with `VITE_` so Vite exposes them to the browser via `import.meta.env`.  
Add these same 4 vars in the Vercel dashboard before deploying.

⚠️ **`VITE_` means public.** Every one of these is compiled into the JS bundle
that ships to browsers — anyone can read them in devtools. That's expected for
the Supabase anon key (RLS is the actual protection) but it means the price-API
keys can't be kept secret in a client-side app. Values live only in `.env.local`
and in Vercel's environment settings — never in the repo. See `SECURITY.md`.

---

## Conversation Context

This project was built across a multi-session conversation in Claude.ai. The full history includes:
- Initial design decisions (categories, tags, currency handling)
- FinClass portfolio screenshots (BR Stocks, FIIs, Renda Fixa, Alternativos)
- Real crypto positions (BTC/ETH/XRP/BNB/AVAX from exchange screenshot)
- Wealthfront joint savings account ($12,513.43)
- Energy thesis picks (CEG, VRT, BE — Matheus's own picks, not FinClass)
- Decision to use Supabase for shared sync between Matheus and Melanie

If continuing development in a new Claude Code session, this HANDOFF.md plus the source code is everything needed to pick up without re-explaining context.
