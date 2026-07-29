import { useRef, useState } from 'react';
import { CATEGORIES, REGIONS, categoryById, holdingCurrency, regionById } from '../data/portfolio';
import { parseTradeConfirmation, positionsFromTrades, tradeId } from '../lib/trades';
import { Card, CatDot, Chip, RegionBadge, SectionLabel, Term } from './ui';

// Sources that don't have a parser yet. IBKR trade confirmations are live; the
// rest still get typed in by hand.
const SOURCES = [
  { id: 'wealthfront', name: 'Wealthfront',          icon: '🏛️', detail: 'Savings balance from the account CSV export' },
  { id: 'chase_bank',  name: 'Chase Bank',            icon: '🏦', detail: 'Checking balances — already live on the Budget tab' },
  { id: 'kraken',      name: 'Kraken',                icon: '🪙', detail: 'Crypto positions and balances from the ledger CSV' },
  { id: 'fidelity',    name: 'Fidelity',              icon: '📈', detail: 'US stock positions from the portfolio CSV' },
  { id: 'b3',          name: 'B3 / Brazilian broker', icon: '🇧🇷', detail: 'Notas de corretagem and position reports' },
  { id: 'other',       name: 'Other',                 icon: '📄', detail: 'Any CSV — map the columns manually' },
];

const fmtQty = n => n.toLocaleString('en-US', { maximumFractionDigits: 5 });
const fmtMoney = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Import({ holdings = [], reviews = [], trades = [], importTrades }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);   // what a successful apply did
  const [parsed, setParsed] = useState(null);   // { fileName, trades, problems, … }
  const [placements, setPlacements] = useState({});

  const holdingFor = ticker => holdings.find(h => (h.ticker || '').toUpperCase() === ticker);
  const candidateFor = ticker => reviews.find(r => (r.ticker || '').toUpperCase() === ticker);

  async function handleFile(file) {
    if (!file) return;
    setBusy(true); setError(null); setResult(null); setParsed(null);
    try {
      const out = await parseTradeConfirmation(file);
      // Preview the whole ledger as it *would* be, so an overlapping report
      // shows the same numbers the apply will write.
      const known = new Set(trades.map(t => t.id || tradeId(t)));
      const fresh = out.trades.filter(t => !known.has(t.id));
      const positions = positionsFromTrades([...trades, ...out.trades])
        .filter(p => out.trades.some(t => t.ticker === p.ticker));

      const place = {};
      for (const p of positions) {
        if (holdingFor(p.ticker)) continue;
        const c = candidateFor(p.ticker);
        place[p.ticker] = { category: c?.category || 'stocks', region: c?.region || p.region || 'us' };
      }
      setPlacements(place);
      setParsed({ fileName: file.name, ...out, fresh, positions });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    const summary = importTrades(parsed.trades, placements);
    setResult({ ...summary, fileName: parsed.fileName, tickers: parsed.positions.length });
    setParsed(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const blocked = parsed?.problems?.length > 0;

  return (
    <div className="screen">
      <div className="import-hero">
        <h2>Import from a file</h2>
        <p>
          Everything is parsed in your browser — the file never leaves this page. You'll see exactly
          what would change before anything is saved, and an import only ever writes{' '}
          <b>quantity</b> and <b>average cost</b>. Your targets, buckets and country stickers are never touched.
        </p>
      </div>

      <Card className="import-live">
        <div className="import-live-head">
          <span className="import-icon">🌐</span>
          <div>
            <div className="import-name">Interactive Brokers — Trade Confirmation</div>
            <p className="import-note">
              In IBKR: <b>Performance &amp; Reports → Statements → Trade Confirmations</b>, then download the PDF.
              Each file covers one trading day; import them as they come and the{' '}
              <Term tip="Every fill you've imported, oldest first. Quantity and average cost are recalculated from it, so importing the same file twice changes nothing.">running average cost</Term>{' '}
              builds itself. Commissions are folded into cost — money spent to own it is part of what it cost.
            </p>
          </div>
          {trades.length > 0 && <Chip tone="soft" title="Fills already in your ledger">{trades.length} fills imported</Chip>}
        </div>

        <div className="dropzone"
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
          onClick={() => fileRef.current?.click()}>
          <div className="dropzone-title">{busy ? 'Reading…' : 'Drop the PDF here, or click to choose'}</div>
          <p>Trade Confirmation Report · PDF</p>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden
            onChange={e => handleFile(e.target.files?.[0])} />
        </div>

        {error && (
          <div className="import-error">
            <b>Couldn't read that file.</b> {error}
          </div>
        )}

        {result && (
          <div className="import-ok">
            <b>✓ Imported {result.fileName}</b> — {result.added} new fill{result.added === 1 ? '' : 's'} across{' '}
            {result.tickers} ticker{result.tickers === 1 ? '' : 's'}.
            {result.created.length > 0 && <> Added to Holdings: <b>{result.created.join(', ')}</b>.</>}
            {result.cleared > 0 && <> Cleared {result.cleared} candidate{result.cleared === 1 ? '' : 's'} from Review — you own {result.cleared === 1 ? 'it' : 'them'} now.</>}
            {result.added === 0 && <> Every fill in this file was already in your ledger, so nothing changed.</>}
          </div>
        )}
      </Card>

      {parsed && (
        <>
          <SectionLabel right={
            <span className="section-label-right">
              <Chip tone={blocked ? 'warn' : 'up'} title="The report's own subtotals and grand total, checked against the parse">
                {blocked ? '⚠ does not reconcile' : '✓ reconciles with the report'}
              </Chip>
              <Chip tone="soft">{parsed.fresh.length} new of {parsed.trades.length} fills</Chip>
            </span>
          }>Preview · {parsed.fileName}</SectionLabel>

          {blocked && (
            <div className="import-error">
              <b>Not applying this one.</b> The parsed fills don't add up to the totals printed on the report,
              which means a row was misread. Applying it would quietly put the wrong quantity in your portfolio.
              <ul>{parsed.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}

          <Card>
            <div className="imp-table">
              <div className="imp-row imp-head">
                <span>Ticker</span>
                <span>Goes to</span>
                <span className="num">Qty now</span>
                <span className="num">Qty after</span>
                <span className="num">Avg cost now</span>
                <span className="num"><Term tip="Weighted average of every fill in the ledger, commission included.">Avg cost after</Term></span>
              </div>
              {parsed.positions.map(p => {
                const held = holdingFor(p.ticker);
                const cand = candidateFor(p.ticker);
                const place = placements[p.ticker];
                const cat = categoryById(held?.category || place?.category);
                const sym = held ? (holdingCurrency(held) === 'BRL' ? 'R$' : '$')
                  : (regionById(place?.region).currency === 'BRL' ? 'R$' : '$');
                return (
                  <div className="imp-row" key={p.ticker}>
                    <span className="imp-tick">
                      <span className="ticker">{p.ticker}</span>
                      {!held && <Chip tone={cand ? 'up' : 'soft'}>{cand ? 'from Review' : 'new'}</Chip>}
                    </span>
                    <span className="imp-goes">
                      {held ? (
                        <><CatDot color={cat?.color} /> {cat?.name} <RegionBadge region={held.region} /></>
                      ) : (
                        <>
                          <select className="rev-select" value={place?.category || 'stocks'}
                            onChange={e => setPlacements(s => ({ ...s, [p.ticker]: { ...s[p.ticker], category: e.target.value } }))}>
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <select className={'region-select region-' + (place?.region || 'us')} value={place?.region || 'us'}
                            onChange={e => setPlacements(s => ({ ...s, [p.ticker]: { ...s[p.ticker], region: e.target.value } }))}>
                            {REGIONS.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}
                          </select>
                        </>
                      )}
                    </span>
                    <span className="num mono">{held ? fmtQty(held.shares || 0) : '—'}</span>
                    <span className="num mono up">{fmtQty(p.shares)}</span>
                    <span className="num mono">{held?.cost ? sym + fmtMoney(held.cost) : '—'}</span>
                    <span className="num mono up">{sym + fmtMoney(p.cost)}</span>
                  </div>
                );
              })}
            </div>

            <div className="imp-actions">
              <span className="imp-summary">
                {parsed.trades.length} fill{parsed.trades.length === 1 ? '' : 's'} ·{' '}
                {parsed.duplicatesCollapsed > 0 && <>{parsed.duplicatesCollapsed} duplicated fractional line{parsed.duplicatesCollapsed === 1 ? '' : 's'} collapsed · </>}
                commission {parsed.grandTotal ? '$' + fmtMoney(Math.abs(parsed.grandTotal.commission)) : '—'} folded into cost
              </span>
              <button type="button" className="btn-soft" onClick={() => setParsed(null)}>Cancel</button>
              <button type="button" className="btn-soft on" disabled={blocked} onClick={apply}>
                ✓ Apply to Holdings
              </button>
            </div>
          </Card>
        </>
      )}

      <SectionLabel>Not wired up yet</SectionLabel>
      <div className="import-grid">
        {SOURCES.map(s => (
          <Card className="import-card" key={s.id}>
            <div className="import-icon">{s.icon}</div>
            <div className="import-name">{s.name}</div>
            <p className="import-note">{s.detail}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
