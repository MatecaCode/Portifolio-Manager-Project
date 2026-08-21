import { useMemo, useRef, useState } from 'react';
import { Card, Chip, Donut, SectionLabel, Term } from './ui';
import { fmt, fmt0 } from '../lib/format';
import { CATEGORY_GROUPS, HOUSE_EXPENSE_CATEGORIES, catById, categoriesFor, isHouseCategory, PERSONAL } from '../data/house';
import { PROPERTY_DEFAULTS } from '../data/property';
import { parseStatement, isCashAccount } from '../lib/statements';
import Accounts from './Accounts';
import TaxReport from './TaxReport';
import Rules, { RuleWizard } from './Rules';

// The Rental platform — the Texas house, carved out of the commingled joint
// accounts and turned into a Schedule E year-end report.
//
// Household spending is NOT tracked here (Rocket Money does that). A statement
// is imported for exactly two reasons: to find the handful of lines that belong
// to the rental, and to capture the account's closing balance for net worth.
// Everything else stays 👤 Personal and is never totalled, budgeted or charted.
// See AIRBNB_MODULE_PLAN.md.

// Category picker for a transaction row. Grouped, because "is this the rental?"
// reads better as two labelled blocks than as one flat list.
function CategorySelect({ value, kind, onChange, className = 'tx-cat', title }) {
  const options = categoriesFor(kind);
  return (
    <select className={className} value={isHouseCategory(value) ? value : PERSONAL} title={title}
      onClick={e => e.stopPropagation()} onChange={e => onChange(e.target.value)}>
      {CATEGORY_GROUPS.map(g => {
        const inGroup = options.filter(c => c.group === g.id);
        if (!inGroup.length) return null;
        return (
          <optgroup label={g.label} key={g.id}>
            {inGroup.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}

// Per-account-kind labels + emoji, shared by the import preview and the
// statements list so a new source only needs adding in one place.
const KIND_META = {
  card:     { emoji: '💳', label: 'Chase credit card',    profile: 'Chase Card',          sub: 'credit card' },
  checking: { emoji: '🏦', label: 'Chase checking',       profile: 'Chase Checking',      sub: 'checking' },
  savings:  { emoji: '🏛️', label: 'Wealthfront savings',  profile: 'Wealthfront Savings', sub: 'savings' },
};
const kindMeta = k => KIND_META[k] || { emoji: '🧾', label: 'Account', profile: 'Account', sub: 'account' };

const STEPS = [
  { emoji: '📄', title: '1 · Drop in a statement', text: 'Upload a Chase card or checking statement (PDF or CSV) or a Wealthfront savings export (CSV). It’s read right here in your browser, so the file never leaves the page.' },
  { emoji: '🏡', title: '2 · Pull out the house', text: 'The mortgage servicer and the hosting fees file themselves. Search the rest for anything that was really the rental — a plumber, a Home Depot run — and file it in one tap. Everything else stays personal.' },
  { emoji: '🧮', title: '3 · Get the tax picture', text: 'Every House bucket is a Schedule E line, so filing a transaction IS the tax classification. Add the 1098 and escrow figures once a year and the report writes itself.' },
];

const yearOf = d => d.slice(0, 4);
const SEARCH_LIMIT = 60;

function summarizeParsed(parsed) {
  const n = { expense: 0, income: 0, transfer: 0 };
  let house = 0;
  for (const t of parsed.transactions) {
    n[t.kind]++;
    if (isHouseCategory(t.category)) house++;
  }
  return { ...n, house };
}

// One transaction row, used by the review box, the bucket drill-down and the
// search results. `onFile` files it; the two buttons teach a lasting rule that
// outlives this one line.
function TxRow({ b, t, onFile, onSeedRule, extra, className = '' }) {
  const acc = b.accounts.find(a => a.id === t.accountId);
  return (
    <div className={'txrow ' + className}>
      <span className="mono tx-date">{t.date}</span>
      <span title={acc?.name}>{acc?.emoji}</span>
      <span className="tx-desc">{t.desc}</span>
      <span className={'mono tx-amt' + (t.kind === 'income' ? ' up' : '')}>{fmt(t.amount)}</span>
      <CategorySelect value={t.category} kind={t.kind}
        title="Is this the rental? Pick the House bucket it belongs to — that bucket is its Schedule E line."
        onChange={v => onFile(t, v)} />
      <button className="btn-soft tx-rule-btn" title={`Always file "${t.desc.slice(0, 30)}" the same way — re-files this merchant's past lines too`}
        onClick={e => { e.stopPropagation(); b.recategorizeMerchant(t.desc, t.category || PERSONAL); }}>🧠 Always</button>
      <button className="btn-soft tx-rule-btn" title="Make a reusable rule from this transaction"
        onClick={e => { e.stopPropagation(); onSeedRule({ desc: t.desc, category: t.category }); }}>✨ Rule</button>
      {extra}
    </div>
  );
}

export default function Rental({ b, portfolioAccounts = [], syncAccountValue }) {
  const fileRef = useRef(null);
  const [pending, setPending] = useState([]);   // parsed statements awaiting confirm
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastImport, setLastImport] = useState(null);
  const [view, setView] = useState('ledger');   // 'ledger' | 'taxes' | 'rules' | 'accounts'
  const [yearSel, setYearSel] = useState(null); // null = latest with activity
  const [openCat, setOpenCat] = useState(null);
  const [query, setQuery] = useState('');       // "find the house's transactions"
  const [ruleSeed, setRuleSeed] = useState(null); // open the rule wizard from a transaction

  const property = b.properties[0] || null;

  // ── the rental's own transactions, by tax year ──
  const houseTxs = useMemo(
    () => b.transactions.filter(t => isHouseCategory(t.category)),
    [b.transactions]);

  const years = useMemo(() => {
    const s = new Set(houseTxs.map(t => yearOf(t.date)));
    s.add(String(new Date().getFullYear()));
    return [...s].sort().reverse();
  }, [houseTxs]);
  const year = yearSel && years.includes(yearSel) ? yearSel : years[0];

  const scoped = useMemo(
    () => year === 'all' ? houseTxs : houseTxs.filter(t => yearOf(t.date) === year),
    [houseTxs, year]);

  const pl = useMemo(() => {
    const income = scoped.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0);
    const spent = scoped.filter(t => t.kind === 'expense').reduce((a, t) => a + t.amount, 0);
    return { count: scoped.length, income, spent, net: income - spent };
  }, [scoped]);

  // Costs by House bucket — the same rows the Schedule E report reads.
  const catRows = useMemo(() => {
    const m = {};
    for (const t of scoped) if (t.kind === 'expense') m[t.category] = (m[t.category] || 0) + t.amount;
    return HOUSE_EXPENSE_CATEGORIES
      .map(c => ({ ...c, spent: m[c.id] || 0 }))
      .filter(c => c.spent !== 0)
      .sort((a, z) => z.spent - a.spent);
  }, [scoped]);

  // Lines flagged as ambiguous (e.g. a family member's Zelle) that nothing will
  // auto-decide — surfaced at the top so they're never missed.
  const reviewRows = useMemo(
    () => b.transactions.filter(t => t.reviewFlag).sort((a, z) => z.date.localeCompare(a.date)),
    [b.transactions]);

  // ── "find the house's transactions": search everything not yet filed ──
  // Deliberately searches ALL time, not just the selected year — a receipt you
  // remember from March is easier to find by name than by date.
  const unfiled = useMemo(
    () => b.transactions.filter(t => t.kind !== 'transfer' && !isHouseCategory(t.category) && !t.reviewFlag),
    [b.transactions]);
  const q = query.trim().toUpperCase();
  const searchRows = useMemo(() => {
    const rows = q.length < 2 ? unfiled : unfiled.filter(t => t.desc.toUpperCase().includes(q));
    return [...rows].sort((a, z) => z.date.localeCompare(a.date));
  }, [unfiled, q]);

  // ── file handling ──
  async function handleFiles(fileList) {
    const files = [...fileList].filter(f => /\.(pdf|csv)$/i.test(f.name));
    if (!files.length) return;
    setBusy(true);
    setLastImport(null);
    const results = [];
    for (const f of files) {
      try {
        const parsed = await parseStatement(f);
        results.push({ id: Math.random().toString(36).slice(2), parsed });
      } catch (e) {
        results.push({ id: Math.random().toString(36).slice(2), error: e.message, fileName: f.name });
      }
    }
    setPending(p => [...p, ...results]);
    setBusy(false);
  }

  function confirmImport(item) {
    const res = b.importStatement(item.parsed);
    if (res.duplicateStatement) {
      setPending(p => p.map(x => x.id === item.id ? { ...x, error: 'This exact file was already imported (same account + same end date). Any new transactions in an overlapping export are still de-duplicated automatically. 🔒' } : x));
      return;
    }
    setPending(p => p.filter(x => x.id !== item.id));
    setLastImport(res);
    setYearSel(null);

    // Auto-update the linked portfolio cash account with this statement's
    // closing balance — but only if it's the newest statement we hold for
    // the account (so re-importing an old month never rolls net worth back).
    if (isCashAccount(res.kind) && res.endingBalance != null && syncAccountValue) {
      const acct = b.accounts.find(a => a.id === res.accountId);
      const newerExists = b.statements.some(
        s => s.accountId === res.accountId && s.endingBalance != null && s.periodEnd > res.periodEnd);
      if (acct?.portfolioAccountId && !newerExists) {
        syncAccountValue(acct.portfolioAccountId, res.endingBalance);
      }
    }
  }

  // Link a bank account to a portfolio cash account and push its latest balance
  // over immediately so the two sides agree from the first click. When the link
  // moves to a different account (or is removed), zero out the previously-linked
  // one so its copied balance doesn't linger as a phantom duplicate in net worth.
  function handleLinkChange(bankAccountId, portfolioAccountId) {
    const prevId = b.accounts.find(a => a.id === bankAccountId)?.portfolioAccountId || null;
    b.linkAccount(bankAccountId, portfolioAccountId);
    if (!syncAccountValue) return;
    if (prevId && prevId !== portfolioAccountId) syncAccountValue(prevId, 0);
    if (portfolioAccountId) {
      const bal = b.accountBalance(bankAccountId);
      if (bal != null) syncAccountValue(portfolioAccountId, bal);
    }
  }

  const hasData = b.transactions.length > 0;

  const dropzone = (
    <div
      className={'dropzone budget-dropzone' + (dragOver ? ' drop-over' : '')}
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      role="button" tabIndex={0}
    >
      <div className="dropzone-title">{busy ? <span><span className="spin">⟳</span> Reading your statement…</span> : 'Drop a statement here 📄'}</div>
      <p>Chase card or checking (PDF or CSV) and Wealthfront savings (CSV). Click to browse. Parsed in your browser, previewed before anything is saved.</p>
      <input ref={fileRef} type="file" accept=".pdf,application/pdf,.csv,text/csv" multiple hidden
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );

  const setupCard = (
    <Card className="airbnb-setup">
      <SectionLabel>Set up the rental 🏡</SectionLabel>
      <p className="reb-tip" style={{ marginBottom: 14 }}>
        Create the property and the House buckets start feeding a Schedule E summary —
        depreciation, the mortgage split and a suggested set-aside. Filing a transaction
        into a House bucket is the only tagging there is.
      </p>
      <div className="pending-stats">
        <Chip tone="soft">🏡 {PROPERTY_DEFAULTS.name}</Chip>
        <Chip tone="soft">📍 {PROPERTY_DEFAULTS.state}</Chip>
        <Chip tone="soft">🗓️ In service {PROPERTY_DEFAULTS.placedInService}</Chip>
        <Chip tone="soft">🏦 {fmt0(PROPERTY_DEFAULTS.purchasePrice)} purchase</Chip>
      </div>
      <div className="pending-actions" style={{ marginTop: 14 }}>
        <button className="btn-soft on" onClick={() => b.addProperty()}>
          ✓ Create {PROPERTY_DEFAULTS.name}
        </button>
      </div>
    </Card>
  );

  if (!b.ready) return <div className="screen"><p className="hold-empty">Loading the rental…</p></div>;

  return (
    <div className="screen">
      {ruleSeed && <RuleWizard b={b} seed={ruleSeed} onClose={() => setRuleSeed(null)} />}
      <div className="import-hero">
        <h2>The house in Texas 🏡</h2>
        <p>
          The same joint accounts pay for the apartment, the house and everything else.
          This side carves the rental out of that stream and turns it into a Schedule E
          year-end report. Day-to-day spending isn’t tracked here — that’s Rocket Money’s job.
        </p>
        <div className="celebrate-row" style={{ marginBottom: 0 }}>
          {b.syncStatus === 'synced' && <Chip tone="soft">☁ Synced for both of you</Chip>}
          {b.syncStatus === 'local' && <Chip tone="warn">☁ Saved on this device only</Chip>}
          {lastImport && <Chip tone="soft">✅ Imported {lastImport.added} transactions{lastImport.dupes ? ` · ${lastImport.dupes} duplicates skipped` : ''}{lastImport.tagged ? ` · ${lastImport.tagged} auto-filed to the house` : ''}</Chip>}
        </div>
      </div>

      {/* pending previews */}
      {pending.map(item => item.error ? (
        <Card key={item.id} className="pending-card">
          <div className="edit-warning">⚠️ {item.fileName ? `${item.fileName}: ` : ''}{item.error}</div>
          <div className="pending-actions">
            <button className="btn-soft" onClick={() => setPending(p => p.filter(x => x.id !== item.id))}>Dismiss</button>
          </div>
        </Card>
      ) : (
        <PendingPreview key={item.id} item={item} accounts={b.accounts}
          onConfirm={() => confirmImport(item)}
          onCancel={() => setPending(p => p.filter(x => x.id !== item.id))} />
      ))}

      {!hasData && (
        <>
          {dropzone}
          <Card>
            <SectionLabel>How it works</SectionLabel>
            <div className="story-grid">
              {STEPS.map(s => (
                <div className="story-cell" key={s.title}>
                  <span className="story-emoji">{s.emoji}</span>
                  <div>
                    <div className="budget-step-title">{s.title}</div>
                    <p className="story-text">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {!property && setupCard}
        </>
      )}

      {hasData && (
        <>
          <div className="cf-toggle">
            <button className={'cf-toggle-btn' + (view === 'ledger' ? ' active' : '')} onClick={() => setView('ledger')}>
              🏡 The house{reviewRows.length > 0 && <span className="cf-review-flag"> · 🔍 {reviewRows.length}</span>}
            </button>
            <button className={'cf-toggle-btn' + (view === 'taxes' ? ' active' : '')} onClick={() => setView('taxes')}>🧮 Taxes</button>
            <button className={'cf-toggle-btn' + (view === 'rules' ? ' active' : '')} onClick={() => setView('rules')}>
              🧠 Rules{b.smartRules.length > 0 && <span className="cf-rule-count"> · {b.smartRules.length}</span>}
            </button>
            <button className={'cf-toggle-btn' + (view === 'accounts' ? ' active' : '')} onClick={() => setView('accounts')}>🏦 Accounts</button>
          </div>

          {view === 'taxes' && (property ? <TaxReport key={property.id} b={b} property={property} /> : setupCard)}

          {view === 'rules' && <Rules b={b} />}

          {view === 'accounts' && (
            <>
              <Accounts b={b} portfolioAccounts={portfolioAccounts} onLinkChange={handleLinkChange} />
              <Card>
                <SectionLabel>Add more data</SectionLabel>
                {dropzone}
                {b.statements.length > 0 && (
                  <details className="st-list">
                    <summary>{b.statements.length} statement{b.statements.length > 1 ? 's' : ''} imported</summary>
                    {b.statements.map(s => {
                      const acc = b.accounts.find(a => a.id === s.accountId);
                      return (
                        <div className="st-row" key={s.id}>
                          <span>{acc?.emoji} {acc?.name}</span>
                          <span className="mono st-period">{s.periodStart} → {s.periodEnd}</span>
                          <span className="mono">{s.txCount} txs</span>
                          <button className="hold-del" title="Remove this statement and its transactions"
                            onClick={() => { if (confirm('Remove this statement and all its transactions?')) b.removeStatement(s.id); }}>✕</button>
                        </div>
                      );
                    })}
                  </details>
                )}
              </Card>
            </>
          )}

          {view === 'ledger' && (
            <>
              {!property && setupCard}

              {/* tax year */}
              <div className="month-row">
                {years.map(y => (
                  <button key={y} className={'month-chip' + (year === y ? ' active' : '')} onClick={() => setYearSel(y)}>{y}</button>
                ))}
                <button className={'month-chip' + (year === 'all' ? ' active' : '')} onClick={() => setYearSel('all')}>All time</button>
              </div>

              {/* the rental's cash flow */}
              <Card className="hero">
                <div>
                  <div className="hero-greeting">
                    {property ? `${property.emoji} ${property.name}` : '🏡 The house'} · {year === 'all' ? 'all time' : year}
                  </div>
                  <div className="hero-networth">
                    <Term tip="Rent that landed in the account minus the house costs filed against it. This is cash in vs. cash out — depreciation and the mortgage split live in the Taxes view.">
                      {pl.net < 0 ? 'Net cash loss' : 'Net cash flow'}
                    </Term>
                    <div className={'hero-amount' + (pl.net < 0 ? ' down' : '')}>{fmt0(pl.net)}</div>
                  </div>
                  <div className="airbnb-pl">
                    <div className="airbnb-pl-row"><span>💰 Rent in</span><strong className="mono up">{fmt0(pl.income)}</strong></div>
                    <div className="airbnb-pl-row"><span>🧾 Costs out</span><strong className="mono">{fmt0(pl.spent)}</strong></div>
                    <div className="airbnb-pl-row total"><span>🏷️ Lines filed</span><strong className="mono">{pl.count}</strong></div>
                  </div>
                  <div className="hero-goal-note">
                    Cash in vs. cash out. Depreciation, the mortgage split and the set-aside
                    estimate live in the <button className="drill-open" type="button" onClick={() => setView('taxes')}>Schedule E view →</button>
                  </div>
                </div>
                <div className="hero-right budget-donut-wrap">
                  {catRows.length > 0
                    ? <Donut
                        slices={catRows.map(c => ({ id: c.id, name: c.name, color: c.color, value: c.spent }))}
                        size={163}
                        centerTop={fmt0(pl.spent)}
                        centerBottom="costs out"
                      />
                    : <div className="hold-empty">Nothing filed to the house for {year === 'all' ? 'any year' : year} yet — find it below.</div>}
                </div>
              </Card>

              {/* needs manual review — merchants flagged "it depends" */}
              {reviewRows.length > 0 && (
                <Card className="airbnb-review-card">
                  <SectionLabel right={<Chip tone="warn">{reviewRows.length} to review</Chip>}>Needs manual review 🔍</SectionLabel>
                  <p className="reb-tip" style={{ marginBottom: 10 }}>
                    These come from merchants you flagged as &ldquo;it depends&rdquo; (like family). Nothing
                    is guessed for them — file this one and it’s done. New lines from the same
                    merchant keep landing here until you stop reviewing it.
                  </p>
                  <div className="cat-expand" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                    {reviewRows.map(t => (
                      <TxRow key={t.id} b={b} onSeedRule={setRuleSeed} t={t} className="airbnb-review-row"
                        onFile={(tx, v) => b.resolveReview(tx.id, v)}
                        extra={
                          <button className="hold-del" title="Stop reviewing this merchant — let it auto-file again"
                            onClick={() => b.setMerchantReview(t.desc, false)}>✕</button>
                        } />
                    ))}
                  </div>
                </Card>
              )}

              {/* costs by Schedule E bucket */}
              <Card>
                <SectionLabel right={<Chip tone="soft">{catRows.length} bucket{catRows.length === 1 ? '' : 's'}</Chip>}>
                  Where the house’s money went
                </SectionLabel>
                <div className="cat-list">
                  {catRows.map(c => {
                    const open = openCat === c.id;
                    const catTxs = open
                      ? scoped.filter(t => t.category === c.id && t.kind === 'expense').sort((a, z) => z.date.localeCompare(a.date))
                      : [];
                    return (
                      <div key={c.id}>
                        <div className="cat-row clickable" onClick={() => setOpenCat(open ? null : c.id)} title="Click to see every transaction">
                          <span className="budget-cat-emoji">{c.emoji}</span>
                          <div className="cat-name">
                            {c.name}
                            <span className="cat-sub">
                              {c.blurb ? c.blurb : `Schedule E · ${c.scheduleE.replace(/_/g, ' ')}`}
                            </span>
                          </div>
                          <div className="cat-vals">
                            <div className="cat-value">{fmt0(c.spent)}</div>
                            <div className="cat-pl flat">{pl.spent ? Math.round(c.spent / pl.spent * 100) : 0}% of costs</div>
                          </div>
                        </div>
                        {open && (
                          <div className="cat-expand">
                            {catTxs.map(t => (
                              <TxRow key={t.id} b={b} onSeedRule={setRuleSeed} t={t} className="txrow-spend"
                                onFile={(tx, v) => b.recategorize(tx.id, v)} />
                            ))}
                            {!catTxs.length && <div className="hold-empty">Nothing here for this year.</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!catRows.length && <div className="hold-empty">No house costs filed for this year yet.</div>}
                </div>
                {pl.income > 0 && (
                  <p className="reb-tip" style={{ marginTop: 12 }}>
                    💰 {fmt0(pl.income)} of rent came in over the same period — Airbnb payouts file themselves.
                  </p>
                )}
              </Card>

              {/* find the house's transactions in the commingled stream */}
              <Card>
                <SectionLabel right={<Chip tone="soft">{unfiled.length} personal lines</Chip>}>Find the house’s transactions 🔎</SectionLabel>
                <p className="reb-tip" style={{ marginBottom: 10 }}>
                  Everything below is filed as personal. Search for the plumber, the hardware
                  store, the utility — then file it into a House bucket. Use <strong>🧠 Always</strong> to
                  teach that merchant once, or <strong>✨ Rule</strong> to write the logic yourself.
                </p>
                <input className="rw-input" value={query} placeholder="Search descriptions — e.g. OCTOPUS, HOME DEPOT, ZELLE"
                  onChange={e => setQuery(e.target.value)} />
                <div className="cat-expand" style={{ marginTop: 10 }}>
                  {searchRows.slice(0, SEARCH_LIMIT).map(t => (
                    <TxRow key={t.id} b={b} onSeedRule={setRuleSeed} t={t} className="txrow-spend"
                      onFile={(tx, v) => b.recategorize(tx.id, v)}
                      extra={
                        <button className="hold-del" title="Never guess this merchant — send every line from it to manual review"
                          onClick={() => b.setMerchantReview(t.desc, true)}>🔍</button>
                      } />
                  ))}
                  {!searchRows.length && <div className="hold-empty">Nothing matches “{query}”.</div>}
                  {searchRows.length > SEARCH_LIMIT && (
                    <div className="hold-empty">Showing the {SEARCH_LIMIT} most recent of {searchRows.length} — narrow the search to see the rest.</div>
                  )}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

function PendingPreview({ item, accounts, onConfirm, onCancel }) {
  const p = item.parsed;
  const s = summarizeParsed(p);
  const existing = accounts.find(a => a.last4 === p.last4 && a.kind === p.kind);
  const meta = kindMeta(p.kind);
  const showLast4 = p.last4 && p.last4 !== '????';
  const houseCats = {};
  for (const t of p.transactions) {
    if (!isHouseCategory(t.category)) continue;
    houseCats[t.category] = (houseCats[t.category] || 0) + t.amount;
  }
  return (
    <Card className="pending-card">
      <SectionLabel right={<Chip tone="warn">PREVIEW — nothing saved yet</Chip>}>
        {meta.emoji} {meta.label}{showLast4 ? ` ···${p.last4}` : ''}
      </SectionLabel>
      <p className="reb-tip" style={{ marginBottom: 10 }}>
        {existing
          ? <>Matches your existing profile <strong>{existing.emoji} {existing.name}</strong>.</>
          : <>New profile will be created: <strong>{meta.emoji} {meta.profile}{showLast4 ? ` ···${p.last4}` : ''}</strong> (rename it any time).</>}
        {' '}Statement period <strong className="mono">{p.periodStart} → {p.periodEnd}</strong>.
      </p>
      <div className="pending-stats">
        {s.expense > 0 && <Chip tone="soft">🧾 {s.expense} charges</Chip>}
        {s.income > 0 && <Chip tone="soft">💰 {s.income} deposits</Chip>}
        {s.transfer > 0 && <Chip tone="soft">🔁 {s.transfer} transfers (excluded)</Chip>}
        {s.house > 0 && <Chip tone="soft">🏡 {s.house} auto-filed to the house</Chip>}
        {isCashAccount(p.kind) && p.endingBalance != null && <Chip tone="soft">🏦 Balance {fmt0(p.endingBalance)}</Chip>}
      </div>
      <div className="pending-cats">
        {Object.entries(houseCats).sort((a, z) => z[1] - a[1]).map(([id, amt]) => {
          const c = catById(id);
          return <span className="chip chip-soft" key={id}>{c.emoji} {c.name} · {fmt0(amt)}</span>;
        })}
      </div>
      <div className="pending-actions">
        <button className="btn-soft on" onClick={onConfirm}>✓ Looks right — import</button>
        <button className="btn-soft" onClick={onCancel}>Cancel</button>
      </div>
    </Card>
  );
}
