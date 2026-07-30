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

// Turn an HTTP status into something you can act on. "Finnhub 401" tells you
// nothing; "your API key is invalid" tells you to go re-paste it in Vercel.
function httpHint(source, status, body) {
  const detail = String(body || '').slice(0, 120).trim()
  const suffix = detail ? ` — ${detail}` : ''
  if (status === 401) return `${source} rejected the API key (401). Re-check the key in Vercel → Settings → Environment Variables, then redeploy.${suffix}`
  if (status === 403) return `${source} denied access (403). The key may be revoked, or your plan may not cover these symbols.${suffix}`
  if (status === 429) return `${source} rate limit hit (429). Prices will catch up on the next refresh.${suffix}`
  if (status >= 500)  return `${source} is having server trouble (${status}). Usually temporary.${suffix}`
  return `${source} returned HTTP ${status}.${suffix}`
}

async function readErr(res) {
  try { return (await res.text()) } catch { return '' }
}

const quotable = h => h.ticker && !h.ticker.includes('-')
  && !MANUAL_CATS.includes(h.category)
  && !MANUAL_TICKERS.includes(h.ticker.toUpperCase())

export async function fetchAllPrices(holdings) {
  const prices = {}
  const errors = []
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

  // Everything we genuinely expected a live quote for, so the caller can tell
  // a total outage from a partial one instead of calling any success "live".
  const requested = [...new Set([...crypto, ...br, ...us].map(h => h.ticker.toUpperCase()))]
  const missing = requested.filter(t => !prices[t])
  return { prices, errors, requested, missing }
}

async function fetchCrypto(holdings, prices, errors) {
  if (!holdings.length) return
  const tickers = [...new Set(holdings.map(h => h.ticker.toUpperCase()))]
  const known = tickers.filter(t => GECKO_IDS[t])
  const unknown = tickers.filter(t => !GECKO_IDS[t])
  if (unknown.length) {
    errors.push({ source: 'CoinGecko', tickers: unknown,
      message: 'No CoinGecko id mapped for these coins — add one to GECKO_IDS in src/lib/prices.js.' })
  }
  if (!known.length) return
  try {
    const ids = known.map(t => GECKO_IDS[t])
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`)
    if (!res.ok) throw new Error(httpHint('CoinGecko', res.status, await readErr(res)))
    const data = await res.json()
    const got = []
    known.forEach(t => {
      const id = GECKO_IDS[t]
      if (data[id]?.usd) { prices[t] = { price: data[id].usd, source: 'CoinGecko' }; got.push(t) }
    })
    const none = known.filter(t => !got.includes(t))
    if (none.length) errors.push({ source: 'CoinGecko', tickers: none, message: 'CoinGecko returned no price for these.' })
  } catch (e) {
    errors.push({ source: 'CoinGecko', tickers: known, message: e.message || 'Request failed (network or CORS).' })
  }
}

async function fetchBR(holdings, prices, errors) {
  const tickers = [...new Set(holdings.map(h => h.ticker.toUpperCase()).filter(t => t.length <= 7))]
  if (!tickers.length) return
  if (!BRAPI_KEY) {
    errors.push({ source: 'Brapi', tickers, message: 'VITE_BRAPI_KEY is not set on this deployment, so Brazilian quotes are skipped.' })
    return
  }
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${tickers.join(',')}?token=${BRAPI_KEY}`)
    if (!res.ok) throw new Error(httpHint('Brapi', res.status, await readErr(res)))
    const data = await res.json()
    const got = []
    ;(data.results || []).forEach(r => {
      if (r.regularMarketPrice) {
        prices[r.symbol] = { price: r.regularMarketPrice, source: 'Brapi', change: r.regularMarketChangePercent }
        got.push(r.symbol)
      }
    })
    const none = tickers.filter(t => !got.includes(t))
    if (none.length) errors.push({ source: 'Brapi', tickers: none, message: 'Brapi returned no price for these tickers.' })
  } catch (e) {
    errors.push({ source: 'Brapi', tickers, message: e.message || 'Request failed (network or CORS).' })
  }
}

async function fetchUS(holdings, prices, errors) {
  const tickers = [...new Set(holdings.map(h => h.ticker.toUpperCase()))]
  if (!tickers.length) return
  if (!FINNHUB_KEY) {
    errors.push({ source: 'Finnhub', tickers, message: 'VITE_FINNHUB_KEY is not set on this deployment, so US quotes are skipped.' })
    return
  }

  // Collect per-ticker failures, then group identical ones: a bad key fails
  // every symbol the same way and should read as one problem, not eight.
  const failures = []
  await Promise.allSettled(tickers.map(async ticker => {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`)
      if (!res.ok) { failures.push({ ticker, message: httpHint('Finnhub', res.status, await readErr(res)) }); return }
      const d = await res.json()
      if (d && d.c > 0) {
        prices[ticker] = { price: d.c, source: 'Finnhub', change: d.dp }
      } else {
        // Finnhub answers with c:0 for a symbol it won't quote on your plan —
        // previously this was skipped in silence and looked like a stale price.
        failures.push({ ticker, message: 'Finnhub returned an empty quote (c:0). The symbol may not be covered by your plan — ETFs often need a paid tier.' })
      }
    } catch (e) {
      failures.push({ ticker, message: e.message || 'Request failed (network or CORS).' })
    }
  }))

  const byMessage = new Map()
  for (const f of failures) {
    if (!byMessage.has(f.message)) byMessage.set(f.message, [])
    byMessage.get(f.message).push(f.ticker)
  }
  for (const [message, tks] of byMessage) errors.push({ source: 'Finnhub', tickers: tks, message })
}
