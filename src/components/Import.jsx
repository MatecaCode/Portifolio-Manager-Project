import { useCallback, useMemo, useRef, useState } from 'react';
import { CATEGORIES } from '../data/portfolio';
import { parseIbkrFile, planIbkrImport, importSummary, ImportError } from '../lib/ibkr';
import { parseWealthfrontCash, findWealthfrontAccount, WealthfrontError } from '../lib/wealthfront';
import { Card, CatDot, Chip, SectionLabel, Term } from './ui';
import { fmt } from '../lib/format';

// Sources are listed with an explicit `live` flag rather than a blanket
// "coming soon" banner, so it's obvious which ones actually do something.
const SOURCES = [
  { id: 'ibkr',        name: 'Interactive Brokers',   icon: '🌐', live: true, detail: 'Trade Confirmation report (PDF) — updates holdings and average cost' },
  { id: 'wealthfront', name: 'Wealthfront',           icon: '🏛️', live: true, detail: 'Cash Account CSV — updates your emergency-savings balance' },
  { id: 'chase_bank',  name: 'Chase Bank',            icon: '🏦', detail: 'Checking balances — available on the Budget side' },
  { id: 'kraken',      name: 'Kraken',                icon: '🪙', detail: 'Crypto positions and balances from the ledger CSV' },
  { id: 'fidelity',    name: 'Fidelity',              icon: '📈', detail: 'US stock positions from the portfolio CSV' },
  { id: 'b3',          name: 'B3 / Brazilian broker', icon: '🇧🇷', detail: 'Notas de corretagem and position reports' },
];

const prettyDate = d => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';

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

export default function Import({ holdings = [], reviews = [], importedLots = [], applyTradeImport, accounts = [], upsertAccountValue }) {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const isTrades = parsed?.source === 'ibkr';
  const plan = useMemo(
    () => isTrades ? planIbkrImport(parsed, { holdings, reviews, importedLots }) : null,
    [isTrades, parsed, holdings, reviews, importedLots]);
  const summary = plan ? importSummary(plan) : null;

  // Which account a Wealthfront balance would land on, and what it'd replace.
  const wfAccount = parsed?.kind === 'wealthfront' ? findWealthfrontAccount(accounts) : null;

  // Route by file type: PDF is a broker report, CSV is a cash statement.
  const handleFile = useCallback(async f => {
    if (!f) return;
    setBusy(true); setError(null); setResult(null); setParsed(null); setFile(f);
    try {
      if (/\.csv$/i.test(f.name)) {
        setParsed(parseWealthfrontCash(await f.text()));
      } else if (/\.pdf$/i.test(f.name)) {
        setParsed(await parseIbkrFile(f));
      } else {
        throw new ImportError(`"${f.name}" isn't a supported file. Drop an Interactive Brokers PDF or a Wealthfront CSV.`);
      }
    } catch (e) {
      setError(e instanceof ImportError || e instanceof WealthfrontError
        ? e.message : `Couldn't read that file: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = e => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer?.files?.[0]);
  };

  // Accept a drop anywhere on the tab, not just inside the dashed box — people
  // aim at the source card they recognise, or just at the page.
  const pageDrag = {
    onDragOver: e => { e.preventDefault(); setDragging(true); },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); },
    onDrop,
  };
  const pickFile = () => inputRef.current?.click();

  const reset = () => { setFile(null); setParsed(null); setError(null); setResult(null); if (inputRef.current) inputRef.current.value = ''; };

  const apply = () => {
    let res;
    if (isTrades) {
      res = applyTradeImport(plan);
    } else {
      upsertAccountValue({
        id: wfAccount?.id || 'wealthfront',
        label: wfAccount?.label || 'Wealthfront (Joint)',
        note: wfAccount?.note || 'Emergency fund',
        apy: wfAccount?.apy ?? null,
        value: parsed.balance,
      });
      res = { cash: true, balance: parsed.balance, was: wfAccount?.value ?? 0 };
    }
    setResult(res);
    setParsed(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="screen" {...pageDrag}>
      <div className="import-hero">
        <h2>Import from a file</h2>
        <p>
          Drop a broker report anywhere on this page and you'll see exactly what
          would change — nothing is saved until you confirm.
        </p>
      </div>

      {/* The file input lives outside the dropzone so the source cards below
          can trigger it too. */}
      <input ref={inputRef} type="file" accept=".pdf,application/pdf,.csv,text/csv" className="dz-input"
        onChange={e => handleFile(e.target.files?.[0])} />

      {/* ── Dropzone ── */}
      <button type="button" className={'dropzone' + (dragging ? ' dragging' : '')}
        onClick={pickFile} disabled={busy}>
        <div className="dropzone-title">{busy ? 'Reading your file…' : 'Drop a broker or bank file here'}</div>
        <p>
          <b>IBKR trades</b> — Performance &amp; Reports → Trade Confirmations → <b>PDF</b>.<br />
          <b>Wealthfront savings</b> — Cash Account → Transactions → Download <b>CSV</b>.
        </p>
        <span className="btn-soft dz-btn">{busy ? 'Reading…' : 'Choose a file'}</span>
        {file && !busy && <p className="dz-file mono">{file.name}</p>}
      </button>

      {error && (
        <Card className="import-error">
          <b>Couldn't import that file</b>
          <p>{error}</p>
          <button type="button" className="btn-soft" onClick={reset}>Try another file</button>
        </Card>
      )}

      {result && (result.cash ? (
        <Card className="import-done">
          <b>✓ Wealthfront balance updated to {fmt(result.balance)}</b>
          <p>
            Was {fmt(result.was)} — a change of {fmt(result.balance - result.was)}. It counts as
            cash toward net worth on the <b>Overview</b> tab, and stays out of your investment mix.
          </p>
        </Card>
      ) : (
        <Card className="import-done">
          <b>✓ Imported {result.applied} {result.applied === 1 ? 'position' : 'positions'}</b>
          <p>
            {result.created > 0 && <>{result.created} new {result.created === 1 ? 'holding' : 'holdings'} created. </>}
            {result.clearedFromReview > 0 && <>{result.clearedFromReview} cleared from the Review list. </>}
            Check the <b>Holdings</b> tab — prices refresh on the next update.
          </p>
        </Card>
      ))}

      {/* ── Wealthfront preview: a balance, not a set of positions ── */}
      {parsed?.kind === 'wealthfront' && (
        <Card>
          <SectionLabel right={
            <Chip tone="soft">{prettyDate(parsed.periodStart)} – {prettyDate(parsed.periodEnd)}</Chip>
          }>
            What this would change
          </SectionLabel>

          <div className="wf-headline">
            <div>
              <div className="wf-label">{wfAccount?.label || 'Wealthfront (Joint)'} — balance now</div>
              <div className="wf-was mono">{fmt(wfAccount?.value ?? 0)}</div>
            </div>
            <span className="wf-arrow">→</span>
            <div>
              <div className="wf-label">After importing</div>
              <div className="wf-now mono">{fmt(parsed.balance)}</div>
            </div>
            <span className="rev-spacer" />
            <Chip tone={parsed.balance >= (wfAccount?.value ?? 0) ? 'up' : 'warn'}>
              {parsed.balance >= (wfAccount?.value ?? 0) ? '+' : ''}{fmt(parsed.balance - (wfAccount?.value ?? 0))}
            </Chip>
          </div>

          <div className="wf-stats">
            <div><div className="rs-label">Transactions</div><div className="rs-val mono">{parsed.count}</div></div>
            <div><div className="rs-label">Deposits in</div><div className="rs-val mono up">{fmt(parsed.deposits)}</div></div>
            <div><div className="rs-label">Withdrawals</div><div className="rs-val mono down">{fmt(parsed.withdrawals)}</div></div>
            <div>
              <div className="rs-label"><Term tip="Interest this account has paid you over the period in the file — the emergency fund earning its keep.">Interest earned</Term></div>
              <div className="rs-val mono up">{fmt(parsed.interest)}</div>
            </div>
          </div>

          <div className="imp-foot">
            <span className="imp-totals">
              Balance is the sum of every transaction in the file, so this needs the
              <b> All time</b> export — a partial one would understate it.
            </span>
            <span className="rev-spacer" />
            <button type="button" className="btn-soft" onClick={reset}>Cancel</button>
            <button type="button" className="btn-soft on" onClick={apply}>
              Set balance to {fmt(parsed.balance)}
            </button>
          </div>

          <p className="reb-tip imp-note">
            Savings are <b>not</b> part of the investment allocation — no target %, no rebalancing.
            It shows up as cash in net worth on Overview, next to what you have invested.
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

      {/* ── Sources ──
          A live source is a real button that opens the picker, because a card
          that lifts on hover reads as clickable and has to actually be
          clickable. The ones that aren't wired up yet are inert <div>s so they
          don't make the same promise. */}
      <SectionLabel>Where you can import from</SectionLabel>
      <div className="import-grid">
        {SOURCES.map(s => s.live ? (
          <button type="button" className="card import-card import-live" key={s.id}
            onClick={pickFile} disabled={busy}
            title="Choose an Interactive Brokers PDF to import">
            <div className="import-icon">{s.icon}</div>
            <div className="import-name">{s.name} <Chip tone="up">LIVE</Chip></div>
            <p className="import-note">{s.detail}</p>
            <span className="import-cta">Choose a file →</span>
          </button>
        ) : (
          <div className="card import-card import-soon" key={s.id}>
            <div className="import-icon">{s.icon}</div>
            <div className="import-name">{s.name} <Chip tone="soft">soon</Chip></div>
            <p className="import-note">{s.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
