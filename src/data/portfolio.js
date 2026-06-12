export const CATEGORIES = [
  { id: 'br_stocks',   name: 'BR Stocks',          label: 'Ações',          color: 'var(--cat-br)',   currency: 'BRL' },
  { id: 'fii',         name: 'FIIs',               label: 'Fundos Imob.',   color: 'var(--cat-fii)',  currency: 'BRL' },
  { id: 'renda_fixa',  name: 'Renda Fixa',         label: 'Caixa',          color: 'var(--cat-rf)',   currency: 'BRL' },
  { id: 'us_stocks',   name: 'US Stocks',          label: 'S&P / Equity',   color: 'var(--cat-us)',   currency: 'USD' },
  { id: 'intl',        name: 'International',      label: 'Global',         color: 'var(--cat-intl)', currency: 'BRL' },
  { id: 'crypto',      name: 'Crypto',             label: 'Digital Assets', color: 'var(--cat-crypto)', currency: 'USD' },
];

// CoinGecko IDs for auto price fetching
export const COINGECKO_IDS = {
  BTC:  'bitcoin',
  ETH:  'ethereum',
  XRP:  'ripple',
  BNB:  'binancecoin',
  AVAX: 'avalanche-2',
};

const uid = () => 'h_' + Math.random().toString(36).slice(2, 9);
const mk = (cat, ticker, name, shares, cost, price, finclass = false, energy = false) =>
  ({ id: uid(), category: cat, ticker, name, shares, cost, price, finclass, energy });

export const SEED_HOLDINGS = [
  // BR Stocks
  mk('br_stocks', 'PRIO3',  'PRIO',         0, 69.24,  69.24,  true),
  mk('br_stocks', 'GMAT3',  'Grupo Mateus', 0, 6.92,   6.92,   true),
  mk('br_stocks', 'WIZC3',  'Wiz Co.',      0, 10.50,  10.50,  true),
  // FIIs
  mk('fii', 'XPML11', 'XP Malls',               0, 115.00, 115.00, true),
  mk('fii', 'CPTS11', 'Capitânia Securities II', 0, 8.90,   8.90,   true),
  mk('fii', 'PSEC11', 'Pátria Securities',       0, 81.00,  81.00,  true),
  mk('fii', 'PVBI11', 'VBI Prime Properties',    0, 110.00, 110.00, true),
  // Renda Fixa (price=1, qty = BRL invested)
  mk('renda_fixa', 'CDB-DAYCOVAL',       'CDB Daycoval / BTG',   0, 1, 1, true),
  mk('renda_fixa', 'JURO11',             'Sparta Infra RF',       0, 1, 1, true),
  mk('renda_fixa', 'TESOURO-IPCA-2050',  'Tesouro IPCA+ 2050',   0, 1, 1, true),
  mk('renda_fixa', 'FIXA11',             'ETF FIXA11 / IDKA11',  0, 1, 1, true),
  // International
  mk('intl', 'WRLD11',    'WRLD11 (VT wrapper)',           0, 1, 1, true),
  mk('intl', 'USDB11',    'USDB11 (BND wrapper)',          0, 1, 1, true),
  mk('intl', 'ACE-CAP',   'ACE Capital (multimercado)',    0, 1, 1, true),
  mk('intl', 'GENOA',     'Genoa Capital Radar',           0, 1, 1, true),
  // US Stocks - energy picks
  mk('us_stocks', 'CEG', 'Constellation Energy', 0, 280, 280, false, true),
  mk('us_stocks', 'VRT', 'Vertiv',               0, 110, 110, false, true),
  mk('us_stocks', 'BE',  'Bloom Energy',         0, 35,  35,  false, true),
  // Crypto - real positions
  mk('crypto', 'BTC',  'Bitcoin',    0.04718,   86845.51, 77477.10),
  mk('crypto', 'ETH',  'Ethereum',   0.58505,   2874.54,  2311.04),
  mk('crypto', 'XRP',  'XRP',        161.44525, 2.00,     1.43),
  mk('crypto', 'BNB',  'BNB Chain',  0.0648,    999.87,   630.52),
  mk('crypto', 'AVAX', 'Avalanche',  3.02711,   34.30,    9.37),
];

export const DEFAULT_TARGETS = {
  br_stocks: 11, fii: 11, renda_fixa: 25, us_stocks: 20, intl: 23, crypto: 10,
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
  CEG:    { title: 'Constellation Energy', text: 'The largest producer of carbon-free (mostly nuclear) electricity in the US. The bet: AI data centers need massive clean power. Part of the Energy thesis.', link: 'https://www.google.com/finance/quote/CEG:NASDAQ' },
  VRT:    { title: 'Vertiv', text: 'Makes the cooling and power equipment that keeps data centers running. A direct "picks and shovels" play on the AI buildout. Part of the Energy thesis.', link: 'https://www.google.com/finance/quote/VRT:NYSE' },
  BE:     { title: 'Bloom Energy', text: 'Builds fuel-cell systems that generate electricity on-site — popular with data centers that can\'t wait for grid connections. Part of the Energy thesis.', link: 'https://www.google.com/finance/quote/BE:NYSE' },
  BTC:    { title: 'Bitcoin', text: 'The first and largest cryptocurrency — digital money with a fixed supply of 21 million coins, often treated as "digital gold".', link: 'https://www.coingecko.com/en/coins/bitcoin' },
  ETH:    { title: 'Ethereum', text: 'The second-largest crypto. Ethereum is a network where apps and financial contracts run without banks; ETH is the coin that powers it.', link: 'https://www.coingecko.com/en/coins/ethereum' },
  XRP:    { title: 'XRP', text: 'A cryptocurrency built for fast, cheap cross-border payments between banks and institutions, created by Ripple.', link: 'https://www.coingecko.com/en/coins/xrp' },
  BNB:    { title: 'BNB', text: 'The coin of the Binance exchange ecosystem — used to pay trading fees at a discount and to run apps on the BNB Chain.', link: 'https://www.coingecko.com/en/coins/bnb' },
  AVAX:   { title: 'Avalanche', text: 'A newer blockchain network competing with Ethereum on speed and cost; AVAX is its native coin.', link: 'https://www.coingecko.com/en/coins/avalanche-2' },
};

export const CASH_ACCOUNTS = [
  { id: 'wealthfront',   label: 'Wealthfront (Joint)',        value: 12513.43, apy: 4.05, note: 'Emergency fund — Melanie & Matheus' },
  { id: 'chase_mat',     label: 'Chase Checking — Matheus',   value: 0, apy: null, note: 'Day-to-day spending' },
  { id: 'chase_mel',     label: 'Chase Checking — Melanie',   value: 0, apy: null, note: 'Day-to-day spending' },
  { id: 'fidelity',      label: 'Fidelity',                   value: 0, apy: null, note: 'Brokerage cash' },
  { id: 'kraken',        label: 'Kraken',                     value: 0, apy: null, note: 'Crypto exchange cash' },
  { id: 'ibkr',          label: 'Interactive Brokers',        value: 0, apy: null, note: 'Brokerage cash' },
];
