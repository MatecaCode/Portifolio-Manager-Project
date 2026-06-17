import { useMemo, useRef, useState } from 'react';
import { Card, Chip, Donut, ProgressBar, SectionLabel, Term } from './ui';
import { fmt, fmt0 } from '../lib/format';
import { BUDGET_CATEGORIES, catById } from '../data/budget';
import { parseStatement } from '../lib/statements';
import Cashflow from './Cashflow';
import Airbnb from './Airbnb';

// The Budget platform — the spending-side sibling of the portfolio.
// Drop in a Chase card/checking statement (PDF or CSV, parsed locally in
// the browser), every transaction gets an account profile + category, then
// explore per-account or combined. See CONCEPT.md → "Budget Companion".

const STEPS = [
  { emoji: '💳', title: '1 · Drop in a statement', text: 'Upload a Chase credit card or checking statement — PDF or CSV. It’s read right here in your browser, so the file never leaves the page.' },
  { emoji: '✨', title: '2 · Every dollar gets sorted', text: '"H-E-B #796 ALLEN TX" becomes 🛒 Groceries. Card payments and savings transfers are set aside so nothing is double-counted.' },
  { emoji: '🧠', title: '3 · Explore & combine', text: 'Each card or account gets its own profile. Look at one, pick a few, or combine everything for the full monthly picture.' },
];

const monthOf = tx => tx.date.slice(0, 7);
const monthLabel = ym => new Date(ym + '-15T12:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });
const dayLabel = d => `${d.slice(5, 7)}/${d.slice(8, 10)}`;

function summarizeParsed(parsed) {
  const n = { expense: 0, income: 0, transfer: 0 };
  let spend = 0;
  for (const t of parsed.transactions) {
    n[t.kind]++;
    if (t.kind === 'expense') spend += t.amount;
  }
  return { ...n, spend };
}

export default function Budget({ b, portfolioAccounts = [], syncAccountValue }) {
  const fileRef = useRef(null);
  const [pending, setPending] = useState([]);   // parsed statements awaiting confirm
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastImport, setLastImport] = useState(null);
  const [selected, setSelected] = useState(null); // null = all accounts
  const [month, setMonth] = useState(null);       // null = latest, 'all' = everything
  const [openCat, setOpenCat] = useState(null);
  const [editBudgets, setEditBudgets] = useState(false);
  const [editTotal, setEditTotal] = useState(false);
  const [view, setView] = useState('cashflow');   // 'cashflow' | 'spending' | 'airbnb'

  // ── derived scope ──
  const selectedIds = useMemo(() => {
    const all = new Set(b.accounts.map(a => a.id));
    if (selected === null) return all;
    return new Set([...selected].filter(id => all.has(id)));
  }, [selected, b.accounts]);

  const scopedAll = useMemo(
    () => b.transactions.filter(t => selectedIds.has(t.accountId)),
    [b.transactions, selectedIds]);

  const months = useMemo(() => {
    const s = new Set(scopedAll.map(monthOf));
    return [...s].sort().reverse();
  }, [scopedAll]);

  const activeMonth = month === 'all' ? 'all' : (month && months.includes(month) ? month : months[0]);
  const scoped = useMemo(
    () => activeMonth === 'all' ? scopedAll : scopedAll.filter(t => monthOf(t) === activeMonth),
    [scopedAll, activeMonth]);

  const expenses = useMemo(() => scoped.filter(t => t.kind === 'expense'), [scoped]);
  const totalSpent = expenses.reduce((a, t) => a + t.amount, 0);
  const totalIncome = scoped.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0);
  const transferCount = scoped.filter(t => t.kind === 'transfer').length;

  const catTotals = useMemo(() => {
    const m = {};
    for (const t of expenses) m[t.category || 'other'] = (m[t.category || 'other'] || 0) + t.amount;
    return BUDGET_CATEGORIES
      .map(c => ({ ...c, spent: m[c.id] || 0, budget: b.budgets.perCat?.[c.id] || 0 }))
      .filter(c => c.spent !== 0 || c.budget > 0)
      .sort((a, z) => z.spent - a.spent);
  }, [expenses, b.budgets]);

  const perAccountSpent = useMemo(() => {
    const m = {};
    const pool = activeMonth === 'all' ? b.transactions : b.transactions.filter(t => monthOf(t) === activeMonth);
    for (const t of pool) if (t.kind === 'expense') m[t.accountId] = (m[t.accountId] || 0) + t.amount;
    return m;
  }, [b.transactions, activeMonth]);

  const totalBudget = b.budgets.total || 0;

  // ── coach's corner: small honest insights from the real numbers ──
  const tips = useMemo(() => {
    const out = [];
    if (!expenses.length) return out;
    const top = catTotals[0];
    if (top) out.push({ emoji: top.emoji, text: `${top.name} is the biggest bucket — ${fmt0(top.spent)} (${Math.round(top.spent / totalSpent * 100)}% of spending).` });
    const over = catTotals.filter(c => c.budget > 0 && c.spent > c.budget);
    for (const c of over.slice(0, 2)) out.push({ emoji: '🚨', text: `${c.name} ran ${fmt0(c.spent - c.budget)} over its ${fmt0(c.budget)} budget. One lighter week next month closes that gap.` });
    const biggest = [...expenses].sort((a, z) => z.amount - a.amount)[0];
    if (biggest && biggest.amount > totalSpent * 0.15) out.push({ emoji: '🐘', text: `Biggest single expense: ${fmt(biggest.amount)} at "${biggest.desc.slice(0, 38)}" (${dayLabel(biggest.date)}).` });
    const counts = {};
    for (const t of expenses) { const k = t.desc.replace(/[#*\d].*$/, '').trim().slice(0, 22) || t.desc.slice(0, 22); (counts[k] = counts[k] || []).push(t.amount); }
    const rec = Object.entries(counts).filter(([, v]) => v.length >= 3).sort((a, z) => z[1].length - a[1].length)[0];
    if (rec) out.push({ emoji: '🔁', text: `"${rec[0]}" showed up ${rec[1].length}× (${fmt0(rec[1].reduce((a, x) => a + x, 0))} total) — small swipes add up.` });
    if (totalBudget > 0 && totalSpent < totalBudget) out.push({ emoji: '📈', text: `${fmt0(totalBudget - totalSpent)} under budget so far — that’s money that can flow straight into the portfolio next door.` });
    return out.slice(0, 4);
  }, [expenses, catTotals, totalSpent, totalBudget]);

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
    setSelected(null);
    setMonth(null);

    // Auto-update the linked portfolio cash account with this statement's
    // closing balance — but only if it's the newest statement we hold for
    // the account (so re-importing an old month never rolls net worth back).
    if (res.kind === 'checking' && res.endingBalance != null && syncAccountValue) {
      const acct = b.accounts.find(a => a.id === res.accountId);
      const newerExists = b.statements.some(
        s => s.accountId === res.accountId && s.endingBalance != null && s.periodEnd > res.periodEnd);
      if (acct?.portfolioAccountId && !newerExists) {
        syncAccountValue(acct.portfolioAccountId, res.endingBalance);
      }
    }
  }

  // Link a checking account to a portfolio cash account and push its latest
  // balance over immediately so the two sides agree from the first click.
  function handleLinkChange(budgetAccountId, portfolioAccountId) {
    b.linkAccount(budgetAccountId, portfolioAccountId);
    if (portfolioAccountId && syncAccountValue) {
      const bal = b.accountBalance(budgetAccountId);
      if (bal != null) syncAccountValue(portfolioAccountId, bal);
    }
  }

  const toggleAccount = id => {
    setSelected(prev => {
      const cur = prev === null ? new Set(b.accounts.map(a => a.id)) : new Set(prev);
      if (cur.has(id)) cur.delete(id); else cur.add(id);
      return cur;
    });
  };

  const hasData = b.transactions.length > 0;
  const allSelected = selectedIds.size === b.accounts.length;

  const dropzone = (
    <div
      className={'dropzone budget-dropzone' + (dragOver ? ' drop-over' : '')}
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      role="button" tabIndex={0}
    >
      <div className="dropzone-title">{busy ? <span><span className="spin">⟳</span> Reading your statement…</span> : 'Drop a Chase statement here 📄'}</div>
      <p>Credit card or checking — PDF or CSV. Click to browse. Parsed in your browser, previewed before anything is saved.</p>
      <input ref={fileRef} type="file" accept=".pdf,application/pdf,.csv,text/csv" multiple hidden
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );

  if (!b.ready) return <div className="screen"><p className="hold-empty">Loading budget…</p></div>;

  return (
    <div className="screen">
      <div className="import-hero">
        <h2>The other half of the money story 💸</h2>
        <p>
          The portfolio tracks what we keep — this tracks what we spend. Each statement
          builds a profile for that card or account; view them solo or combine everything.
        </p>
        <div className="celebrate-row" style={{ marginBottom: 0 }}>
          {b.syncStatus === 'synced' && <Chip tone="soft">☁ Synced for both of you</Chip>}
          {b.syncStatus === 'local' && <Chip tone="warn">☁ Saved on this device only</Chip>}
          {lastImport && <Chip tone="soft">✅ Imported {lastImport.added} transactions{lastImport.dupes ? ` · ${lastImport.dupes} duplicates skipped` : ''}</Chip>}
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
        </>
      )}

      {hasData && (
        <>
          {/* cashflow ⇄ spending ⇄ airbnb */}
          <div className="cf-toggle">
            <button className={'cf-toggle-btn' + (view === 'cashflow' ? ' active' : '')} onClick={() => setView('cashflow')}>📊 Cashflow</button>
            <button className={'cf-toggle-btn' + (view === 'spending' ? ' active' : '')} onClick={() => setView('spending')}>🧾 Spending</button>
            <button className={'cf-toggle-btn' + (view === 'airbnb' ? ' active' : '')} onClick={() => setView('airbnb')}>🏡 Airbnb</button>
          </div>

          {view === 'cashflow' && (
            <Cashflow b={b} portfolioAccounts={portfolioAccounts} onLinkChange={handleLinkChange} />
          )}

          {view === 'airbnb' && <Airbnb b={b} />}

          {view === 'spending' && (
          <>
          {/* account profiles + combine */}
          <div>
            <SectionLabel right={
              <button className={'btn-soft' + (allSelected ? ' on' : '')} onClick={() => setSelected(null)}>
                {allSelected ? '✓ All combined' : 'Combine all'}
              </button>
            }>Cards &amp; accounts — tap to include</SectionLabel>
            <div className="bacct-grid">
              {b.accounts.map(a => {
                const on = selectedIds.has(a.id);
                return (
                  <Card key={a.id} className={'bacct-card' + (on ? ' on' : '')} >
                    <button type="button" className="bacct-hit" onClick={() => toggleAccount(a.id)}
                      title={on ? 'Click to exclude this account from the view' : 'Click to include this account'} />
                    <div className="bacct-head">
                      <span className="bacct-emoji">{a.emoji}</span>
                      <input className="bacct-name" value={a.name}
                        onClick={e => e.stopPropagation()}
                        onChange={e => b.renameAccount(a.id, e.target.value)} />
                      <span className={'bacct-tick' + (on ? ' on' : '')}>{on ? '✓' : ''}</span>
                    </div>
                    <div className="bacct-sub mono">···{a.last4} · {a.kind === 'card' ? 'credit card' : 'checking'}</div>
                    <div className="bacct-spent mono">{fmt0(perAccountSpent[a.id] || 0)}<span className="bacct-spent-label"> spent</span></div>
                  </Card>
                );
              })}
              <Card className="bacct-card bacct-add" >
                <button type="button" className="bacct-hit" onClick={() => fileRef.current?.click()} title="Import another statement" />
                <div className="bacct-emoji">➕</div>
                <div className="bacct-sub">Add a statement</div>
              </Card>
            </div>
          </div>

          {/* month picker */}
          <div className="month-row">
            {months.map(m => (
              <button key={m} className={'month-chip' + (activeMonth === m ? ' active' : '')} onClick={() => setMonth(m)}>
                {monthLabel(m)}
              </button>
            ))}
            <button className={'month-chip' + (activeMonth === 'all' ? ' active' : '')} onClick={() => setMonth('all')}>All time</button>
          </div>

          {/* month at a glance */}
          <Card className="hero">
            <div>
              <div className="hero-greeting">
                {activeMonth === 'all' ? 'All time, together 🤝' : `${monthLabel(activeMonth)}, together 🤝`}
                {!allSelected && <> · {selectedIds.size} of {b.accounts.length} accounts</>}
              </div>
              <div className="hero-networth">
                <Term tip="Every expense across the selected cards and accounts. Card payments and transfers between your own accounts are set aside so nothing counts twice.">Spent</Term>
                <div className="hero-amount">{fmt0(totalSpent)}</div>
              </div>
              <div>
                <div className="hero-goal-row">
                  {editTotal ? (
                    <span className="hero-goal-label">🎯
                      <input className="goal-edit-input goal-edit-amount" type="number" autoFocus defaultValue={totalBudget || ''}
                        placeholder="3500"
                        onBlur={e => { b.setTotalBudget(e.target.value); setEditTotal(false); }}
                        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
                      <span style={{ fontWeight: 400, fontSize: 12.5 }}>/month</span>
                    </span>
                  ) : (
                    <span className="hero-goal-label">🎯 Monthly budget · {totalBudget > 0 ? fmt0(totalBudget) : 'not set'}
                      <button className="goal-edit-btn" onClick={() => setEditTotal(true)} title="Set the total monthly budget">✏️</button>
                    </span>
                  )}
                  {totalBudget > 0 && activeMonth !== 'all' && <span className="hero-goal-pct">{Math.round(totalSpent / totalBudget * 100)}%</span>}
                </div>
                {totalBudget > 0 && activeMonth !== 'all' && (
                  <>
                    <ProgressBar pct={totalSpent / totalBudget * 100} height={10} tone={totalSpent > totalBudget ? 'down' : 'accent'} />
                    <div className="hero-goal-note">
                      {totalSpent <= totalBudget
                        ? <>{fmt0(totalBudget - totalSpent)} still in the tank — finish under and it rolls toward the portfolio. 🏝️</>
                        : <>{fmt0(totalSpent - totalBudget)} over budget — the Coach has ideas below. 🧢</>}
                    </div>
                  </>
                )}
                {totalBudget === 0 && <div className="hero-goal-note">Set a budget to get a goal to aim for — and bragging rights when you beat it.</div>}
              </div>
            </div>
            <div className="hero-right budget-donut-wrap">
              <Donut
                slices={catTotals.filter(c => c.spent > 0).map(c => ({ id: c.id, color: c.color, value: c.spent }))}
                size={150}
                centerTop={fmt0(totalSpent)}
                centerBottom={activeMonth === 'all' ? 'all time' : 'this month'}
              />
              <div className="budget-flow">
                {totalIncome > 0 && <div className="hs-sub">💰 Income in: <strong className="mono up">{fmt0(totalIncome)}</strong></div>}
                {transferCount > 0 && (
                  <div className="hs-sub">
                    <Term tip="Card payments and moves between your own accounts. Excluded from spending so the same dollar never counts twice.">
                      🔁 {transferCount} transfers set aside
                    </Term>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* where it went */}
          <Card>
            <SectionLabel right={
              <button className={'btn-soft' + (editBudgets ? ' on' : '')} onClick={() => setEditBudgets(v => !v)}>
                {editBudgets ? 'Done' : '🎯 Set category budgets'}
              </button>
            }>Where it went</SectionLabel>
            <div className="cat-list">
              {catTotals.map(c => {
                const over = c.budget > 0 && c.spent > c.budget;
                const pct = c.budget > 0 ? c.spent / c.budget * 100 : (totalSpent ? c.spent / totalSpent * 100 : 0);
                const open = openCat === c.id;
                const catTxs = open ? expenses.filter(t => (t.category || 'other') === c.id).sort((a, z) => z.date.localeCompare(a.date)) : [];
                return (
                  <div key={c.id}>
                    <div className={'cat-row clickable'} onClick={() => setOpenCat(open ? null : c.id)} title="Click to see every transaction">
                      <span className="budget-cat-emoji">{c.emoji}</span>
                      <div className="cat-name">
                        {c.name}
                        <span className="cat-sub">
                          {c.budget > 0
                            ? (over ? `${fmt0(c.spent - c.budget)} over the ${fmt0(c.budget)} budget` : `${fmt0(c.budget - c.spent)} left of ${fmt0(c.budget)}`)
                            : `${Math.round(pct)}% of spending`}
                        </span>
                      </div>
                      {editBudgets ? (
                        <input className="bgt-input mono" type="number" placeholder="—" defaultValue={c.budget || ''}
                          onClick={e => e.stopPropagation()}
                          onBlur={e => b.setCategoryBudget(c.id, e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
                      ) : (
                        <div className="budget-cat-bar">
                          <ProgressBar pct={pct} height={8} tone={over ? 'down' : 'accent'} />
                        </div>
                      )}
                      <div className="cat-vals">
                        <div className="cat-value">{fmt0(c.spent)}</div>
                        {c.budget > 0 && <div className={'cat-pl ' + (over ? 'down' : 'up')}>{Math.round(c.spent / c.budget * 100)}% of budget</div>}
                      </div>
                    </div>
                    {open && (
                      <div className="cat-expand">
                        {catTxs.map(t => {
                          const acc = b.accounts.find(a => a.id === t.accountId);
                          return (
                            <div className="txrow" key={t.id}>
                              <span className="mono tx-date">{dayLabel(t.date)}</span>
                              <span title={acc?.name}>{acc?.emoji}</span>
                              <span className="tx-desc">{t.desc}</span>
                              <select className="tx-cat" value={t.category || 'other'}
                                onClick={e => e.stopPropagation()}
                                onChange={e => b.recategorize(t.id, e.target.value)}
                                title="Filed in the wrong bucket? Move it.">
                                {BUDGET_CATEGORIES.map(bc => <option key={bc.id} value={bc.id}>{bc.emoji} {bc.name}</option>)}
                              </select>
                              <span className={'mono tx-amt' + (t.amount < 0 ? ' up' : '')}>{fmt(t.amount)}</span>
                            </div>
                          );
                        })}
                        {!catTxs.length && <div className="hold-empty">Nothing here for this period.</div>}
                      </div>
                    )}
                  </div>
                );
              })}
              {!catTotals.length && <div className="hold-empty">No expenses in this view — try another month or select more accounts.</div>}
            </div>
          </Card>

          <div className="two-col">
            <Card>
              <SectionLabel>Coach&rsquo;s corner 🧢</SectionLabel>
              <div className="reb-advice">
                {tips.map((t, i) => (
                  <div className="reb-advice-row" key={i}>
                    <span className="story-emoji">{t.emoji}</span>
                    <p>{t.text}</p>
                  </div>
                ))}
                {!tips.length && <p className="reb-tip">Import a statement and the coach will start reading the numbers.</p>}
              </div>
            </Card>

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
          </div>
          </>
          )}
        </>
      )}

      <p className="budget-credits">
        Borrowing the best ideas from <strong>YNAB</strong> (every dollar gets a job),{' '}
        <strong>Copilot Money</strong> (auto-categorization that&rsquo;s actually fun),{' '}
        <strong>Monarch</strong> (built for couples), and <strong>Rocket Money</strong>{' '}
        (subscription hunting) — remixed into the SunnyHeron way.
      </p>
    </div>
  );
}

function PendingPreview({ item, accounts, onConfirm, onCancel }) {
  const p = item.parsed;
  const s = summarizeParsed(p);
  const existing = accounts.find(a => a.last4 === p.last4 && a.kind === p.kind);
  const catSums = {};
  for (const t of p.transactions) if (t.kind === 'expense') catSums[t.category || 'other'] = (catSums[t.category || 'other'] || 0) + t.amount;
  const topCats = Object.entries(catSums).sort((a, z) => z[1] - a[1]).slice(0, 5);
  return (
    <Card className="pending-card">
      <SectionLabel right={<Chip tone="warn">PREVIEW — nothing saved yet</Chip>}>
        {p.kind === 'card' ? '💳 Chase credit card' : '🏦 Chase checking'} ···{p.last4}
      </SectionLabel>
      <p className="reb-tip" style={{ marginBottom: 10 }}>
        {existing
          ? <>Matches your existing profile <strong>{existing.emoji} {existing.name}</strong>.</>
          : <>New profile will be created: <strong>{p.kind === 'card' ? '💳 Chase Card' : '🏦 Chase Checking'} ···{p.last4}</strong> (rename it any time).</>}
        {' '}Statement period <strong className="mono">{p.periodStart} → {p.periodEnd}</strong>.
      </p>
      <div className="pending-stats">
        <Chip tone="soft">🧾 {s.expense} expenses · {fmt0(s.spend)}</Chip>
        {s.income > 0 && <Chip tone="soft">💰 {s.income} deposits</Chip>}
        {s.transfer > 0 && <Chip tone="soft">🔁 {s.transfer} transfers (excluded)</Chip>}
      </div>
      <div className="pending-cats">
        {topCats.map(([id, amt]) => {
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
