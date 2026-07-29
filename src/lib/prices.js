import { regionById } from '../data/portfolio'

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY
const BRAPI_KEY   = import.meta.env.VITE_BRAPI_KEY

const GECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple',
  BNB: 'binancecoin', AVAX: 'avalanche-2', SOL: 'solana',
}

// Which API can quote a holding follows its country sticker (region.quotes),
// not its bucket — a BR name and a US name can sit in the same bucket now.
// renda_fixa is excluded wholesale: price=1, shares=BRL invested.
// ACE-CAP/GENOA are CVM funds with no public quote API, same deal.
const MANUAL_CATS = ['renda_fixa']
const MANUAL_TICKERS = ['GENOA']

const quotable = h => h.ticker && !h.ticker.includes('-')
  && !MANUAL_CATS.includes(h.category)
  && !MANUAL_TICKERS.includes(h.ticker.toUpperCase())

export async function fetchAllPrices(holdings) {
  const prices = {}, errors = {}
  const live   = holdings.filter(quotable)
  const crypto = live.filter(h => h.category === 'crypto')
  const market = live.filter(h => h.category !== 'crypto')
  const br     = market.filter(h => regionById(h.region).quotes === 'br')
  const us     = market.filter(h => regionById(h.region).quotes === 'us')

  await Promise.allSettled([
    fetchCrypto(crypto, prices, errors),
    fetchBR(br, prices, errors),
    fetchUS(us, prices, errors),
  ])
  return { prices, errors }
}

async function fetchCrypto(holdings, prices, errors) {
  if (!holdings.length) return
  const tickers = [...new Set(holdings.map(h => h.ticker.toUpperCase()))]
  const ids = tickers.map(t => GECKO_IDS[t]).filter(Boolean)
  if (!ids.length) return
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`)
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
    const data = await res.json()
    tickers.forEach(t => {
      const id = GECKO_IDS[t]
      if (id && data[id]?.usd) prices[t] = { price: data[id].usd, source: 'CoinGecko' }
    })
  } catch(e) { errors.coingecko = e.message }
}

async function fetchBR(holdings, prices, errors) {
  if (!holdings.length || !BRAPI_KEY) return
  const tickers = [...new Set(holdings.map(h => h.ticker.toUpperCase()).filter(t => t.length <= 7))]
  if (!tickers.length) return
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${tickers.join(',')}?token=${BRAPI_KEY}`)
    if (!res.ok) throw new Error(`Brapi ${res.status}`)
    const data = await res.json()
    if (data.results) data.results.forEach(r => {
      if (r.regularMarketPrice) prices[r.symbol] = { price: r.regularMarketPrice, source: 'Brapi', change: r.regularMarketChangePercent }
    })
  } catch(e) { errors.brapi = e.message }
}

async function fetchUS(holdings, prices, errors) {
  if (!holdings.length || !FINNHUB_KEY) return
  const tickers = [...new Set(holdings.map(h => h.ticker.toUpperCase()))]
  await Promise.allSettled(tickers.map(async ticker => {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`)
      if (!res.ok) throw new Error(`Finnhub ${res.status}`)
      const d = await res.json()
      if (d.c > 0) prices[ticker] = { price: d.c, source: 'Finnhub', change: d.dp }
    } catch(e) { errors[`finnhub_${ticker}`] = e.message }
  }))
}
