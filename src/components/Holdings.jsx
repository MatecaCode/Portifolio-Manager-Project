import { useEffect, useState } from 'react';
import { CATEGORIES, TICKER_INFO, COINGECKO_IDS, categoryById, currencySymbol, holdingCurrency, holdingRegion } from '../data/portfolio';
import { Card, CatDot, Chip, RegionBadge, RegionSelect, SectionLabel, TagBadge, Term } from './ui';

// Buckets are the thesis; the sticker on each row is the country. Core buckets
// first (crypto still leads, per the rebrand handoff), then the narrow sleeves.
const SECTIONS = [
  { id: 'core',  label: 'Core buckets', order: ['crypto', 'stocks', 'fii', 'renda_fixa', 'intl'],
    note: 'The backbone — broad on purpose' },
  { id: 'theme', label: 'Thematic sleeves', order: ['energy', 'water', 'rare_earths'],
    note: 'Narrow bets, each with its own target so none can quietly take over' },
];

const fmtQty = n => n.toLocaleString('en-US', { maximumFractionDigits: 5 });
const fmtNum = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function HoldingRow({ holding, onUpdate, onRemove, onToggleTag, editMode, onTickerClick }) {
  const valLocal = (holding.shares || 0) * (holding.price || 0);
  const costLocal = (holding.shares || 0) * (holding.cost || 0);
  const pnlPct = costLocal > 0 ? ((valLocal - costLocal) / costLocal * 100) : 0;
  const owned = (holding.shares || 0) > 0;
  const isLive = !!COINGECKO_IDS[holding.ticker?.toUpperCase()];
  const sym = currencySymbol(holdingCurrency(holding));

  if (editMode) {
    return (
      <div className="hold-row editing">
        <span className="hold-id">
          <input className="h-input" style={{ width: 90 }} value={holding.ticker} placeholder="TICK"
            onChange={e => onUpdate(holding.id, 'ticker', e.target.value)} />
          <input className="h-input head-font" value={holding.name} placeholder="Name"
            onChange={e => onUpdate(holding.id, 'name', e.target.value)} />
          <RegionSelect value={holding.region} onChange={v => onUpdate(holding.id, 'region', v)} />
          <TagBadge tag="finclass" on={holding.finclass} onClick={() => onToggleTag(holding.id, 'finclass')} />
        </span>
        <input className="h-input num" type="number" step="any" value={holding.shares || ''} placeholder="0"
          onChange={e => onUpdate(holding.id, 'shares', e.target.value)} />
        <input className="h-input num" type="number" step="any" value={holding.cost || ''} placeholder="Avg cost"
          onChange={e => onUpdate(holding.id, 'cost', e.target.value)} />
        <input className="h-input num" type="number" step="any" value={holding.price || ''} placeholder="Price"
          onChange={e => onUpdate(holding.id, 'price', e.target.value)} />
        <span className="num mono">{owned ? sym + fmtNum(valLocal) : '—'}</span>
        <span className={'num mono ' + (!owned ? 'flat' : pnlPct < 0 ? 'down' : 'up')}>
          {owned ? (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%' : ''}
        </span>
        <button className="hold-del" title="Remove this holding"
          onClick={() => { if (confirm(`Remove ${holding.ticker || 'this holding'}?`)) onRemove(holding.id) }}>×</button>
      </div>
    );
  }

  return (
    <div className="hold-row">
      <span className="hold-id">
        <button className="ticker" type="button" title="Click to learn what this investment is"
          onClick={() => onTickerClick(holding)}>{holding.ticker || '—'}</button>
        <RegionBadge region={holding.region} />
        <span className="hold-name">{holding.name}</span>
        {holding.finclass && <TagBadge tag="finclass" />}
        {isLive && <span className="live-chip">LIVE</span>}
      </span>
      <span className="num mono">{owned ? fmtQty(holding.shares) : '—'}</span>
      <span className="num mono">{fmtNum(holding.cost || 0)}</span>
      <span className="num mono">{fmtNum(holding.price || 0)}</span>
      <span className="num mono">{owned ? sym + fmtNum(valLocal) : '—'}</span>
      <span className={'num ' + (owned ? 'mono ' : '') + (!owned ? 'flat' : pnlPct < 0 ? 'down' : pnlPct > 0 ? 'up' : 'flat')}
        style={owned ? undefined : { fontStyle: 'italic', fontSize: 12.5 }}>
        {owned ? (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%' : 'on the list'}
      </span>
    </div>
  );
}

function TickerModal({ holding, onClose }) {
  const info = TICKER_INFO[holding.ticker?.toUpperCase()];
  const cat = categoryById(holding.category);
  const region = holdingRegion(holding);
  // Approved review candidates carry their own thesis — use it when the ticker
  // isn't in the hand-written library yet.
  const text = info?.text || holding.thesis;
  const link = info?.link || holding.link;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <span className="modal-ticker mono">{holding.ticker}</span>
        <h3 className="modal-title">{info?.title || holding.name || 'Unknown'}</h3>
        <p className="modal-cat">
          <CatDot color={cat?.color} /> {cat?.name} · {region.name} · priced in {region.currency}
        </p>
        <p className="modal-text">
          {text || 'No description yet for this one — it was added manually. Ask Claude to add a plain-English explanation for it.'}
        </p>
        {link && (
          <a className="modal-link" href={link} target="_blank" rel="noreferrer">
            See live quote &amp; details ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function Holdings({ holdings, addHolding, updateHolding, removeHolding, toggleTag, holdingValue, holdingCost, focusCategory, onFocusHandled }) {
  const [editMode, setEditMode] = useState(false);
  const [infoHolding, setInfoHolding] = useState(null);

  useEffect(() => {
    if (!focusCategory) return;
    const el = document.getElementById(`cat-${focusCategory}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('flash');
      const t = setTimeout(() => {
        el.classList.remove('flash');
        onFocusHandled?.();
      }, 1800);
      return () => clearTimeout(t);
    }
    onFocusHandled?.();
  }, [focusCategory, onFocusHandled]);

  // A bucket can now hold reais and dollars at once, so its total is only
  // meaningful in a single currency when every row agrees on one. Otherwise
  // fall back to the USD figures the rest of the app already converts.
  const groupTotals = items => {
    const currencies = new Set(items.map(holdingCurrency));
    if (currencies.size > 1) {
      return {
        mixed: true, sym: '$',
        value: items.reduce((a, h) => a + holdingValue(h), 0),
        pnl: items.reduce((a, h) => a + holdingValue(h) - holdingCost(h), 0),
      };
    }
    return {
      mixed: false, sym: currencySymbol([...currencies][0] || 'USD'),
      value: items.reduce((a, h) => a + (h.shares || 0) * (h.price || 0), 0),
      pnl: items.reduce((a, h) => a + (h.shares || 0) * ((h.price || 0) - (h.cost || 0)), 0),
    };
  };

  return (
    <div className="screen">
      <div className="hold-toolbar">
        <span className="hold-legend">
          <TagBadge tag="finclass" /> FinClass pick &nbsp;·&nbsp; <RegionBadge region="us" /> where it trades &nbsp;·&nbsp;
          <Chip tone="up">LIVE</Chip> auto-updated price · hover anything dotted to learn
        </span>
        <button className={'btn-soft' + (editMode ? ' on' : '')} type="button"
          onClick={() => setEditMode(m => !m)}
          title="Most numbers update automatically — turn editing on only when you've bought or sold something.">
          {editMode ? '✓ Done editing' : '✎ Edit holdings'}
        </button>
      </div>

      {editMode && (
        <div className="edit-warning">
          ⚠ Editing is on. Prices update automatically from the internet — you normally only
          need to change <strong>Qty</strong> and <strong>Avg cost</strong> after buying or selling.
          Manual price changes get overwritten at the next refresh.
        </div>
      )}

      {SECTIONS.map(section => (
        <div key={section.id} className="hold-section">
          <SectionLabel right={<span className="hold-section-note">{section.note}</span>}>{section.label}</SectionLabel>
          {section.order.map(id => CATEGORIES.find(c => c.id === id)).filter(Boolean).map(cat => {
            const items = holdings.filter(h => h.category === cat.id);
            const owned = items.filter(h => (h.shares || 0) > 0).length;
            const { mixed, sym, value, pnl } = groupTotals(items);

            return (
              <Card key={cat.id} id={`cat-${cat.id}`} className="hold-group">
                <div className="hold-head">
                  <CatDot color={cat.color} size={10} />
                  <span className="hold-cat">{cat.name}</span>
                  <Chip title={`${owned} owned, ${items.length} on the list (watchlist items have quantity 0)`}>
                    {owned} owned / {items.length}
                  </Chip>
                  {editMode && <button className="btn-soft" style={{ padding: '4px 12px', fontSize: 12.5 }} onClick={() => addHolding(cat.id)}>+ Add</button>}
                  <span className="hold-total"
                    title={mixed ? 'This bucket holds more than one currency, so the total is shown in dollars at your USD/BRL rate.' : undefined}>
                    <span className="mono">{mixed ? '≈ ' : ''}{sym}{value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    <span className={'mono ' + (pnl < 0 ? 'down' : pnl > 0 ? 'up' : 'flat')}>
                      {' '}· {pnl >= 0 ? '+' : '-'}{Math.abs(pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </span>
                </div>
                <p className="hold-blurb">{cat.blurb}</p>

                <div className="hold-table">
                  {items.length > 0 && (
                    <div className={'hold-row hold-row-header' + (editMode ? ' editing' : '')}>
                      <span>Ticker / name</span>
                      <span className="num"><Term tip="How many units you own. Zero means it's on the watchlist — planned but not bought yet.">Qty</Term></span>
                      <span className="num"><Term tip="The average price you paid per unit, in that holding's own currency.">Avg cost</Term></span>
                      <span className="num"><Term tip="What one unit is worth right now, in that holding's own currency. Updates automatically for most investments.">Current</Term></span>
                      <span className="num">Value</span>
                      <span className="num">P/L %</span>
                      {editMode && <span></span>}
                    </div>
                  )}
                  {items.map(h => (
                    <HoldingRow
                      key={h.id}
                      holding={h}
                      onUpdate={updateHolding}
                      onRemove={removeHolding}
                      onToggleTag={toggleTag}
                      editMode={editMode}
                      onTickerClick={setInfoHolding}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="hold-empty">Nothing here yet — turn on editing to add one, or approve a candidate on the Review tab.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ))}

      {infoHolding && <TickerModal holding={infoHolding} onClose={() => setInfoHolding(null)} />}
    </div>
  );
}
