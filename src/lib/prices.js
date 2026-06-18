const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY
const BRAPI_KEY   = import.meta.env.VITE_BRAPI_KEY

const GECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple',
  BNB: 'binancecoin', AVAX: 'avalanche-2', SOL: 'solana',
}

// renda_fixa is intentionally excluded: price=1, shares=BRL invested.
// intl is included for B3-listed ETFs (WRLD11/USDB11); ACE-CAP/GENOA are
// CVM funds with no public quote API — they keep price=1, shares=BRL invested.
const BR_CATS = ['br_stocks', 'fii', 'intl']
const US_CATS = ['us_stocks']
const MANUAL_TICKERS = ['GENOA']

export async function fetchAllPrices(holdings) {
  const prices = {}, errors = {}
  const crypto = holdings.filter(h => h.category === 'crypto')
  const br     = holdings.filter(h => BR_CATS.includes(h.category) && h.ticker && !h.ticker.includes('-') && !MANUAL_TICKERS.includes(h.ticker.toUpperCase()))
  const us     = holdings.filter(h => US_CATS.includes(h.category) && h.ticker && !h.ticker.includes('-'))

  await Promise.allSettled([
    fetchCrypto(crypto, prices, errors),
    fetchBR(br, prices, errors),
    fetchUS(us, prices, errors),
  ])
  return { prices, errors }
}

async function fetchCrypto(holdings, prices, errors) {
  if (!holdings.length) return
  // geckoId is stored on holdings added through the validated add flow;
  // GECKO_IDS covers the original seed coins.
  const idByTicker = {}
  holdings.forEach(h => {
    const t = h.ticker?.toUpperCase()
    const id = h.geckoId || GECKO_IDS[t]
    if (t && id) idByTicker[t] = id
  })
  const ids = [...new Set(Object.values(idByTicker))]
  if (!ids.length) return
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`)
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
    const data = await res.json()
    Object.entries(idByTicker).forEach(([t, id]) => {
      if (data[id]?.usd) prices[t] = { price: data[id].usd, source: 'CoinGecko' }
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

// True when this holding's price refreshes automatically from an API.
export function hasLiveFeed(h) {
  const t = h.ticker?.toUpperCase()
  if (!t) return false
  if (h.category === 'crypto') return !!(h.geckoId || GECKO_IDS[t])
  if (t.includes('-') || MANUAL_TICKERS.includes(t)) return false
  if (BR_CATS.includes(h.category)) return t.length <= 7
  return US_CATS.includes(h.category)
}

// ── Ticker validation for the add-holding flow ──
// Resolves to { ok: true, ticker, name?, price?, change?, geckoId? } when the
// ticker exists on the matching API, or { ok: false, reason } when it doesn't.
// Categories without a public quote API (renda_fixa) are accepted as-is.
export async function lookupTicker(rawTicker, category) {
  const ticker = (rawTicker || '').trim().toUpperCase()
  if (!ticker) return { ok: false, reason: 'Type a ticker first.' }
  if (category === 'crypto') return lookupCrypto(ticker)
  if (BR_CATS.includes(category)) return lookupBR(ticker)
  if (US_CATS.includes(category)) return lookupUSStock(ticker)
  return { ok: true, ticker }
}

async function lookupCrypto(ticker) {
  try {
    let id = GECKO_IDS[ticker], name
    if (!id) {
      const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`)
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
      const data = await res.json()
      // exact symbol match, best-ranked first (search results come pre-ranked)
      const coin = (data.coins || []).find(c => c.symbol?.toUpperCase() === ticker)
      if (!coin) return { ok: false, reason: `No cryptocurrency found with symbol "${ticker}".` }
      id = coin.id
      name = coin.name
    }
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
    const data = await res.json()
    const price = data[id]?.usd
    if (!price) return { ok: false, reason: `"${ticker}" exists but has no USD price on CoinGecko.` }
    return { ok: true, ticker, name, price, geckoId: id }
  } catch(e) { return { ok: false, reason: `Couldn't reach CoinGecko (${e.message}). Try again in a moment.` } }
}

async function lookupBR(ticker) {
  if (!BRAPI_KEY) return { ok: false, reason: 'Brapi API key is missing (VITE_BRAPI_KEY), so B3 tickers can\'t be verified.' }
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${ticker}?token=${BRAPI_KEY}`)
    if (res.status === 404) return { ok: false, reason: `"${ticker}" was not found on B3.` }
    if (!res.ok) throw new Error(`Brapi ${res.status}`)
    const data = await res.json()
    const r = data.results?.find(x => x.symbol?.toUpperCase() === ticker) || data.results?.[0]
    if (!r?.regularMarketPrice) return { ok: false, reason: `"${ticker}" was not found on B3.` }
    return { ok: true, ticker, name: r.longName || r.shortName || '', price: r.regularMarketPrice, change: r.regularMarketChangePercent }
  } catch(e) { return { ok: false, reason: `Couldn't reach Brapi (${e.message}). Try again in a moment.` } }
}

async function lookupUSStock(ticker) {
  if (!FINNHUB_KEY) return { ok: false, reason: 'Finnhub API key is missing (VITE_FINNHUB_KEY), so US tickers can\'t be verified.' }
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`)
    if (!res.ok) throw new Error(`Finnhub ${res.status}`)
    const d = await res.json()
    if (!(d.c > 0)) return { ok: false, reason: `"${ticker}" was not found on US exchanges.` }
    let name = ''
    try {
      const pres = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`)
      if (pres.ok) name = (await pres.json()).name || ''
    } catch { /* name is nice-to-have; the quote already proved the ticker exists */ }
    return { ok: true, ticker, name, price: d.c, change: d.dp }
  } catch(e) { return { ok: false, reason: `Couldn't reach Finnhub (${e.message}). Try again in a moment.` } }
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
