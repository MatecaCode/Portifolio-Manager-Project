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
Create this file at the project root (never commit it):
```env
VITE_SUPABASE_URL=https://zyfmuddelxryvoxnqpxl.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_paTKkcM87OiifxVV9aDEkw_y9gU1d8M
VITE_FINNHUB_KEY=d7qc6cpr01qi8jamteigd7qc6cpr01qi8jamtej0
VITE_BRAPI_KEY=aPfC5vimk9AT91jszEnq1E
```

### 3. Run Supabase setup SQL
1. Go to https://supabase.com → Portfolio Manager Project (`zyfmuddelxryvoxnqpxl`)
2. Open **SQL Editor → New query**
3. Paste and run the entire contents of `supabase_setup.sql`

This creates the `portfolio_state` table with RLS enabled and seeds the single shared row.

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
    portfolio.js           # CATEGORIES, SEED_HOLDINGS, DEFAULT_TARGETS, CASH_ACCOUNTS
                           # Edit here to add/remove holdings or categories

  hooks/
    usePortfolio.js        # THE main hook — all state, Supabase sync, price refresh, CRUD

  lib/
    supabase.js            # Supabase client (returns null if env vars missing — safe)
    prices.js              # fetchAllPrices() — calls CoinGecko + Brapi + Finnhub in parallel

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
targets     jsonb             -- { br_stocks: 11, fii: 11, renda_fixa: 25, us_stocks: 20, intl: 23, crypto: 10 }
fx_rate     numeric           -- USD/BRL rate, e.g. 5.70
updated_at  timestamptz
```

### Holding object shape
```js
{
  id:        string,   // 'h_abc123' — random uid
  category:  string,   // 'br_stocks' | 'fii' | 'renda_fixa' | 'us_stocks' | 'intl' | 'crypto'
  ticker:    string,   // 'BTC', 'PRIO3', 'CEG', etc.
  name:      string,   // Display name
  shares:    number,   // Quantity held (or BRL invested for renda_fixa)
  cost:      number,   // Average cost per unit in local currency
  price:     number,   // Current price per unit in local currency (auto-updated by price service)
  finclass:  boolean,  // Tagged as FinClass recommendation
  energy:    boolean,  // Tagged as Energy thesis pick
}
```

### Categories and currencies
| id | name | currency | Price source |
|---|---|---|---|
| `br_stocks` | BR Stocks | BRL | Brapi |
| `fii` | FIIs | BRL | Brapi |
| `renda_fixa` | Renda Fixa | BRL | Manual (price=1, qty=BRL invested) |
| `us_stocks` | US Stocks | USD | Finnhub |
| `intl` | International | BRL | Brapi for WRLD11/USDB11 (B3-listed ETFs); ACE-CAP/GENOA manual (price=1, qty=BRL invested) |
| `crypto` | Crypto | USD | CoinGecko |

All values are converted to USD for the overview total using the stored `fx_rate`.

---

## Price Service (`src/lib/prices.js`)

`fetchAllPrices(holdings)` runs three fetches in parallel:

| Source | Assets | Auth | Rate limit |
|---|---|---|---|
| CoinGecko | BTC, ETH, XRP, BNB, AVAX, SOL | None (free) | ~30 req/min |
| Brapi | All BR tickers (PRIO3, XPML11, etc.) | `VITE_BRAPI_KEY` | Free tier |
| Finnhub | US stocks (CEG, VRT, BE) | `VITE_FINNHUB_KEY` | 60 req/min free |

**To add a new crypto:** Add its CoinGecko ID to `GECKO_IDS` in `prices.js`.  
**To add a new US stock:** Just add it to the `us_stocks` category — Finnhub handles any US ticker.  
**To add a new BR stock/FII:** Just add it to `br_stocks` or `fii` — Brapi handles any B3 ticker.

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

**Add a new category (e.g. "Real Estate US"):**
→ `src/data/portfolio.js` → `CATEGORIES` array  
→ `src/data/portfolio.js` → `DEFAULT_TARGETS` object  
→ `src/lib/prices.js` → add category ID to the relevant `_CATS` array

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

| Variable | Value | Used in |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://zyfmuddelxryvoxnqpxl.supabase.co` | `src/lib/supabase.js` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_paTKkcM87OiifxVV9aDEkw_y9gU1d8M` | `src/lib/supabase.js` |
| `VITE_FINNHUB_KEY` | `d7qc6cpr01qi8jamteigd7qc6cpr01qi8jamtej0` | `src/lib/prices.js` |
| `VITE_BRAPI_KEY` | `aPfC5vimk9AT91jszEnq1E` | `src/lib/prices.js` |

All prefixed with `VITE_` so Vite exposes them to the browser via `import.meta.env`.  
Add these same 4 vars in Vercel dashboard before deploying.

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
