// Portfolio data — pulled from the current build (June 2026)
window.PF_DATA = {
  couple: "Matheus & Melanie",
  usdbrl: 5.7,
  netWorth: 16684.43,
  investments: 4171.00,
  totalPL: -2099.63,
  totalPLPct: -33.5,
  cash: 12513.43,
  cashAccounts: 6,
  holdingsOwned: 5,
  holdingsListed: 23,
  goal: { label: "First $20k together", target: 20000 },

  categories: [
    { id: "crypto",  name: "Crypto",        ccy: "USD", value: 4171.00, pl: -2099.63, plPct: -33.5, owned: 5, listed: 5, target: 10, actual: 100.0 },
    { id: "rf",      name: "Renda Fixa",    ccy: "BRL", value: 0, pl: 0, plPct: 0, owned: 0, listed: 4, target: 25, actual: 0 },
    { id: "intl",    name: "International", ccy: "USD", value: 0, pl: 0, plPct: 0, owned: 0, listed: 4, target: 23, actual: 0 },
    { id: "us",      name: "US Stocks",     ccy: "USD", value: 0, pl: 0, plPct: 0, owned: 0, listed: 3, target: 20, actual: 0 },
    { id: "br",      name: "BR Stocks",     ccy: "BRL", value: 0, pl: 0, plPct: 0, owned: 0, listed: 3, target: 11, actual: 0 },
    { id: "fii",     name: "FIIs",          ccy: "BRL", value: 0, pl: 0, plPct: 0, owned: 0, listed: 4, target: 11, actual: 0 }
  ],

  rebalance: [
    { id: "crypto", action: "trim", amount: 3754, why: "100.0% of the portfolio vs a 10% target. Either trim, or simply direct new money to the other categories until it evens out." },
    { id: "rf",     action: "add",  amount: 1043, why: "0% of the portfolio, target is 25%." },
    { id: "intl",   action: "add",  amount: 959,  why: "0% of the portfolio, target is 23%." },
    { id: "us",     action: "add",  amount: 834,  why: "0% of the portfolio, target is 20%." },
    { id: "br",     action: "add",  amount: 459,  why: "0% of the portfolio, target is 11%." },
    { id: "fii",    action: "add",  amount: 459,  why: "0% of the portfolio, target is 11%." }
  ],

  holdings: {
    crypto: [
      { ticker: "BTC",  name: "Bitcoin",  qty: 0.0312, avg: 67100, cur: 44800, tags: [] },
      { ticker: "ETH",  name: "Ethereum", qty: 0.41,   avg: 3420,  cur: 2310,  tags: [] },
      { ticker: "SOL",  name: "Solana",   qty: 4.2,    avg: 148,   cur: 96,    tags: [] },
      { ticker: "LINK", name: "Chainlink",qty: 18,     avg: 16.4,  cur: 11.2,  tags: ["EN"] },
      { ticker: "DOT",  name: "Polkadot", qty: 22,     avg: 7.1,   cur: 4.4,   tags: [] }
    ],
    br: [
      { ticker: "PRIO3", name: "PRIO",         qty: 0, avg: 69.24, cur: 69.24, tags: ["FC"] },
      { ticker: "GMAT3", name: "Grupo Mateus", qty: 0, avg: 6.92,  cur: 6.92,  tags: ["FC"] },
      { ticker: "WIZC3", name: "Wiz Co.",      qty: 0, avg: 10.50, cur: 10.50, tags: ["FC"] }
    ],
    fii: [
      { ticker: "XPML11", name: "XP Malls",        qty: 0, avg: 115,   cur: 115,   tags: ["FC"] },
      { ticker: "HGLG11", name: "CSHG Logística",  qty: 0, avg: 158,   cur: 158,   tags: ["FC"] },
      { ticker: "KNRI11", name: "Kinea Renda",     qty: 0, avg: 142,   cur: 142,   tags: ["FC"] },
      { ticker: "MXRF11", name: "Maxi Renda",      qty: 0, avg: 10.2,  cur: 10.2,  tags: ["FC"] }
    ],
    us: [
      { ticker: "VOO",  name: "Vanguard S&P 500", qty: 0, avg: 512,  cur: 512,  tags: ["FC"] },
      { ticker: "SCHD", name: "Schwab Dividend",  qty: 0, avg: 27.8, cur: 27.8, tags: ["FC"] },
      { ticker: "XLE",  name: "Energy Select",    qty: 0, avg: 92.4, cur: 92.4, tags: ["EN"] }
    ],
    rf: [
      { ticker: "TSELIC29", name: "Tesouro Selic 2029", qty: 0, avg: 100, cur: 100, tags: [] },
      { ticker: "TIPCA35",  name: "Tesouro IPCA+ 2035", qty: 0, avg: 100, cur: 100, tags: ["FC"] },
      { ticker: "CDB-110",  name: "CDB 110% CDI",       qty: 0, avg: 100, cur: 100, tags: [] },
      { ticker: "LCI-95",   name: "LCI 95% CDI",        qty: 0, avg: 100, cur: 100, tags: [] }
    ],
    intl: [
      { ticker: "VXUS", name: "Total Intl Stock",  qty: 0, avg: 64.2, cur: 64.2, tags: ["FC"] },
      { ticker: "VEA",  name: "Developed Markets", qty: 0, avg: 51.9, cur: 51.9, tags: ["FC"] },
      { ticker: "VWO",  name: "Emerging Markets",  qty: 0, avg: 45.3, cur: 45.3, tags: [] },
      { ticker: "ENB",  name: "Enbridge",          qty: 0, avg: 38.7, cur: 38.7, tags: ["EN"] }
    ]
  },

  accounts: [
    { name: "Wealthfront (Joint)", note: "Emergency fund — Mela", value: 12513.43, apy: "4.05% APY" },
    { name: "Chase Checking — M",  note: "Day-to-day spending",   value: 0 },
    { name: "Chase Checking — L",  note: "Day-to-day spending",   value: 0 },
    { name: "Fidelity",            note: "Brokerage cash",        value: 0 },
    { name: "Kraken",              note: "Crypto exchange cash",  value: 0 },
    { name: "Interactive Brokers", note: "Brokerage cash",        value: 0 }
  ],

  // Net worth history (sample shape until real imports exist)
  history: [
    { m: "Jul 25", invested: 5200,  total: 11900 },
    { m: "Aug 25", invested: 5500,  total: 12300 },
    { m: "Sep 25", invested: 5800,  total: 12650 },
    { m: "Oct 25", invested: 6000,  total: 13400 },
    { m: "Nov 25", invested: 6100,  total: 13900 },
    { m: "Dec 25", invested: 6270,  total: 14800 },
    { m: "Jan 26", invested: 6270,  total: 15300 },
    { m: "Feb 26", invested: 6270,  total: 14600 },
    { m: "Mar 26", invested: 6270,  total: 15400 },
    { m: "Apr 26", invested: 6270,  total: 16100 },
    { m: "May 26", invested: 6270,  total: 16272 },
    { m: "Jun 26", invested: 6270,  total: 16684 }
  ],

  lessons: [
    { icon: "🌱", title: "Why invest at all?", mins: 3, blurb: "Cash slowly loses buying power. Investing puts your money to work so it grows faster than prices do." },
    { icon: "🧺", title: "Don't put all eggs in one basket", mins: 4, blurb: "Spreading money across stocks, bonds and countries means one bad day can't ruin everything. That's diversification." },
    { icon: "📉", title: "Red days are normal", mins: 3, blurb: "Markets dip all the time. What matters is the trend over years, not the wiggle this week." },
    { icon: "🔁", title: "What is rebalancing?", mins: 4, blurb: "Over time some investments grow faster than others. Rebalancing nudges things back to the mix you chose." },
    { icon: "🏦", title: "Renda Fixa, explained", mins: 5, blurb: "Brazil's version of bonds and CDs — you lend money, you get paid interest. The steady part of a portfolio." },
    { icon: "✨", title: "Compound interest magic", mins: 4, blurb: "Earnings earn their own earnings. Small amounts, left alone, become surprisingly big." }
  ],

  glossary: [
    { term: "Net worth", def: "Everything you own minus everything you owe. Here: investments + cash." },
    { term: "P/L", def: "Profit or Loss — how much your investments have gained or lost since you bought them." },
    { term: "Allocation", def: "How your money is split between different types of investments." },
    { term: "FII", def: "Fundo de Investimento Imobiliário — a Brazilian real-estate fund that pays monthly rent-like income." },
    { term: "ETF", def: "A single investment that holds many stocks at once. Buy one, own hundreds." },
    { term: "APY", def: "Annual Percentage Yield — the interest your cash earns in a year, compounding included." },
    { term: "Dividend", def: "A slice of company profit paid to you in cash, usually every few months." },
    { term: "Emergency fund", def: "Cash set aside for surprises (3–6 months of expenses) so you never have to sell investments in a panic." }
  ]
};
