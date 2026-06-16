import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import Overview from './components/Overview'
import Growth from './components/Growth'
import Holdings from './components/Holdings'
import Rebalance from './components/Rebalance'
import Import from './components/Import'
import Budget from './components/Budget'
import { usePortfolio } from './hooks/usePortfolio'
import { useBudget } from './hooks/useBudget'

const TABS = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'growth',    label: 'Growth'    },
  { id: 'holdings',  label: 'Holdings'  },
  { id: 'rebalance', label: 'Rebalance' },
  { id: 'import',    label: 'Import'    },
]

export default function App() {
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem('sg_tab')
    return TABS.some(t => t.id === saved) ? saved : 'overview'
  })
  // Platform: 'portfolio' (investing) or 'budget' (spending) — toggled from the header
  const [mode, setMode] = useState(() => localStorage.getItem('sg_mode') === 'budget' ? 'budget' : 'portfolio')
  const [focusCat, setFocusCat] = useState(null)
  const p = usePortfolio()
  const b = useBudget()

  // Checking accounts on the budget side double as portfolio cash: their
  // balance comes straight from the statements you already import, so it
  // shows up in net worth and updates itself — no second entry by hand.
  // Accounts you deliberately *link* to a named portfolio account are left
  // out here so the same dollars aren't counted twice.
  const { accounts: budgetAccounts, accountBalance } = b
  const derivedCash = useMemo(() =>
    budgetAccounts
      .filter(a => a.kind === 'checking' && !a.portfolioAccountId)
      .map(a => ({
        id: 'budget:' + a.id, budgetAccountId: a.id,
        label: a.name, note: 'Joint day-to-day · synced from your statements',
        value: accountBalance(a.id), apy: null, source: 'budget',
      }))
      .filter(a => a.value != null),
    [budgetAccounts, accountBalance])

  useEffect(() => { localStorage.setItem('sg_tab', tab) }, [tab])
  useEffect(() => {
    localStorage.setItem('sg_mode', mode)
    document.body.dataset.mode = mode
  }, [mode])

  const goToCategory = (catId) => {
    setFocusCat(catId)
    setTab('holdings')
  }

  if (!p.ready) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:13 }}>
        Loading portfolio…
      </div>
    )
  }

  return (
    <div className="app">
      <Header
        priceStatus={p.priceStatus}
        syncStatus={p.syncStatus}
        lastUpdated={p.lastUpdated}
        onRefresh={p.manualRefresh}
        mode={mode}
        setMode={setMode}
      />
      {mode === 'budget' ? (
        <main>
          <Budget
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
            {tab === 'overview'  && <Overview  holdings={p.holdings} categoryTotals={p.categoryTotals} holdingValue={p.holdingValue} holdingCost={p.holdingCost} fxRate={p.fxRate} setFxRate={p.updateFxRate} onCategoryClick={goToCategory} accounts={p.accounts} derivedAccounts={derivedCash} addAccount={p.addAccount} updateAccount={p.updateAccount} removeAccount={p.removeAccount} onManageBudget={() => setMode('budget')} />}
            {tab === 'growth'    && <Growth    holdings={p.holdings} categoryTotals={p.categoryTotals} holdingCost={p.holdingCost} accounts={[...p.accounts, ...derivedCash]} />}
            {tab === 'holdings'  && <Holdings  holdings={p.holdings} addHolding={p.addHolding} updateHolding={p.updateHolding} removeHolding={p.removeHolding} toggleTag={p.toggleTag} holdingValue={p.holdingValue} holdingCost={p.holdingCost} priceErrors={p.priceErrors} focusCategory={focusCat} onFocusHandled={() => setFocusCat(null)} />}
            {tab === 'rebalance' && <Rebalance holdings={p.holdings} targets={p.targets} categoryTotals={p.categoryTotals} updateTarget={p.updateTarget} holdingValue={p.holdingValue} />}
            {tab === 'import'    && <Import />}
          </main>
        </>
      )}
    </div>
  )
}
