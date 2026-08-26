import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import Overview from './components/Overview'
import Growth from './components/Growth'
import Holdings from './components/Holdings'
import Rebalance from './components/Rebalance'
import Review from './components/Review'
import Import from './components/Import'
import Rental from './components/Rental'
import Login from './components/Login'
import { usePortfolio } from './hooks/usePortfolio'
import { useRental } from './hooks/useRental'
import { useAuth } from './hooks/useAuth'
import { isCashAccount } from './lib/statements'

const TABS = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'growth',    label: 'Growth'    },
  { id: 'holdings',  label: 'Holdings'  },
  { id: 'rebalance', label: 'Rebalance' },
  { id: 'review',    label: 'Review'    },
  { id: 'import',    label: 'Import'    },
]

function Splash({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:13 }}>
      {children}
    </div>
  )
}

// The gate lives above Dashboard rather than inside it so the portfolio and
// rental hooks — which start fetching from Supabase the moment they mount —
// never run for a signed-out visitor.
export default function App() {
  const auth = useAuth()
  if (auth.checking) return <Splash>Checking sign-in…</Splash>
  if (auth.required && !auth.session) return <Login signIn={auth.signIn} />
  return <Dashboard onSignOut={auth.required ? auth.signOut : null} />
}

function Dashboard({ onSignOut }) {
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem('sg_tab')
    return TABS.some(t => t.id === saved) ? saved : 'overview'
  })
  // Platform: 'portfolio' (investing) or 'rental' (the Texas house) — toggled
  // from the header. 'budget' is the old name for the rental side, still in
  // localStorage from before spending tracking was dropped.
  const [mode, setMode] = useState(() =>
    ['rental', 'budget'].includes(localStorage.getItem('sg_mode')) ? 'rental' : 'portfolio')
  const [focusCat, setFocusCat] = useState(null)
  const p = usePortfolio()
  const b = useRental()

  // Checking accounts on the rental side double as portfolio cash: their
  // balance comes straight from the statements you already import, so it
  // shows up in net worth and updates itself — no second entry by hand.
  // Accounts you deliberately *link* to a named portfolio account are left
  // out here so the same dollars aren't counted twice. Accounts whose
  // statements predate balance capture surface with a null value (shown as
  // "needs a re-import") rather than vanishing.
  const { accounts: bankAccounts, accountBalance } = b
  const derivedCash = useMemo(() =>
    bankAccounts
      .filter(a => isCashAccount(a.kind) && !a.portfolioAccountId)
      .map(a => ({
        id: 'budget:' + a.id, bankAccountId: a.id,
        label: a.name,
        note: (a.kind === 'savings' ? 'Savings' : 'Joint day-to-day') + ' · synced from your statements',
        // A checking balance is liquid cash; a savings account is money set
        // aside, so it counts with the investments like the emergency fund.
        bucket: a.kind === 'savings' ? 'savings' : 'cash',
        value: accountBalance(a.id), apy: null, source: 'budget',
      })),
    [bankAccounts, accountBalance])

  useEffect(() => { localStorage.setItem('sg_tab', tab) }, [tab])
  useEffect(() => {
    localStorage.setItem('sg_mode', mode)
    document.body.dataset.mode = mode
  }, [mode])

  const goToCategory = (catId) => {
    setFocusCat(catId)
    setTab('holdings')
  }

  if (!p.ready) return <Splash>Loading portfolio…</Splash>

  return (
    <div className="app">
      <Header
        priceStatus={p.priceStatus}
        syncStatus={p.syncStatus}
        lastUpdated={p.lastUpdated}
        onRefresh={p.manualRefresh}
        mode={mode}
        setMode={setMode}
        onSignOut={onSignOut}
      />
      {mode === 'rental' ? (
        <main>
          <Rental
            b={b}
            portfolioAccounts={p.accounts}
            syncAccountValue={(id, value) => p.updateAccount(id, 'value', value)}
          />
        </main>
      ) : (
        <>
          <nav className="tabs">
            {TABS.map(t => (
              <button key={t.id} type="button" className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <main>
            {tab === 'overview'  && <Overview  holdings={p.holdings} categoryTotals={p.categoryTotals} regionTotals={p.regionTotals} holdingValue={p.holdingValue} holdingCost={p.holdingCost} fxRate={p.fxRate} setFxRate={p.updateFxRate} onCategoryClick={goToCategory} accounts={p.accounts} derivedAccounts={derivedCash} addAccount={p.addAccount} updateAccount={p.updateAccount} removeAccount={p.removeAccount} onManageRental={() => setMode('rental')} />}
            {tab === 'growth'    && <Growth    holdings={p.holdings} categoryTotals={p.categoryTotals} holdingCost={p.holdingCost} accounts={[...p.accounts, ...derivedCash]} />}
            {tab === 'holdings'  && <Holdings  holdings={p.holdings} addHolding={p.addHolding} updateHolding={p.updateHolding} removeHolding={p.removeHolding} toggleTag={p.toggleTag} holdingValue={p.holdingValue} holdingCost={p.holdingCost} priceErrors={p.priceErrors} priceMeta={p.priceMeta} priceCoverage={p.priceCoverage} focusCategory={focusCat} onFocusHandled={() => setFocusCat(null)} />}
            {tab === 'rebalance' && <Rebalance holdings={p.holdings} targets={p.targets} categoryTotals={p.categoryTotals} updateTarget={p.updateTarget} updateHolding={p.updateHolding} splitGroupEvenly={p.splitGroupEvenly} normalizeGroup={p.normalizeGroup} holdingValue={p.holdingValue} />}
            {tab === 'review'    && <Review reviews={p.reviews} addReview={p.addReview} updateReview={p.updateReview} rejectReview={p.rejectReview} approveReview={p.approveReview} />}
            {tab === 'import'    && <Import holdings={p.holdings} reviews={p.reviews} importedLots={p.importedLots} applyTradeImport={p.applyTradeImport} accounts={p.accounts} upsertAccountValue={p.upsertAccountValue} />}
          </main>
        </>
      )}
    </div>
  )
}
