import { useMemo, useRef, useState } from 'react';
import { Card, Chip, Donut, ProgressBar, SectionLabel, Term } from './ui';
import { fmt, fmt0 } from '../lib/format';
import { BUDGET_CATEGORIES, CATEGORY_GROUPS, catById, categoriesFor, isHouseCategory, isSpendCategory } from '../data/budget';
import { PROPERTY_DEFAULTS } from '../data/property';
import { parseStatement, isCashAccount } from '../lib/statements';
import Cashflow from './Cashflow';
import TaxReport from './TaxReport';
import Rules, { RuleWizard } from './Rules';

// Category picker for a transaction row. Grouped, because a flat list of every
// personal + house + kept bucket is a long scroll to read.
function CategorySelect({ value, kind, onChange, className = 'tx-cat', title }) {
  const options = categoriesFor(kind);
  return (
    <select className={className} value={value || 'other'} title={title}
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

// Per-account-kind labels + emoji, shared by the profile cards and the import
// preview so a new source only needs adding in one place.
const KIND_META = {
  card:     { emoji: '💳', label: 'Chase credit card',    profile: 'Chase Card',          sub: 'credit card' },
  checking: { emoji: '🏦', label: 'Chase checking',       profile: 'Chase Checking',      sub: 'checking' },
  savings:  { emoji: '🏛️', label: 'Wealthfront savings',  profile: 'Wealthfront Savings', sub: 'savings' },
};
const kindMeta = k => KIND_META[k] || { emoji: '🧾', label: 'Account', profile: 'Account', sub: 'account' };

// The Budget platform — the spending-side sibling of the portfolio.
// Drop in a Chase card/checking statement (PDF or CSV, parsed locally in
// the browser), every transaction gets an account profile + category, then
// explore per-account or combined. See CONCEPT.md → "Budget Companion".

const STEPS = [
  { emoji: '💳', title: '1 · Drop in a statement', text: 'Upload a Chase card or checking statement (PDF or CSV) or a Wealthfront savings export (CSV). It’s read right here in your browser, so the file never leaves the page.' },
  { emoji: '✨', title: '2 · Every dollar gets sorted', text: '"H-E-B #796 ALLEN TX" becomes 🛒 Groceries. Card payments and savings transfers are set aside so nothing is double-counted.' },
  { emoji: '🧠', title: '3 · Explore & combine', text: 'Each card or account gets its own profile. Look at one, pick a few, or combine everything for the full monthly picture.' },
];

const monthOf = tx => tx.date.slice(0, 7);
const monthLabel = ym => new Date(ym + '-15T12:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });
const dayLabel = d => `${d.slice(5, 7)}/${d.slice(8, 10)}`;

function summarizeParsed(parsed) {
  const n = { expense: 0, income: 0, transfer: 0 };
  let spend = 0, kept = 0, keptCount = 0;
  for (const t of parsed.transactions) {
    n[t.kind]++;
    if (t.kind !== 'expense') continue;
    // Brokerage/savings moves land as expenses on the statement but aren't
    // spending — call them out separately so the preview total is honest.
    if (isSpendCategory(t.category)) spend += t.amount;
    else { kept += t.amount; keptCount++; n.expense--; }
  }
  return { ...n, spend, kept, keptCount };
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
  const [view, setView] = useState('cashflow');   // 'cashflow' | 'spending' | 'airbnb' | 'rules'
  const [ruleSeed, setRuleSeed] = useState(null); // open the rule wizard from a transaction

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

  // Money can leave an account without being spent — a brokerage or savings
  // move is still ours. Those categories get their own line rather than being
  // folded into "Spent", where a single $3,000 deposit would read as a blowout.
  const allExpenses = useMemo(() => scoped.filter(t => t.kind === 'expense'), [scoped]);
  const expenses = useMemo(() => allExpenses.filter(t => isSpendCategory(t.category)), [allExpenses]);
  const moved = useMemo(() => allExpenses.filter(t => !isSpendCategory(t.category)), [allExpenses]);
  const totalSpent = expenses.reduce((a, t) => a + t.amount, 0);
  const totalMoved = moved.reduce((a, t) => a + t.amount, 0);
  const totalIncome = scoped.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0);
  const transferCount = scoped.filter(t => t.kind === 'transfer').length;

  const catTotals = useMemo(() => {
    const m = {};
    for (const t of allExpenses) m[t.category || 'other'] = (m[t.category || 'other'] || 0) + t.amount;
    return BUDGET_CATEGORIES
      .map(c => ({ ...c, spent: m[c.id] || 0, budget: b.budgets.perCat?.[c.id] || 0 }))
      .filter(c => c.spent !== 0 || c.budget > 0)
      .sort((a, z) => z.spent - a.spent);
  }, [allExpenses, b.budgets]);
  // One list, banded by group. The house's costs are real money out of the
  // account so they belong in the total, but a $6,400 roof sitting between
  // Groceries and Dining out reads as a household blowout — the band says
  // whose money this is without changing what it adds up to.
  const catBands = useMemo(() => CATEGORY_GROUPS
    .map(g => ({ ...g, rows: catTotals.filter(c => c.group === g.id) }))
    .filter(g => g.rows.length), [catTotals]);
  // Everything that answers "where did the spending go" — the non-spend rows
  // are still listed, but they can't be a share of a total they're not in.
  const spendCats = useMemo(() => catTotals.filter(c => isSpendCategory(c.id)), [catTotals]);

  // The rental's own P&L, read straight off the categories. This is what the
  // Airbnb tab used to show; it lives here now because the tagging that fed it
  // is just the category picker.
  const house = useMemo(() => {
    const rows = scoped.filter(t => isHouseCategory(t.category));
    const income = rows.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0);
    const spent = rows.filter(t => t.kind === 'expense').reduce((a, t) => a + t.amount, 0);
    return { count: rows.length, income, spent, net: income - spent };
  }, [scoped]);

  const perAccountSpent = useMemo(() => {
    const m = {};
    const pool = activeMonth === 'all' ? b.transactions : b.transactions.filter(t => monthOf(t) === activeMonth);
    for (const t of pool) {
      if (t.kind !== 'expense' || !isSpendCategory(t.category)) continue;
      m[t.accountId] = (m[t.accountId] || 0) + t.amount;
    }
    return m;
  }, [b.transactions, activeMonth]);

  const totalBudget = b.budgets.total || 0;

  // ── coach's corner: small honest insights from the real numbers ──
  const tips = useMemo(() => {
    const out = [];
    if (!expenses.length) return out;
    const top = spendCats[0];
    if (top) out.push({ emoji: top.emoji, text: `${top.name} is the biggest bucket — ${fmt0(top.spent)} (${Math.round(top.spent / totalSpent * 100)}% of spending).` });
    if (totalMoved > 0) out.push({ emoji: '📈', text: `${fmt0(totalMoved)} moved into investments and savings — that's money kept, not spent.` });
    const over = spendCats.filter(c => c.budget > 0 && c.spent > c.budget);
    for (const c of over.slice(0, 2)) out.push({ emoji: '🚨', text: `${c.name} ran ${fmt0(c.spent - c.budget)} over its ${fmt0(c.budget)} budget. One lighter week next month closes that gap.` });
    const biggest = [...expenses].sort((a, z) => z.amount - a.amount)[0];
    if (biggest && biggest.amount > totalSpent * 0.15) out.push({ emoji: '🐘', text: `Biggest single expense: ${fmt(biggest.amount)} at "${biggest.desc.slice(0, 38)}" (${dayLabel(biggest.date)}).` });
    const counts = {};
    for (const t of expenses) { const k = t.desc.replace(/[#*\d].*$/, '').trim().slice(0, 22) || t.desc.slice(0, 22); (counts[k] = counts[k] || []).push(t.amount); }
    const rec = Object.entries(counts).filter(([, v]) => v.length >= 3).sort((a, z) => z[1].length - a[1].length)[0];
    if (rec) out.push({ emoji: '🔁', text: `"${rec[0]}" showed up ${rec[1].length}× (${fmt0(rec[1].reduce((a, x) => a + x, 0))} total) — small swipes add up.` });
    if (totalBudget > 0 && totalSpent < totalBudget) out.push({ emoji: '📈', text: `${fmt0(totalBudget - totalSpent)} under budget so far — that’s money that can flow straight into the portfolio next door.` });
    return out.slice(0, 4);
  }, [expenses, spendCats, totalSpent, totalMoved, totalBudget]);

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
    if (isCashAccount(res.kind) && res.endingBalance != null && syncAccountValue) {
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
  // When the link moves to a different account (or is removed), zero out the
  // previously-linked one so its copied balance doesn't linger as a phantom
  // duplicate in net worth.
  function handleLinkChange(budgetAccountId, portfolioAccountId) {
    const prevId = b.accounts.find(a => a.id === budgetAccountId)?.portfolioAccountId || null;
    b.linkAccount(budgetAccountId, portfolioAccountId);
    if (!syncAccountValue) return;
    if (prevId && prevId !== portfolioAccountId) syncAccountValue(prevId, 0);
    if (portfolioAccountId) {
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
  const property = b.properties[0] || null;
  // Lines the AI flagged as ambiguous (e.g. a family member's Zelle) and won't
  // auto-decide — surfaced at the top of Spending so they're never missed.
  const reviewRows = useMemo(
    () => b.transactions.filter(t => t.reviewFlag).sort((a, z) => z.date.localeCompare(a.date)),
    [b.transactions]);
  const reviewCount = reviewRows.length;

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

  if (!b.ready) return <div className="screen"><p className="hold-empty">Loading budget…</p></div>;

  return (
    <div className="screen">
      {ruleSeed && <RuleWizard b={b} seed={ruleSeed} onClose={() => setRuleSeed(null)} />}
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
          {/* cashflow ⇄ spending ⇄ taxes ⇄ rules. The house used to have its own
              tab with its own tagging; it's now just a set of categories inside
              Spending, so all that's left of it here is the tax report. */}
          <div className="cf-toggle">
            <button className={'cf-toggle-btn' + (view === 'cashflow' ? ' active' : '')} onClick={() => setView('cashflow')}>📊 Cashflow</button>
            <button className={'cf-toggle-btn' + (view === 'spending' ? ' active' : '')} onClick={() => setView('spending')}>
              🧾 Spending{reviewCount > 0 && <span className="cf-review-flag"> · 🔍 {reviewCount}</span>}
            </button>
            <button className={'cf-toggle-btn' + (view === 'taxes' ? ' active' : '')} onClick={() => setView('taxes')}>🧮 House taxes</button>
            <button className={'cf-toggle-btn' + (view === 'rules' ? ' active' : '')} onClick={() => setView('rules')}>
              🧠 Rules{b.smartRules.length > 0 && <span className="cf-rule-count"> · {b.smartRules.length}</span>}
            </button>
          </div>

          {view === 'cashflow' && (
            <Cashflow b={b} portfolioAccounts={portfolioAccounts} onLinkChange={handleLinkChange} />
          )}

          {view === 'taxes' && (
            property
              ? <TaxReport key={property.id} b={b} property={property} />
              : (
                <Card className="airbnb-setup">
                  <SectionLabel>Set up the rental 🏡</SectionLabel>
                  <p className="reb-tip" style={{ marginBottom: 14 }}>
                    Create the property and the House categories on the Spending tab start
                    feeding a Schedule E summary — depreciation, the mortgage split and a
                    suggested set-aside. Sorting a transaction into a House bucket is the
                    only tagging there is.
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
              )
          )}

          {view === 'rules' && <Rules b={b} />}

          {view === 'spending' && (
          <>
          {/* needs manual review — first thing you see, so lines from merchants
              you flagged as "it depends" never get buried at the bottom */}
          {reviewCount > 0 && (
            <Card className="airbnb-review-card">
              <SectionLabel right={<Chip tone="warn">{reviewCount} to review</Chip>}>Needs manual review 🔍</SectionLabel>
              <p className="reb-tip" style={{ marginBottom: 10 }}>
                These come from merchants you flagged as &ldquo;it depends&rdquo; (like family). Nothing
                is guessed for them — pick a category and this one is filed. New lines from
                the same merchant keep landing here until you stop reviewing it.
              </p>
              <div className="cat-expand" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                {reviewRows.map(t => {
                  const acc = b.accounts.find(a => a.id === t.accountId);
                  return (
                    <div className="txrow airbnb-review-row" key={t.id}>
                      <span className="mono tx-date">{dayLabel(t.date)}</span>
                      <span title={acc?.name}>{acc?.emoji}</span>
                      <span className="tx-desc">{t.desc}</span>
                      <span className={'mono tx-amt' + (t.kind === 'income' ? ' up' : '')}>{fmt(t.amount)}</span>
                      <div className="airbnb-review-acts">
                        <CategorySelect value={t.category} kind={t.kind}
                          title="File just this one — the merchant stays in review"
                          onChange={v => b.resolveReview(t.id, v)} />
                        <button className="hold-del" title="Stop reviewing this merchant — let it auto-file again"
                          onClick={() => b.setMerchantReview(t.desc, false)}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

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
                    <div className="bacct-sub mono">{a.last4 && a.last4 !== '????' ? `···${a.last4} · ` : ''}{kindMeta(a.kind).sub}</div>
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
              {/* the ring is the spending total, so the non-spend buckets stay
                  out of it — otherwise the slices wouldn't add up to the middle */}
              <Donut
                slices={spendCats.filter(c => c.spent > 0).map(c => ({ id: c.id, name: c.name, color: c.color, value: c.spent }))}
                size={163}
                centerTop={fmt0(totalSpent)}
                centerBottom={activeMonth === 'all' ? 'all time' : 'this month'}
              />
              <div className="budget-flow">
                {totalIncome > 0 && <div className="hs-sub">💰 Income in: <strong className="mono up">{fmt0(totalIncome)}</strong></div>}
                {totalMoved > 0 && (
                  <div className="hs-sub">
                    <Term tip="Money moved to a brokerage or savings account. It left the checking account but it's still yours, so it isn't counted as spending.">
                      📈 Invested &amp; saved: <strong className="mono up">{fmt0(totalMoved)}</strong>
                    </Term>
                  </div>
                )}
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

          {/* the rental's own P&L — same transactions, filtered to the House
              categories, so there's nothing extra to keep in sync */}
          {house.count > 0 && (
            <Card className="house-card">
              <SectionLabel right={
                <button className="drill-open" type="button" onClick={() => setView('taxes')}>Schedule E view →</button>
              }>
                {property ? `${property.emoji} ${property.name}` : '🏡 The house'} · rental cash flow
              </SectionLabel>
              <div className="house-pl">
                <div className="house-stat">
                  <div className="hs-label">💰 Rent in</div>
                  <div className="hs-value up">{fmt0(house.income)}</div>
                </div>
                <div className="house-stat">
                  <div className="hs-label">🧾 Costs out</div>
                  <div className="hs-value">{fmt0(house.spent)}</div>
                </div>
                <div className="house-stat">
                  <div className="hs-label">{house.net < 0 ? '📉 Net loss' : '📈 Net profit'}</div>
                  <div className={'hs-value ' + (house.net < 0 ? 'down' : 'up')}>{fmt0(house.net)}</div>
                </div>
                <div className="house-stat">
                  <div className="hs-label">🏷️ Lines</div>
                  <div className="hs-value">{house.count}</div>
                </div>
              </div>
              <p className="reb-tip" style={{ marginTop: 12 }}>
                Cash in vs. cash out. Depreciation, the mortgage split and the set-aside
                estimate live in the Schedule E view. 🧾
              </p>
            </Card>
          )}

          {/* where it went */}
          <Card>
            <SectionLabel right={
              <button className={'btn-soft' + (editBudgets ? ' on' : '')} onClick={() => setEditBudgets(v => !v)}>
                {editBudgets ? 'Done' : '🎯 Set category budgets'}
              </button>
            }>Where it went</SectionLabel>
            <div className="cat-list">
              {catBands.map(band => (
                <div key={band.id} className="cat-band">
                  {catBands.length > 1 && (
                    <div className="cat-band-label">
                      <span>{band.label}</span>
                      <span className="mono">{fmt0(band.rows.reduce((a, c) => a + c.spent, 0))}</span>
                    </div>
                  )}
              {band.rows.map(c => {
                const counts = isSpendCategory(c.id);
                const over = counts && c.budget > 0 && c.spent > c.budget;
                const pct = c.budget > 0 ? c.spent / c.budget * 100 : (totalSpent ? c.spent / totalSpent * 100 : 0);
                const open = openCat === c.id;
                const catTxs = open ? allExpenses.filter(t => (t.category || 'other') === c.id).sort((a, z) => z.date.localeCompare(a.date)) : [];
                return (
                  <div key={c.id}>
                    <div className={'cat-row clickable' + (counts ? '' : ' cat-row-kept')} onClick={() => setOpenCat(open ? null : c.id)} title="Click to see every transaction">
                      <span className="budget-cat-emoji">{c.emoji}</span>
                      <div className="cat-name">
                        {c.name}
                        <span className="cat-sub">
                          {!counts
                            ? 'kept, not spent — outside the spending total'
                            : c.budget > 0
                              ? (over ? `${fmt0(c.spent - c.budget)} over the ${fmt0(c.budget)} budget` : `${fmt0(c.budget - c.spent)} left of ${fmt0(c.budget)}`)
                              : `${Math.round(pct)}% of spending`}
                        </span>
                      </div>
                      {editBudgets && counts ? (
                        <input className="bgt-input mono" type="number" placeholder="—" defaultValue={c.budget || ''}
                          onClick={e => e.stopPropagation()}
                          onBlur={e => b.setCategoryBudget(c.id, e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
                      ) : (
                        <div className="budget-cat-bar">
                          {counts && <ProgressBar pct={pct} height={8} tone={over ? 'down' : 'accent'} />}
                        </div>
                      )}
                      <div className="cat-vals">
                        <div className="cat-value">{fmt0(c.spent)}</div>
                        {counts && c.budget > 0 && <div className={'cat-pl ' + (over ? 'down' : 'up')}>{Math.round(c.spent / c.budget * 100)}% of budget</div>}
                        {!counts && <div className="cat-pl flat">kept</div>}
                      </div>
                    </div>
                    {open && (
                      <div className="cat-expand">
                        {catTxs.map(t => {
                          const acc = b.accounts.find(a => a.id === t.accountId);
                          return (
                            <div className="txrow txrow-spend" key={t.id}>
                              <span className="mono tx-date">{dayLabel(t.date)}</span>
                              <span title={acc?.name}>{acc?.emoji}</span>
                              <span className="tx-desc">{t.desc}</span>
                              <CategorySelect value={t.category} kind={t.kind}
                                title="Filed in the wrong bucket? Move it just this once."
                                onChange={v => b.recategorize(t.id, v)} />
                              <span className={'mono tx-amt' + (t.amount < 0 ? ' up' : '')}>{fmt(t.amount)}</span>
                              <button className="btn-soft tx-rule-btn" title={`Always file "${t.desc.slice(0, 30)}" here — re-files this merchant's past lines too`}
                                onClick={e => { e.stopPropagation(); b.recategorizeMerchant(t.desc, t.category || 'other'); }}>🧠 Always</button>
                              <button className="btn-soft tx-rule-btn" title="Make a reusable rule from this transaction"
                                onClick={e => { e.stopPropagation(); setRuleSeed({ desc: t.desc, category: t.category }); }}>✨ Rule</button>
                            </div>
                          );
                        })}
                        {!catTxs.length && <div className="hold-empty">Nothing here for this period.</div>}
                      </div>
                    )}
                  </div>
                );
              })}
                </div>
              ))}
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
  const meta = kindMeta(p.kind);
  const showLast4 = p.last4 && p.last4 !== '????';
  const catSums = {};
  for (const t of p.transactions) if (t.kind === 'expense') catSums[t.category || 'other'] = (catSums[t.category || 'other'] || 0) + t.amount;
  const topCats = Object.entries(catSums).sort((a, z) => z[1] - a[1]).slice(0, 5);
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
        {s.expense > 0 && <Chip tone="soft">🧾 {s.expense} expenses · {fmt0(s.spend)}</Chip>}
        {s.keptCount > 0 && <Chip tone="soft">📈 {s.keptCount} invested/saved · {fmt0(s.kept)}</Chip>}
        {s.income > 0 && <Chip tone="soft">💰 {s.income} income</Chip>}
        {s.transfer > 0 && <Chip tone="soft">🔁 {s.transfer} transfers (excluded)</Chip>}
        {isCashAccount(p.kind) && p.endingBalance != null && <Chip tone="soft">🏦 Balance {fmt0(p.endingBalance)}</Chip>}
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
