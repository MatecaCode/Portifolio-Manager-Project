import { useCallback, useMemo, useRef, useState } from 'react';
import { CATEGORIES } from '../data/portfolio';
import { parseIbkrFile, planIbkrImport, importSummary, ImportError } from '../lib/ibkr';
import { Card, CatDot, Chip, SectionLabel, Term } from './ui';
import { fmt } from '../lib/format';

// Sources are listed with an explicit `live` flag rather than a blanket
// "coming soon" banner, so it's obvious which ones actually do something.
const SOURCES = [
  { id: 'ibkr',        name: 'Interactive Brokers',   icon: '🌐', live: true,  detail: 'Trade Confirmation report (PDF) — updates holdings and average cost' },
  { id: 'wealthfront', name: 'Wealthfront',           icon: '🏛️', detail: 'Savings balance from the account CSV export' },
  { id: 'chase_bank',  name: 'Chase Bank',            icon: '🏦', detail: 'Checking balances — available on the Budget side' },
  { id: 'kraken',      name: 'Kraken',                icon: '🪙', detail: 'Crypto positions and balances from the ledger CSV' },
  { id: 'fidelity',    name: 'Fidelity',              icon: '📈', detail: 'US stock positions from the portfolio CSV' },
  { id: 'b3',          name: 'B3 / Brazilian broker', icon: '🇧🇷', detail: 'Notas de corretagem and position reports' },
];

const catName = id => CATEGORIES.find(c => c.id === id)?.name || id;
const catColor = id => CATEGORIES.find(c => c.id === id)?.color;
const qty = n => n.toLocaleString('en-US', { maximumFractionDigits: 6 });

const STATUS = {
  new:         { label: 'New position', tone: 'up' },
  'first-buy': { label: 'First buy',    tone: 'up' },
  add:         { label: 'Adds to position', tone: 'up' },
  sell:        { label: 'Sell', tone: 'warn' },
  duplicate:   { label: 'Already imported', tone: 'soft' },
};

export default function Import({ holdings = [], reviews = [], importedLots = [], applyTradeImport }) {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const plan = useMemo(
    () => parsed ? planIbkrImport(parsed, { holdings, reviews, importedLots }) : null,
    [parsed, holdings, reviews, importedLots]);
  const summary = plan ? importSummary(plan) : null;

  const handleFile = useCallback(async f => {
    if (!f) return;
    setBusy(true); setError(null); setResult(null); setParsed(null); setFile(f);
    try {
      setParsed(await parseIbkrFile(f));
    } catch (e) {
      setError(e instanceof ImportError ? e.message : `Couldn't read that file: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = e => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer?.files?.[0]);
  };

  const reset = () => { setFile(null); setParsed(null); setError(null); setResult(null); if (inputRef.current) inputRef.current.value = ''; };

  const apply = () => {
    const res = applyTradeImport(plan);
    setResult(res);
    setParsed(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="screen">
      <div className="import-hero">
        <h2>Import from a file</h2>
        <p>
          Drop a broker report here and you'll see exactly what would change —
          nothing is saved until you confirm.
        </p>
      </div>

      {/* ── Dropzone ── */}
      <div
        className={'dropzone' + (dragging ? ' dragging' : '')}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="dz-input"
          onChange={e => handleFile(e.target.files?.[0])} />
        <div className="dropzone-title">{busy ? 'Reading your report…' : 'Drop your IBKR report here'}</div>
        <p>
          Interactive Brokers → <b>Performance &amp; Reports</b> → Trade Confirmations → download as <b>PDF</b>.
        </p>
        <button type="button" className="btn-soft" disabled={busy}
          onClick={() => inputRef.current?.click()}>
          {busy ? 'Reading…' : 'Choose a file'}
        </button>
        {file && !busy && <p className="dz-file mono">{file.name}</p>}
      </div>

      {error && (
        <Card className="import-error">
          <b>Couldn't import that file</b>
          <p>{error}</p>
          <button type="button" className="btn-soft" onClick={reset}>Try another file</button>
        </Card>
      )}

      {result && (
        <Card className="import-done">
          <b>✓ Imported {result.applied} {result.applied === 1 ? 'position' : 'positions'}</b>
          <p>
            {result.created > 0 && <>{result.created} new {result.created === 1 ? 'holding' : 'holdings'} created. </>}
            {result.clearedFromReview > 0 && <>{result.clearedFromReview} cleared from the Review list. </>}
            Check the <b>Holdings</b> tab — prices refresh on the next update.
          </p>
        </Card>
      )}

      {/* ── Preview ── */}
      {plan && summary && (
        <Card>
          <SectionLabel right={
            <>
              {parsed.account && <Chip tone="soft">{parsed.account}</Chip>}
              {parsed.period && <Chip tone="soft">{parsed.period.label}</Chip>}
            </>
          }>
            What this would change
          </SectionLabel>

          <div className="imp-table">
            <div className="imp-row imp-head">
              <span>Investment</span>
              <span>Goes to</span>
              <span className="imp-num">Quantity</span>
              <span className="imp-num">
                <Term tip="The per-share cost including commission — this is what IBKR shows as your average price, so the two match.">Cost / share</Term>
              </span>
              <span className="imp-num">Amount</span>
              <span>Effect</span>
            </div>

            {plan.map(r => {
              const st = STATUS[r.status] || STATUS.add;
              const dim = r.status === 'duplicate';
              return (
                <div className={'imp-row' + (dim ? ' imp-dim' : '')} key={r.key + r.symbol}>
                  <span className="imp-sym">
                    <span className="mono imp-tick">{r.symbol}</span>
                    <span className="imp-name">{r.name}</span>
                    {r.fromReview && !dim && <Chip tone="soft" title="This was on your Review shortlist — importing clears it from there.">from Review</Chip>}
                  </span>
                  <span className="imp-cat">
                    <CatDot color={catColor(r.category)} size={9} /> {catName(r.category)}
                  </span>
                  <span className="imp-num mono">{qty(Math.abs(dim ? r.qty : r.netQty))}</span>
                  <span className="imp-num mono">{fmt(r.unitCost)}</span>
                  <span className="imp-num mono">{fmt(Math.abs(dim ? r.qty : r.netQty) * r.unitCost)}</span>
                  <span className="imp-effect">
                    <Chip tone={st.tone}>{st.label}</Chip>
                    {r.status === 'add' && (
                      <span className="imp-sub">
                        {qty(r.existingShares)} → {qty(r.existingShares + r.netQty)} sh
                      </span>
                    )}
                    {dim && <span className="imp-sub">skipped</span>}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="imp-foot">
            <div className="imp-totals">
              <span><b>{summary.applying}</b> to apply</span>
              {summary.duplicates > 0 && <span>· {summary.duplicates} already imported</span>}
              {summary.newPositions > 0 && <span>· {summary.newPositions} new</span>}
              <span>· <b className="mono">{fmt(summary.cash)}</b> invested</span>
              {parsed.totalComm > 0 && <span className="imp-sub">(incl. {fmt(parsed.totalComm)} commission)</span>}
            </div>
            <span className="rev-spacer" />
            <button type="button" className="btn-soft" onClick={reset}>Cancel</button>
            <button type="button" className="btn-soft on" disabled={summary.applying === 0} onClick={apply}>
              {summary.applying === 0 ? 'Nothing new to import' : `Apply ${summary.applying} to my portfolio`}
            </button>
          </div>

          {summary.duplicates > 0 && (
            <p className="reb-tip imp-note">
              Rows marked <i>already imported</i> were applied from a previous upload of this
              same statement period, so they're skipped — importing twice won't double your position.
            </p>
          )}
          <p className="reb-tip imp-note">
            Cash balances aren't touched — a trade confirmation doesn't state your account
            balance. Update Interactive Brokers under <b>Overview → Accounts</b>.
          </p>
        </Card>
      )}

      {/* ── Sources ── */}
      <SectionLabel>Where you can import from</SectionLabel>
      <div className="import-grid">
        {SOURCES.map(s => (
          <Card className={'import-card' + (s.live ? ' import-live' : '')} key={s.id}>
            <div className="import-icon">{s.icon}</div>
            <div className="import-name">
              {s.name} {s.live ? <Chip tone="up">LIVE</Chip> : <Chip tone="soft">soon</Chip>}
            </div>
            <p className="import-note">{s.detail}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
