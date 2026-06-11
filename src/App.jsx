import { useState } from 'react'
import Header from './components/Header'
import Overview from './components/Overview'
import Holdings from './components/Holdings'
import Rebalance from './components/Rebalance'
import Import from './components/Import'
import { usePortfolio } from './hooks/usePortfolio'
import styles from './App.module.css'

const TABS = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'holdings',  label: 'Holdings'  },
  { id: 'rebalance', label: 'Rebalance' },
  { id: 'import',    label: 'Import'    },
]

export default function App() {
  const [tab, setTab] = useState('overview')
  const [focusCat, setFocusCat] = useState(null)
  const p = usePortfolio()

  const goToCategory = (catId) => {
    setFocusCat(catId)
    setTab('holdings')
  }

  if (!p.ready) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text3)', fontFamily:'DM Mono, monospace', fontSize:13 }}>
        Loading portfolio…
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <Header
        priceStatus={p.priceStatus}
        syncStatus={p.syncStatus}
        lastUpdated={p.lastUpdated}
        onRefresh={p.manualRefresh}
      />
      <nav className={styles.nav}>
        {TABS.map(t => (
          <button key={t.id} className={`${styles.navTab} ${tab === t.id ? styles.active : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'overview'  && <Overview  holdings={p.holdings} categoryTotals={p.categoryTotals} holdingValue={p.holdingValue} holdingCost={p.holdingCost} fxRate={p.fxRate} setFxRate={p.updateFxRate} onCategoryClick={goToCategory} accounts={p.accounts} addAccount={p.addAccount} updateAccount={p.updateAccount} removeAccount={p.removeAccount} />}
        {tab === 'holdings'  && <Holdings  holdings={p.holdings} addHolding={p.addHolding} updateHolding={p.updateHolding} removeHolding={p.removeHolding} toggleTag={p.toggleTag} holdingValue={p.holdingValue} holdingCost={p.holdingCost} priceErrors={p.priceErrors} focusCategory={focusCat} onFocusHandled={() => setFocusCat(null)} />}
        {tab === 'rebalance' && <Rebalance holdings={p.holdings} targets={p.targets} categoryTotals={p.categoryTotals} updateTarget={p.updateTarget} holdingValue={p.holdingValue} />}
        {tab === 'import'    && <Import />}
      </main>
    </div>
  )
}
