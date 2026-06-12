import { useEffect, useState } from 'react';
import { CATEGORIES, TICKER_INFO } from '../data/portfolio';
import { hasLiveFeed, lookupTicker } from '../lib/prices';
import { Card, CatDot, Chip, TagBadge, Term } from './ui';

// Display order from the rebrand handoff: crypto first, then BRL, then USD groups
const CATEGORY_ORDER = ['crypto', 'br_stocks', 'fii', 'renda_fixa', 'us_stocks', 'intl'];

const fmtQty = n => n.toLocaleString('en-US', { maximumFractionDigits: 5 });
const fmtNum = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function HoldingRow({ holding, category, onUpdate, onRemove, onToggleTag, editMode, onTickerClick }) {
  const valLocal = (holding.shares || 0) * (holding.price || 0);
  const costLocal = (holding.shares || 0) * (holding.cost || 0);
  const pnlPct = costLocal > 0 ? ((valLocal - costLocal) / costLocal * 100) : 0;
  const owned = (holding.shares || 0) > 0;
  const isLive = hasLiveFeed(holding);
  const sym = category.currency === 'BRL' ? 'R$' : '$';

  if (editMode) {
    return (
      <div className="hold-row editing">
        <span className="hold-id">
          <input className="h-input" style={{ width: 90 }} value={holding.ticker} placeholder="TICK"
            onChange={e => onUpdate(holding.id, 'ticker', e.target.value)} />
          <input className="h-input head-font" value={holding.name} placeholder="Name"
            onChange={e => onUpdate(holding.id, 'name', e.target.value)} />
          <TagBadge tag="finclass" on={holding.finclass} onClick={() => onToggleTag(holding.id, 'finclass')} />
          <TagBadge tag="energy" on={holding.energy} onClick={() => onToggleTag(holding.id, 'energy')} />
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
        <span className="hold-name">{holding.name}</span>
        {holding.finclass && <TagBadge tag="finclass" />}
        {holding.energy && <TagBadge tag="energy" />}
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

// renda_fixa has no public quote API (CDBs, Tesouro…) — those stay free-form.
const NO_API_CATS = ['renda_fixa'];
const TICKER_EXAMPLE = {
  crypto: 'e.g. SOL', br_stocks: 'e.g. VALE3', fii: 'e.g. HGLG11',
  us_stocks: 'e.g. AAPL', intl: 'e.g. WRLD11',
};

function AddHoldingForm({ category, onAdd, onClose }) {
  const [ticker, setTicker] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    setError(null);
    const result = await lookupTicker(ticker, category.id);
    setChecking(false);
    if (!result.ok) { setError(result.reason); return; }
    onAdd(category.id, {
      ticker: result.ticker,
      name: result.name || '',
      price: result.price || 0,
      ...(result.geckoId ? { geckoId: result.geckoId } : {}),
    });
    onClose();
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <input className="h-input" style={{ width: 130 }} autoFocus value={ticker}
        placeholder={TICKER_EXAMPLE[category.id] || 'Ticker'}
        onChange={e => { setTicker(e.target.value); setError(null); }} />
      <button className="btn-soft" type="submit" disabled={checking || !ticker.trim()}>
        {checking ? 'Checking…' : '✓ Verify & add'}
      </button>
      <button className="btn-soft" type="button" onClick={onClose}>Cancel</button>
      <span className={error ? 'add-error' : 'add-hint'}>
        {error || 'The ticker is checked against the market before it\'s added — the live price comes with it.'}
      </span>
    </form>
  );
}

function TickerModal({ holding, onClose }) {
  const info = TICKER_INFO[holding.ticker?.toUpperCase()];
  const cat = CATEGORIES.find(c => c.id === holding.category);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <span className="modal-ticker mono">{holding.ticker}</span>
        <h3 className="modal-title">{info?.title || holding.name || 'Unknown'}</h3>
        <p className="modal-cat">
          <CatDot color={cat?.color} /> {cat?.name} · priced in {cat?.currency}
        </p>
        <p className="modal-text">
          {info?.text || 'No description yet for this one — it was added manually. Ask Claude to add a plain-English explanation for it.'}
        </p>
        {info?.link && (
          <a className="modal-link" href={info.link} target="_blank" rel="noreferrer">
            See live quote &amp; details ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function Holdings({ holdings, addHolding, updateHolding, removeHolding, toggleTag, focusCategory, onFocusHandled }) {
  const [editMode, setEditMode] = useState(false);
  const [infoHolding, setInfoHolding] = useState(null);
  const [addingCat, setAddingCat] = useState(null);

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

  const orderedCategories = CATEGORY_ORDER
    .map(id => CATEGORIES.find(c => c.id === id))
    .filter(Boolean);

  return (
    <div className="screen">
      <div className="hold-toolbar">
        <span className="hold-legend">
          <TagBadge tag="finclass" /> FinClass pick &nbsp;·&nbsp; <TagBadge tag="energy" /> Energy thesis &nbsp;·&nbsp;
          <Chip tone="up">LIVE</Chip> auto-updated price · hover anything dotted to learn
        </span>
        <button className={'btn-soft' + (editMode ? ' on' : '')} type="button"
          onClick={() => { setEditMode(m => !m); setAddingCat(null); }}
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

      {orderedCategories.map(cat => {
        const items = holdings.filter(h => h.category === cat.id);
        const owned = items.filter(h => (h.shares || 0) > 0).length;
        const totalVal = items.reduce((a, h) => a + (h.shares || 0) * (h.price || 0), 0);
        const totalPnl = items.reduce((a, h) => a + (h.shares || 0) * ((h.price || 0) - (h.cost || 0)), 0);
        const sym = cat.currency === 'BRL' ? 'R$' : '$';

        return (
          <Card key={cat.id} id={`cat-${cat.id}`} className="hold-group">
            <div className="hold-head">
              <CatDot color={cat.color} size={10} />
              <span className="hold-cat">{cat.name}</span>
              <span className="hold-ccy">({cat.currency})</span>
              <Chip title={`${owned} owned, ${items.length} on the list (watchlist items have quantity 0)`}>
                {owned} owned / {items.length}
              </Chip>
              {editMode && (
                <button className="btn-soft" style={{ padding: '4px 12px', fontSize: 12.5 }}
                  onClick={() => NO_API_CATS.includes(cat.id)
                    ? addHolding(cat.id)
                    : setAddingCat(c => (c === cat.id ? null : cat.id))}>
                  + Add
                </button>
              )}
              <span className="hold-total">
                <span className="mono">{sym}{totalVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                <span className={'mono ' + (totalPnl < 0 ? 'down' : totalPnl > 0 ? 'up' : 'flat')}>
                  {' '}· {totalPnl >= 0 ? '+' : '-'}{Math.abs(totalPnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </span>
            </div>

            <div className="hold-table">
              {items.length > 0 && (
                <div className={'hold-row hold-row-header' + (editMode ? ' editing' : '')}>
                  <span>Ticker / name</span>
                  <span className="num"><Term tip="How many units you own. Zero means it's on the watchlist — planned but not bought yet.">Qty</Term></span>
                  <span className="num"><Term tip="The average price you paid per unit.">Avg cost</Term></span>
                  <span className="num"><Term tip="What one unit is worth right now. Updates automatically for most investments.">Current</Term></span>
                  <span className="num">Value</span>
                  <span className="num">P/L %</span>
                  {editMode && <span></span>}
                </div>
              )}
              {items.map(h => (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  category={cat}
                  onUpdate={updateHolding}
                  onRemove={removeHolding}
                  onToggleTag={toggleTag}
                  editMode={editMode}
                  onTickerClick={setInfoHolding}
                />
              ))}
              {items.length === 0 && (
                <p className="hold-empty">No holdings yet — turn on editing to add one.</p>
              )}
            </div>

            {editMode && addingCat === cat.id && (
              <AddHoldingForm category={cat} onAdd={addHolding} onClose={() => setAddingCat(null)} />
            )}
          </Card>
        );
      })}

      {infoHolding && <TickerModal holding={infoHolding} onClose={() => setInfoHolding(null)} />}
    </div>
  );
}
