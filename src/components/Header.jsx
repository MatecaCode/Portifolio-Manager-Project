import { Chip } from './ui'

export default function Header({ priceStatus, syncStatus, lastUpdated, onRefresh }) {
  const timeStr = lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null

  const priceLabel = {
    live:    timeStr ? `⚡ Prices live · ${timeStr}` : '⚡ Prices live',
    error:   '⚠ Price error',
    loading: '⟳ Updating…',
    idle:    '… Connecting',
  }[priceStatus]

  const syncLabel = { synced: '☁ Synced', syncing: '☁ Saving…', error: '☁ Sync error', local: '☁ Local only' }[syncStatus]

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <div className="brand-sun"></div>
          <div className="brand-wing"></div>
        </div>
        <div>
          <div className="brand-name">SunnyHeron</div>
          <div className="brand-sub">Matheus &amp; Melanie</div>
        </div>
      </div>
      <div className="topbar-right">
        {syncStatus !== 'local' && (
          <Chip tone={syncStatus === 'error' ? 'warn' : 'soft'}
            title="Whether your changes are saved to the cloud, so both of you see the same data on any device.">
            {syncLabel}
          </Chip>
        )}
        <button className="chip chip-up chip-btn" onClick={onRefresh}
          title="Prices update automatically every 5 minutes. Click any time to refresh them now.">
          {priceLabel}
        </button>
      </div>
    </header>
  )
}
