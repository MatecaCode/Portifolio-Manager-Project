import { Chip } from './ui'

const MODES = [
  { id: 'portfolio', label: '📊 Portfolio' },
  { id: 'budget',    label: '💸 Budget'    },
]

export default function Header({ priceStatus, syncStatus, lastUpdated, onRefresh, mode, setMode, onSignOut }) {
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
        <div className="platform-switch" title="Switch between the investing side (Portfolio) and the spending side (Budget).">
          {MODES.map(m => (
            <button key={m.id} type="button"
              className={'platform-btn' + (mode === m.id ? ' active' : '')}
              onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        {syncStatus !== 'local' && (
          <Chip tone={syncStatus === 'error' ? 'warn' : 'soft'}
            title="Whether your changes are saved to the cloud, so both of you see the same data on any device.">
            {syncLabel}
          </Chip>
        )}
        {mode !== 'budget' && (
          <button className="chip chip-up chip-btn" onClick={onRefresh}
            title="Prices update automatically every 5 minutes. Click any time to refresh them now.">
            {priceLabel}
          </button>
        )}
        {onSignOut && (
          <button className="chip chip-soft chip-btn" onClick={onSignOut}
            title="Sign out of the shared account on this device.">
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}
