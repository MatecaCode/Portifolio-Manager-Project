# Handoff: SunnyHeron — Portfolio App Rebrand

## Overview

A full visual + UX rebrand of the couple's portfolio tracker (currently at portifolio-manager-project.vercel.app). The goals of the rebrand, in priority order:

1. **Not intimidating** — light, clean, modern; explicitly *not* "the matrix" / tech-bro dark dashboards.
2. **Educational, but never condescending** — every financial term explains itself in plain English via hover tooltips. There is intentionally **no** separate "Learn" section and **no** inline lecture cards: the primary user dislikes feeling like she doesn't know something, so all education is private and on-demand.
3. **Exciting** — goal progress front and center, a Growth tab with historical chart + projections, celebration moments (all-time-high chips, record badges), and a "monthly money story" recap.

## About the Design Files

The files in this bundle are **design references created in HTML/React (Babel, no build step)** — prototypes showing intended look and behavior, **not production code to copy directly**. The task is to **recreate these designs in the existing app codebase** (the Next.js/React app deployed on Vercel) using its established patterns, routing, and data layer. Component structure in the prototype is a suggestion, not a contract.

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, copy and interactions are final design intent. Recreate pixel-perfectly using the codebase's existing stack. The data shown is the couple's real portfolio snapshot (June 2026) except where noted under "Sample data".

## Brand

- **Name:** SunnyHeron (user-selected; alternates explored: Seaglass, Portfolio, Nest)
- **Logo mark:** 42×42 rounded square (`border-radius: 0.75 × global radius`), `linear-gradient(145deg, #3E9B8F, #2A7A70)`. Inside: a 12px circle "sun" (`#FFD9A0`) top-right, and a white "wing" shape bottom-left (24×13px, `border-radius: 999px 999px 4px 999px`, `rgba(255,255,255,0.92)`).
- **Subtitle under wordmark:** "Matheus & Melanie" (12.5px, muted color)
- **Tone of voice:** warm, encouraging, plain English. Sparse tasteful emoji (☀️ 🎉 🦩 💪 ✨ 🌱). Never jargon without a tooltip. Negative numbers are framed calmly ("red days are normal"), never alarmingly.

## Design Tokens

### Colors ("Sea Glass" palette)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F3F9F8` | Page background |
| `--surface` | `#FFFFFF` | Cards |
| `--line` | `#DFEEEB` | Borders, dividers |
| `--ink` | `#1F3A38` | Primary text, tooltip background |
| `--muted` | `#6E918C` | Secondary text, labels |
| `--accent` | `#3E9B8F` | Primary teal — active tab, chart line, progress fills |
| `--accent-deep` | `#2A7A70` | Darker teal — chip text, emphasis |
| `--accent-soft` | `#E0F2EE` | Chip backgrounds, progress track |
| `--accent-faint` | `#EFF7F5` | Tinted panels, hover fills |
| `--up` | `#3E9B8F` | Positive numbers (teal, NOT classic green) |
| `--down` | `#E07856` | Negative numbers (soft coral, NOT alarm red) |
| `--warn-bg` / `--warn-ink` | `#FBF1DC` / `#9A7224` | "Coming soon" / target-sum warnings |

Derived tints in the prototype use `color-mix(in oklch, var(--accent) N%, white|black)` — if the codebase can't use color-mix, hardcode the soft/deep/faint values above.

### Category colors

| Category | Token | Value |
|---|---|---|
| Crypto | `--cat-crypto` | `#F0937A` |
| BR Stocks | `--cat-br` | `#3E9B8F` |
| FIIs | `--cat-fii` | `#9C8EC9` |
| Renda Fixa | `--cat-rf` | `#8FAE9B` |
| US Stocks | `--cat-us` | `#6FA8C9` |
| International | `--cat-intl` | `#E5B45E` |

Category dots are 9–11px squares with `border-radius: 4px` (not circles).

### Typography

- **UI font:** "Albert Sans" (Google Fonts), weights 400/500/600/700. (Tweak alternates: Outfit, Sora.)
- **Numbers:** "JetBrains Mono", weights 400/500/600 — ALL monetary values, percentages, axis labels use mono.
- Base size 15px / line-height 1.5. Net-worth hero number: mono 44px/600, letter-spacing -0.03em. Section labels: 12px/600, uppercase, letter-spacing 0.09em, muted. Stat values: mono 20–21px/600.

### Spacing & shape

- Page: max-width 1180px, centered, 24px top / 32px side padding.
- Global radius token: **18px** for cards (user-tweakable 6–28px); chips/pills/tabs fully rounded (999px); nested elements use `calc(radius * 0.7)`.
- Card: `--surface` bg, 1px `--line` border, padding 26×28px, shadow `0 1px 2px rgba(31,58,56,0.04), 0 4px 16px rgba(31,58,56,0.05)`.
- Screen sections stack with 20px gap.

## Global Components

### Top bar
Logo + wordmark (21px/700) left; right side: two pills — "☁ Synced" (soft chip) and "⚡ Prices live · 10:56 AM" (up chip).

### Tab navigation (pill style — replaces underline tabs)
A floating pill container (`--surface` bg, `--line` border, radius 999px, padding 5px, card shadow) holding buttons: **Overview · Growth · Holdings · Rebalance · Import**. Active tab: `--accent` bg, white text, 600 weight, soft teal glow shadow. Inactive: muted text; hover = ink text on `--accent-faint`. Note: "Learn" was deliberately removed.

### Plain-English tooltip (`Term`) — THE core UX pattern
- Trigger: any term wrapped gets `border-bottom: 1.5px dotted` (accent at 55% opacity) + `cursor: help`; focusable (`tabIndex=0`).
- Bubble: 235px wide, `--ink` bg, near-white text `#F2FAF8`, 12.5px/1.45, padding 10×13px, radius 12px, centered above with 6px arrow, fade+rise 0.15s on hover/focus.
- Copy rules: 1–2 sentences, zero jargon, friendly. Examples used: Net worth → "Everything you own minus everything you owe. Here it's your investments plus your cash." · P/L → "...Red days are normal; the long game is what counts." · FIIs → "Fundos Imobiliários — Brazilian real-estate funds that pay monthly rent-like income."
- Apply to ALL financial terms: Net worth, Invested, Cash, P/L, Allocation, APY, Qty, Avg cost, Current, Diff, FIIs, Renda Fixa, 7%/yr, compound interest, tag badges.

### Chips
Pill, 12px/600, padding 4×11px. Tones: soft (teal tint), up (teal tint), warn (amber tint).

### Tag badges
`FC` (lavender `#EEE9F8`/`#6B57A8`) and `EN` (amber `#FBF1DC`/`#9A7224`), 10px/700, radius 6px, with tooltips ("A FinClass pick — recommended in the course we follow" / "Part of our energy thesis — companies powering the world").

### Progress bar
Track `--accent-soft`, rounded; fill `--accent` (or `--down` when overweight); optional 3px ink target marker overhanging the track (rebalance cards).

### Celebration elements (gated by a "Celebrations" toggle, default ON)
- Hero chip: "🎉 All-time high net worth!" — gradient `linear-gradient(100deg, #FFF0DB, #FFE3CE)`, text `#B05E2E`, 12.5px/700, springy pop-in animation (scale 0.7→1, cubic-bezier(0.34,1.56,0.64,1), 0.5s), respect `prefers-reduced-motion`.
- Growth chart "🏆 Record high" chip when latest value is the max.

## Screens

### 1. Overview

**Hero card** (2-col grid 1.3fr/1fr, right column separated by 1px left border):
- Left: greeting "Good morning, you two ☀️" (14px muted) → celebration chip → "Net worth" label (tooltip) → **$16,684.43** (mono 44px) → goal block: "First $20k together" + "83% there" (13px/700 accent-deep), 10px progress bar, note "$3,315 to go — every deposit moves this bar 💪".
- Right column stats: Invested **$4,171.00** · Cash **$12,513.43** "across 6 accounts" · Profit/Loss **-$2,099.63 / -33.5%** in `--down` coral.

**Allocation + By category** (2-col 1fr/1.15fr):
- Allocation card: donut 190px (conic-gradient of owned categories; hole 62% with mono total "$4,171" + "invested"); right side: category color legend + one friendly line: "All eggs in one basket for now — the **Rebalance** tab has the plan to spread new money around. Every color here is a future win. 🦩"
- By category card: rows (dot, name + "N owned · N on the list" sub, right-aligned value + P/L). Zero-value categories show italic "ready to start" instead of $0.00 — important tone choice.

**Accounts**: section label "ACCOUNTS · $12,513.43 CASH" with right-side tools (USD/BRL 5.7 pill, "+ Add account" soft button). 3-col grid of cards: name, note, mono value; Wealthfront shows "4.05% APY" chip with tooltip. Accounts: Wealthfront (Joint) $12,513.43 / Chase Checking — M / Chase Checking — L / Fidelity / Kraken / Interactive Brokers (all $0).

### 2. Growth (new tab)

- **Chart card**: "Your money story · last 12 months" + chips (🏆 Record high; ▲ $412 this month). SVG area chart: solid 3px accent line = net worth (with soft vertical gradient fill, 22%→2% opacity), dashed 2px muted line = "what you put in" (cumulative deposits), end dot accent w/ white stroke, dashed horizontal gridlines, mono month labels. Legend below with tooltips.
- **Monthly recap card** "Your money story · Jun 2026": 3-col grid of emoji + sentence cells — net worth change (+record callout), what drove it, best month of the year.
- **3 recap stat cards** (centered): 📈 +$4,784 growth in 12 months · 🫶 $1,070 from own deposits "the part you control" · 🌊 +$3,714 from markets & interest.
- **Projection card** "If you keep going… ✨": slider $50–$2,000/mo (default $300, accent-colored), assumes 7%/yr (tooltip: "...Not a promise — just a planning number"); 4 tinted cells: in 1/3/5/10 years (compound monthly: `v = v*(1+0.07/12) + monthly`). Footer line links "compound interest" tooltip.

### 3. Holdings

- Toolbar: legend (FC badge, EN badge, LIVE chip, "hover anything dotted to learn") + "✎ Edit holdings" soft button.
- One card per category in order: Crypto, BR Stocks, FIIs, Renda Fixa, US Stocks, International. Header: dot, name (16px/700), currency "(BRL)"/"(USD)", "N owned / N" chip, right-aligned mono group total + P/L.
- Table grid columns: `1fr 90px 110px 110px 120px 110px` → Ticker/name · Qty · Avg cost · Current · Value · P/L %. Headers uppercase 11px with tooltips on Qty/Avg cost/Current.
- Ticker pills: mono 12.5px/600 on `--accent-soft`/`--accent-deep`, hover inverts to accent bg + white (affordance for a future "learn about this ticker" click).
- Unowned rows: Qty/Value show "—", P/L column shows italic "on the list".

### 4. Rebalance

- Intro row: explanation ("The filled bar is where you **are**; the little line is where you **want to be**.") + "Why rebalance?" tooltip + "✓ Targets: 100.0%" chip (warn tone if ≠100).
- **Summary card**: stacked horizontal bar of current allocation (16px, rounded) + legend; "What to do about it" advice list — dot + sentence per category, amounts in mono ("**Add about $1,043 to Renda Fixa** — 0% of the portfolio, target is 25%."; Crypto: trim $3,754 framing with "or simply direct new money..."). Footer: "Gentle tip: ...rebalancing with **new deposits** usually beats selling — no taxes, no fees, no stress. 🌱"
- **Per-category cards** (3-col): header dot + name + Target number input (%); progress bar (actual) with ink target marker, fill turns `--down` when actual > target; 0%/100% mono axis; 4 stats: Actual / Diff (tooltip; +pp red, −pp teal) / Value / Buy-or-Trim. Targets editable; sum chip updates live.
- Data: targets — BR 11, FIIs 11, Renda Fixa 25, US 20, Intl 23, Crypto 10. Buys: $459/$459/$1,043/$834/$959; Crypto trim $3,754, actual 100%.

### 5. Import

- Hero: "Import from a file" (26px/700) + reassurance line "...we'll show you exactly what would change before anything is saved. No surprises." + warn chip "COMING SOON — UNDER CONSTRUCTION".
- 4-col grid of source cards (emoji icon, name, note): Wealthfront, Chase Bank, Chase Card, Kraken, Fidelity, Interactive Brokers, B3 / Brazilian broker, Other. Hover: lift -2px + deeper shadow.
- Dropzone: 2px dashed accent (40% opacity), `--accent-faint` bg, centered "Drop a file here" + sub-line.

## Interactions & Behavior

- Tab switching: instant; persist last tab (prototype uses localStorage key `sg_tab`).
- Tooltips: hover + keyboard focus; 0.15s fade/rise.
- Cards (lessons/import): hover lift `translateY(-2px)` + shadow, 0.18s ease.
- Projection slider: live recompute of the 4 cells.
- Rebalance target inputs: live recompute of diff and targets-sum chip.
- Progress fills animate width 0.5s ease.
- Celebration pop-in: spring scale, gated by `prefers-reduced-motion`.
- Responsive (≤980px): hero/two-col → 1 col; 3-col/account/rebalance grids → 2 col; recap story → 1 col.

## State Management

- `activeTab` (persisted)
- `rebalanceTargets: { [categoryId]: number }` — should persist to the backend like current build
- `projectionMonthly: number` (ephemeral)
- Celebration conditions derived from history: `isRecord = latestNetWorth >= max(history)`; month change = last − previous
- Settings (if Tweaks-style theming kept): appName, accent, radius, font, cozy, celebrations

## Sample data (NOT real — replace with live data)

- The 12-month `history` series in `rebrand/data.js` is invented to demo the Growth tab shape (real history doesn't exist until imports ship).
- Crypto holdings (BTC/ETH/SOL/LINK/DOT quantities/prices) are plausible placeholders matching the real aggregates ($4,171 value, −$2,099.63 P/L); the real positions live in the production app.
- Renda Fixa / US / International ticker lists are invented examples of "on the list" items.
- Goal "First $20k together" / $20,000 is a design proposal — make it user-editable.

## Assets

No image assets. Logo is pure CSS (gradient square + 2 shapes). Fonts from Google Fonts (Albert Sans, JetBrains Mono — plus Outfit/Sora only if the font toggle is kept). Icons are emoji by design choice (friendly, zero icon-library weight); replace only if the codebase already has an icon system that fits the tone.

## Files in this bundle

- `Portfolio Rebrand.html` — entry point; contains the full stylesheet (the design-token source of truth)
- `rebrand/data.js` — data shape the UI consumes (good reference for the API contract)
- `rebrand/ui.jsx` — shared primitives: Term (tooltip), Card, SectionLabel, Chip, CatDot, TagBadge, ProgressBar, Donut, AreaChart
- `rebrand/overview.jsx`, `rebrand/growth.jsx`, `rebrand/holdings.jsx`, `rebrand/rebalance.jsx` — screens
- `rebrand/extras.jsx` — Import screen (also contains an unused Learn screen — intentionally cut from nav, ignore it)
- `rebrand/app.jsx` — shell, tabs, theming
- `rebrand/tweaks-panel.jsx` — prototype-only tweak panel scaffolding; **do not port** (the theming values it controls are listed under Design Tokens)

Open `Portfolio Rebrand.html` in a browser (needs network for fonts/CDN React) to see everything live.
