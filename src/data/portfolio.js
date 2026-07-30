// ── Where a holding lives (the "sticker") ───────────────────────────────
// Country is a property of the *holding*, not of the bucket it sits in. The
// region carries the two things that used to be baked into the category:
//   currency — what the price is quoted in
//   quotes   — which price API knows this ticker
// Everything except Brazil settles in USD on purpose: the app carries a single
// USD/BRL rate, so a region with its own currency would need its own FX rate
// too. China/Japan/Europe assume the usual route for a US-based investor — a
// US-listed ADR or ETF, which really is priced in dollars.
export const REGIONS = [
  { id: 'us',     code: 'USA',    name: 'United States',  currency: 'USD', quotes: 'us', color: 'var(--reg-us)',
    tip: 'Listed on a US exchange — priced in dollars, quote updates automatically.' },
  { id: 'br',     code: 'BR',     name: 'Brazil',         currency: 'BRL', quotes: 'br', color: 'var(--reg-br)',
    tip: 'Listed on the B3 in São Paulo — priced in reais and converted to dollars at your USD/BRL rate.' },
  { id: 'china',  code: 'CHINA',  name: 'China',          currency: 'USD', quotes: 'us', color: 'var(--reg-china)',
    tip: 'Chinese exposure held the usual way — a US-listed ADR or ETF, so it still prices in dollars.' },
  { id: 'japan',  code: 'JPN',    name: 'Japan',          currency: 'USD', quotes: 'us', color: 'var(--reg-japan)',
    tip: 'Japanese exposure held through a US-listed ADR or ETF, priced in dollars.' },
  { id: 'europe', code: 'EUR',    name: 'Europe',         currency: 'USD', quotes: 'us', color: 'var(--reg-europe)',
    tip: 'European exposure held through a US-listed ADR or ETF, priced in dollars.' },
  { id: 'global', code: 'GLOBAL', name: 'Global / no single country', currency: 'USD', quotes: 'us', color: 'var(--reg-global)',
    tip: 'No single home country — crypto, or a fund spread across the whole world. Priced in dollars.' },
];

export const DEFAULT_REGION = 'us';
export const regionById = id => REGIONS.find(r => r.id === id) || REGIONS.find(r => r.id === DEFAULT_REGION);
export const holdingRegion   = h => regionById(h?.region);
export const holdingCurrency = h => holdingRegion(h).currency;
export const currencySymbol  = ccy => (ccy === 'BRL' ? 'R$' : '$');

// ── What kind of bet it is (the bucket) ─────────────────────────────────
// Buckets are about the *thesis*, never the country — that's the sticker's
// job. `kind: 'theme'` marks the narrow, high-conviction sleeves that used to
// be buried inside one broad "US Stocks" bucket; they each carry their own
// target so they can't quietly grow into the whole portfolio.
export const CATEGORIES = [
  { id: 'crypto',      name: 'Crypto',        label: 'Digital assets',   color: 'var(--cat-crypto)', kind: 'core',
    blurb: 'Coins and tokens — the most volatile sleeve, kept deliberately small.' },
  { id: 'stocks',      name: 'Stocks',        label: 'Company shares',   color: 'var(--cat-stocks)', kind: 'core',
    blurb: 'Individual companies bought for the business itself, wherever they trade.' },
  { id: 'fii',         name: 'FIIs',          label: 'Fundos Imob.',     color: 'var(--cat-fii)',    kind: 'core',
    blurb: 'Brazilian real-estate funds paying monthly rent-like income.' },
  { id: 'renda_fixa',  name: 'Renda Fixa',    label: 'Caixa',            color: 'var(--cat-rf)',     kind: 'core',
    blurb: 'Brazil\'s bonds and CDs — steady interest, the ballast of the portfolio.' },
  { id: 'intl',        name: 'International', label: 'Global',           color: 'var(--cat-intl)',   kind: 'core',
    blurb: 'Broad world funds and multimercado managers — one buy, many countries.' },
  { id: 'energy',      name: 'Energy',        label: 'Power & grid',     color: 'var(--cat-energy)', kind: 'theme',
    blurb: 'The bet that AI needs electricity: generation, grid gear and on-site power.' },
  { id: 'water',       name: 'Water',         label: 'Water & cooling',  color: 'var(--cat-water)',  kind: 'theme',
    blurb: 'The bet that AI needs water: treatment, pumps and data-centre cooling.' },
  { id: 'rare_earths', name: 'Rare Earths',   label: 'Critical minerals', color: 'var(--cat-rare)',  kind: 'theme',
    blurb: 'Magnets, mining and strategic metals — the physical chokepoint of the buildout.' },
];

export const categoryById = id => CATEGORIES.find(c => c.id === id);

// Which sticker a new holding gets by default when you add it to a bucket.
export const DEFAULT_CATEGORY_REGION = {
  crypto: 'global', stocks: 'us', fii: 'br', renda_fixa: 'br', intl: 'br',
  energy: 'us', water: 'us', rare_earths: 'us',
};

// CoinGecko IDs for auto price fetching
export const COINGECKO_IDS = {
  BTC:  'bitcoin',
  ETH:  'ethereum',
  XRP:  'ripple',
  BNB:  'binancecoin',
  AVAX: 'avalanche-2',
};

const uid = () => 'h_' + Math.random().toString(36).slice(2, 9);
const mk = (cat, region, ticker, name, shares, cost, price, finclass = false) =>
  ({ id: uid(), category: cat, region, ticker, name, shares, cost, price, finclass });

export const SEED_HOLDINGS = [
  // Stocks — Brazilian FinClass picks
  mk('stocks', 'br', 'PRIO3',  'PRIO',         0, 69.24,  69.24,  true),
  mk('stocks', 'br', 'GMAT3',  'Grupo Mateus', 0, 6.92,   6.92,   true),
  mk('stocks', 'br', 'WIZC3',  'Wiz Co.',      0, 10.50,  10.50,  true),
  // FIIs
  mk('fii', 'br', 'XPML11', 'XP Malls',                0, 115.00, 115.00, true),
  mk('fii', 'br', 'CPTS11', 'Capitânia Securities II', 0, 8.90,   8.90,   true),
  mk('fii', 'br', 'PSEC11', 'Pátria Securities',       0, 81.00,  81.00,  true),
  mk('fii', 'br', 'PVBI11', 'VBI Prime Properties',    0, 110.00, 110.00, true),
  // Renda Fixa (price=1, qty = BRL invested)
  mk('renda_fixa', 'br', 'CDB-DAYCOVAL',      'CDB Daycoval / BTG',  0, 1, 1, true),
  mk('renda_fixa', 'br', 'JURO11',            'Sparta Infra RF',     0, 1, 1, true),
  mk('renda_fixa', 'br', 'TESOURO-IPCA-2050', 'Tesouro IPCA+ 2050',  0, 1, 1, true),
  mk('renda_fixa', 'br', 'FIXA11',            'ETF FIXA11 / IDKA11', 0, 1, 1, true),
  // International
  mk('intl', 'br', 'WRLD11',  'WRLD11 (VT wrapper)',        0, 1, 1, true),
  mk('intl', 'br', 'USDB11',  'USDB11 (BND wrapper)',       0, 1, 1, true),
  mk('intl', 'br', 'ACE-CAP', 'ACE Capital (multimercado)', 0, 1, 1, true),
  mk('intl', 'br', 'GENOA',   'Genoa Capital Radar',        0, 1, 1, true),
  // Energy — the AI-power thesis
  mk('energy', 'us', 'CEG', 'Constellation Energy', 0, 280, 280),
  mk('energy', 'us', 'VRT', 'Vertiv',               0, 110, 110),
  mk('energy', 'us', 'BE',  'Bloom Energy',         0, 35,  35),
  // Crypto - real positions
  mk('crypto', 'global', 'BTC',  'Bitcoin',    0.04718,   86845.51, 77477.10),
  mk('crypto', 'global', 'ETH',  'Ethereum',   0.58505,   2874.54,  2311.04),
  mk('crypto', 'global', 'XRP',  'XRP',        161.44525, 2.00,     1.43),
  mk('crypto', 'global', 'BNB',  'BNB Chain',  0.0648,    999.87,   630.52),
  mk('crypto', 'global', 'AVAX', 'Avalanche',  3.02711,   34.30,    9.37),
];

// Sums to 100. The old us_stocks 20 is now split across the three sleeves it
// really was: energy 12 / water 5 / rare earths 3.
export const DEFAULT_TARGETS = {
  stocks: 11, fii: 11, renda_fixa: 25, intl: 23, crypto: 10,
  energy: 12, water: 5, rare_earths: 3,
};

// Plain-English explanations shown when clicking a ticker.
// link: where to read more / see the live quote.
export const TICKER_INFO = {
  PRIO3:  { title: 'PRIO (PetroRio)', text: 'Brazil\'s largest independent oil company. It buys mature oil fields from bigger companies and squeezes more production out of them at low cost. A FinClass pick.', link: 'https://www.google.com/finance/quote/PRIO3:BVMF' },
  GMAT3:  { title: 'Grupo Mateus', text: 'A large supermarket and wholesale chain from the Northeast of Brazil, one of the fastest-growing food retailers in the country. A FinClass pick.', link: 'https://www.google.com/finance/quote/GMAT3:BVMF' },
  WIZC3:  { title: 'Wiz Co', text: 'A Brazilian insurance broker — it earns commissions selling insurance through bank branches and partner channels. A FinClass pick.', link: 'https://www.google.com/finance/quote/WIZC3:BVMF' },
  XPML11: { title: 'XP Malls', text: 'A real estate fund (FII) that owns stakes in premium shopping malls across Brazil. You earn monthly rent income from the mall tenants.', link: 'https://www.google.com/finance/quote/XPML11:BVMF' },
  CPTS11: { title: 'Capitânia Securities II', text: 'A real estate fund (FII) that invests mostly in real-estate debt papers (CRIs) — it earns interest instead of rent. Pays monthly income.', link: 'https://www.google.com/finance/quote/CPTS11:BVMF' },
  PSEC11: { title: 'Pátria Securities', text: 'A real estate fund (FII) from asset manager Pátria that invests in real-estate debt (CRIs), paying monthly interest income.', link: 'https://www.google.com/finance/quote/PSEC11:BVMF' },
  PVBI11: { title: 'VBI Prime Properties', text: 'A real estate fund (FII) that owns high-end office buildings in São Paulo\'s best districts and collects rent from corporate tenants.', link: 'https://www.google.com/finance/quote/PVBI11:BVMF' },
  'CDB-DAYCOVAL': { title: 'CDB Daycoval / BTG 104% CDI', text: 'A bank deposit certificate — you lend money to the bank and earn 104% of Brazil\'s base interest rate (CDI). Very low risk, protected by FGC insurance up to R$250k.', link: null },
  JURO11: { title: 'Sparta Infra (JURO11)', text: 'A fund that holds Brazilian infrastructure bonds (debêntures incentivadas). The interest is tax-free for individuals. Quantity here = amount in reais invested.', link: 'https://www.google.com/finance/quote/JURO11:BVMF' },
  'TESOURO-IPCA-2050': { title: 'Tesouro IPCA+ 2050', text: 'A Brazilian government bond that pays inflation (IPCA) plus a fixed rate until 2050. The safest investment in Brazil — backed by the National Treasury.', link: 'https://www.tesourodireto.com.br' },
  FIXA11: { title: 'ETF FIXA11 / IDKA11', text: 'An exchange-traded fund that tracks a basket of Brazilian fixed-income (interest rate) bonds. A simple way to own renda fixa through the stock exchange.', link: 'https://www.google.com/finance/quote/FIXA11:BVMF' },
  WRLD11: { title: 'WRLD11 (world stocks wrapper)', text: 'A Brazilian ETF that wraps Vanguard\'s VT fund — one purchase gives you a slice of thousands of companies across the whole world. Trades in reais on B3.', link: 'https://www.google.com/finance/quote/WRLD11:BVMF' },
  USDB11: { title: 'USDB11 (US bonds wrapper)', text: 'A Brazilian ETF that wraps Vanguard\'s BND fund — a broad basket of US bonds. A defensive, dollar-linked investment that trades in reais on B3.', link: 'https://www.google.com/finance/quote/USDB11:BVMF' },
  'ACE-CAP': { title: 'ACE Capital', text: 'A Brazilian multimercado (hedge) fund — professional managers trade rates, currencies and stocks aiming to beat the CDI. No live price feed; quantity = reais invested.', link: null },
  GENOA:  { title: 'Genoa Capital Radar', text: 'A Brazilian multimercado (hedge) fund from Genoa Capital. Like ACE, it has no public live price — quantity = reais invested, updated by hand.', link: null },
  CEG:    { title: 'Constellation Energy', text: 'The largest producer of carbon-free (mostly nuclear) electricity in the US. The bet: AI data centers need massive clean power.', link: 'https://www.google.com/finance/quote/CEG:NASDAQ' },
  VRT:    { title: 'Vertiv', text: 'Makes the cooling and power equipment that keeps data centers running. A direct "picks and shovels" play on the AI buildout.', link: 'https://www.google.com/finance/quote/VRT:NYSE' },
  BE:     { title: 'Bloom Energy', text: 'Builds fuel-cell systems that generate electricity on-site — popular with data centers that can\'t wait for grid connections.', link: 'https://www.google.com/finance/quote/BE:NYSE' },
  BTC:    { title: 'Bitcoin', text: 'The first and largest cryptocurrency — digital money with a fixed supply of 21 million coins, often treated as "digital gold".', link: 'https://www.coingecko.com/en/coins/bitcoin' },
  ETH:    { title: 'Ethereum', text: 'The second-largest crypto. Ethereum is a network where apps and financial contracts run without banks; ETH is the coin that powers it.', link: 'https://www.coingecko.com/en/coins/ethereum' },
  XRP:    { title: 'XRP', text: 'A cryptocurrency built for fast, cheap cross-border payments between banks and institutions, created by Ripple.', link: 'https://www.coingecko.com/en/coins/xrp' },
  BNB:    { title: 'BNB', text: 'The coin of the Binance exchange ecosystem — used to pay trading fees at a discount and to run apps on the BNB Chain.', link: 'https://www.coingecko.com/en/coins/bnb' },
  AVAX:   { title: 'Avalanche', text: 'A newer blockchain network competing with Ethereum on speed and cost; AVAX is its native coin.', link: 'https://www.coingecko.com/en/coins/avalanche-2' },
};

// ── Investments for Review ──────────────────────────────────────────────
// A staging list of candidate investments that Matheus & Melanie review and
// approve before they ever touch the real portfolio. Each carries a suggested
// bucket, a country sticker, a recommended weight *within* that bucket, and a
// plain-English thesis. Approving one drops it into Holdings as a 0-share
// watchlist entry (prices then populate live); rejecting one removes it.
const rvid = () => 'r_' + Math.random().toString(36).slice(2, 9);
const mkr = (ticker, name, category, region, theme, groupPct, thesis, link = null) =>
  ({ id: rvid(), ticker, name, category, region, theme, groupPct, thesis, link, source: 'Claude research' });

export const SEED_REVIEWS = [
  mkr('XYL', 'Xylem', 'water', 'us', 'Water', 10,
    'Water pumps, filtration and treatment tech. Direct AI-data-center exposure — expanded a build/operate water-systems partnership with Dow in 2026. Recurring revenue, not one-time equipment.',
    'https://www.google.com/finance/quote/XYL:NYSE'),
  mkr('ECL', 'Ecolab', 'water', 'us', 'Water', 8,
    'Runs a "cooling-as-a-service" program for high-density AI facilities, blending water + cooling management. Sticky, recurring chemistry-and-service revenue.',
    'https://www.google.com/finance/quote/ECL:NYSE'),
  mkr('PHO', 'Invesco Water Resources ETF', 'water', 'us', 'Water', 12,
    'A basket of water-infrastructure companies in one buy — the lower-risk way to own the "AI needs water" theme without picking a single winner.',
    'https://www.google.com/finance/quote/PHO:NYSEARCA'),
  mkr('MP', 'MP Materials', 'rare_earths', 'us', 'Rare earths', 12,
    'The only active US rare-earth mine AND a magnet plant — owns processing, the real moat. Has a US Dept. of War price floor on NdPr plus an Apple offtake deal, which neutralizes China\'s price-war risk. The de-risked pick.',
    'https://www.google.com/finance/quote/MP:NYSE'),
  mkr('REMX', 'VanEck Rare Earth/Strategic Metals ETF', 'rare_earths', 'us', 'Rare earths', 10,
    'Diversified rare-earth & strategic-metals basket. Spreads the single-company risk of a volatile, geopolitics-driven sector (note: holds some Chinese names).',
    'https://www.google.com/finance/quote/REMX:NYSEARCA'),
];

// `bucket` decides which side of the picture an account lands on:
//   'savings' — money with a job (the emergency fund). Shown alongside the
//               investments and in the allocation ring as its own slice, but it
//               never gets a rebalance target — it isn't part of the mix.
//   'cash'    — genuinely liquid: what's sitting in checking and broker cash.
export const CASH_ACCOUNTS = [
  { id: 'wealthfront',   label: 'Wealthfront (Joint)',        value: 12513.43, apy: 4.05, note: 'Emergency fund — Melanie & Matheus', bucket: 'savings' },
  { id: 'chase_mat',     label: 'Chase Checking — Matheus',   value: 0, apy: null, note: 'Day-to-day spending', bucket: 'cash' },
  { id: 'chase_mel',     label: 'Chase Checking — Melanie',   value: 0, apy: null, note: 'Day-to-day spending', bucket: 'cash' },
  { id: 'fidelity',      label: 'Fidelity',                   value: 0, apy: null, note: 'Brokerage cash', bucket: 'cash' },
  { id: 'kraken',        label: 'Kraken',                     value: 0, apy: null, note: 'Crypto exchange cash', bucket: 'cash' },
  { id: 'ibkr',          label: 'Interactive Brokers',        value: 0, apy: null, note: 'Brokerage cash', bucket: 'cash' },
];

// Accounts saved before `bucket` existed have none, so infer it from the name
// rather than silently dumping the emergency fund into spending money.
export const SAVINGS_COLOR = 'var(--cat-savings)';
export const bucketOf = acc =>
  acc?.bucket === 'savings' || acc?.bucket === 'cash'
    ? acc.bucket
    : (/wealthfront|emergency|savings|reserve/i.test(`${acc?.label || ''} ${acc?.note || ''}`) ? 'savings' : 'cash');
