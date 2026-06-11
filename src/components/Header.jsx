import { RefreshCw, Wifi, WifiOff, Cloud, CloudOff, Clock } from 'lucide-react'
import styles from './Header.module.css'

export default function Header({ priceStatus, syncStatus, lastUpdated, onRefresh }) {
  const priceIcon = {
    live:    <Wifi size={12} />,
    error:   <WifiOff size={12} />,
    loading: <RefreshCw size={12} className={styles.spin} />,
    idle:    <Clock size={12} />,
  }[priceStatus]

  const priceLabel = { live: 'Prices live', error: 'Price error', loading: 'Updating…', idle: 'Connecting…' }[priceStatus]
  const timeStr = lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

  const syncIcon  = syncStatus === 'synced'  ? <Cloud size={11} />
                  : syncStatus === 'syncing' ? <RefreshCw size={11} className={styles.spin} />
                  : syncStatus === 'error'   ? <CloudOff size={11} />
                  : null
  const syncLabel = { synced: 'Synced', syncing: 'Saving…', error: 'Sync error', local: 'Local only' }[syncStatus]

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo}>◈</span>
        <div>
          <h1 className={styles.title}>Portfolio</h1>
          <p className={styles.subtitle}>Matheus & Melanie</p>
        </div>
      </div>
      <div className={styles.right}>
        {syncStatus !== 'local' && (
          <div className={`${styles.badge} ${styles[syncStatus]}`}>
            {syncIcon}<span>{syncLabel}</span>
          </div>
        )}
        <button className={`${styles.badge} ${styles[priceStatus]}`} onClick={onRefresh} title="Refresh prices (CoinGecko · Finnhub · Brapi)">
          {priceIcon}
          <span>{priceLabel}</span>
          {timeStr && <span className={styles.time}>{timeStr}</span>}
        </button>
      </div>
    </header>
  )
}
