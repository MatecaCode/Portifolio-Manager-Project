export const CATEGORIES = [
  { id: 'br_stocks',   name: 'BR Stocks',          label: 'Ações',          color: 'var(--cat-br)',   currency: 'BRL' },
  { id: 'fii',         name: 'FIIs',               label: 'Fundos Imob.',   color: 'var(--cat-fii)',  currency: 'BRL' },
  { id: 'renda_fixa',  name: 'Renda Fixa',         label: 'Caixa',          color: 'var(--cat-rf)',   currency: 'BRL' },
  { id: 'us_stocks',   name: 'US Stocks',          label: 'S&P / Equity',   color: 'var(--cat-us)',   currency: 'USD' },
  { id: 'intl',        name: 'International',      label: 'Global',         color: 'var(--cat-intl)', currency: 'BRL' },
  { id: 'crypto',      name: 'Crypto',             label: 'Digital Assets', color: 'var(--cat-cry)',  currency: 'USD' },
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

export const CASH_ACCOUNTS = [
  { id: 'wealthfront', label: 'Wealthfront (Joint)', value: 12513.43, apy: 4.05, note: 'Emergency fund — Melanie & Matheus' },
];
