import { useMemo, useState } from 'react';
import { Card, Chip, Donut, ProgressBar, SectionLabel, Term } from './ui';
import { fmt, fmt0 } from '../lib/format';
import { SCHEDULE_E_CATEGORIES, PROPERTY_DEFAULTS } from '../data/property';

// The Airbnb section — a property-focused carve-out of the budget. It shows
// only the money tagged to a property (rental income + deductible expenses),
// and is where you tag the handful of house transactions hiding in the
// commingled statements. Tax math (Schedule E, depreciation) lands next phase.
// See AIRBNB_MODULE_PLAN.md.

const monthOf = tx => tx.date.slice(0, 7);
const monthLabel = ym => new Date(ym + '-15T12:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });
const dayLabel = d => `${d.slice(5, 7)}/${d.slice(8, 10)}`;

export default function Airbnb({ b }) {
  const [activeId, setActiveId] = useState(null);
  const [month, setMonth] = useState('all');
  const [query, setQuery] = useState('');

  const property = b.properties.find(p => p.id === activeId) || b.properties[0] || null;

  // ── all transactions tagged to this property ──
  const tagged = useMemo(
    () => property ? b.transactions.filter(t => t.propertyId === property.id) : [],
    [b.transactions, property]);

  const months = useMemo(() => {
    const s = new Set(tagged.map(monthOf));
    return [...s].sort().reverse();
  }, [tagged]);

  const activeMonth = month === 'all' ? 'all' : (months.includes(month) ? month : 'all');
  const scoped = useMemo(
    () => activeMonth === 'all' ? tagged : tagged.filter(t => monthOf(t) === activeMonth),
    [tagged, activeMonth]);

  const incomeTxs = useMemo(() => scoped.filter(t => t.kind === 'income'), [scoped]);
  const expenseTxs = useMemo(() => scoped.filter(t => t.kind === 'expense'), [scoped]);
  const income = incomeTxs.reduce((a, t) => a + t.amount, 0);
  const expenses = expenseTxs.reduce((a, t) => a + t.amount, 0);
  const net = income - expenses;

  const bySE = useMemo(() => {
    const m = {};
    for (const t of expenseTxs) m[t.scheduleE || 'other'] = (m[t.scheduleE || 'other'] || 0) + t.amount;
    return SCHEDULE_E_CATEGORIES
      .map(c => ({ ...c, spent: m[c.id] || 0 }))
      .filter(c => c.spent > 0)
      .sort((a, z) => z.spent - a.spent);
  }, [expenseTxs]);

  // ── candidates to tag: untagged, non-transfer, matching the search ──
  const untagged = useMemo(() => {
    const q = query.trim().toLowerCase();
    return b.transactions
      .filter(t => !t.propertyId && t.kind !== 'transfer')
      .filter(t => !q || t.desc.toLowerCase().includes(q))
      .sort((a, z) => z.date.localeCompare(a.date))
      .slice(0, 40);
  }, [b.transactions, query]);

  // ── empty state: no property yet ──
  if (!property) {
    return (
      <Card className="airbnb-setup">
        <SectionLabel>Set up your Airbnb 🏡</SectionLabel>
        <p className="reb-tip" style={{ marginBottom: 14 }}>
          Create the property and the budget starts carving out its income and
          expenses from your statements. The mortgage servicer and Airbnb deposits
          get tagged automatically; everything else you tag with one tap.
        </p>
        <div className="pending-stats">
          <Chip tone="soft">🏡 {PROPERTY_DEFAULTS.name}</Chip>
          <Chip tone="soft">📍 {PROPERTY_DEFAULTS.state}</Chip>
          <Chip tone="soft">🗓️ In service {PROPERTY_DEFAULTS.placedInService}</Chip>
          <Chip tone="soft">🏦 {fmt0(PROPERTY_DEFAULTS.purchasePrice)} purchase</Chip>
        </div>
        <div className="pending-actions" style={{ marginTop: 14 }}>
          <button className="btn-soft on" onClick={() => { const p = b.addProperty(); setActiveId(p.id); }}>
            ✓ Create {PROPERTY_DEFAULTS.name}
          </button>
        </div>
      </Card>
    );
  }

  const hasData = tagged.length > 0;

  return (
    <>
      {/* property switcher (only when more than one) */}
      {b.properties.length > 1 && (
        <div className="month-row">
          {b.properties.map(p => (
            <button key={p.id} className={'month-chip' + (p.id === property.id ? ' active' : '')} onClick={() => setActiveId(p.id)}>
              {p.emoji} {p.name}
            </button>
          ))}
        </div>
      )}

      {/* month picker */}
      {months.length > 0 && (
        <div className="month-row">
          <button className={'month-chip' + (activeMonth === 'all' ? ' active' : '')} onClick={() => setMonth('all')}>All time</button>
          {months.map(m => (
            <button key={m} className={'month-chip' + (activeMonth === m ? ' active' : '')} onClick={() => setMonth(m)}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
      )}

      {/* profit / loss hero */}
      <Card className="hero">
        <div>
          <div className="hero-greeting">
            {property.emoji} {property.name} · {property.state}
            {activeMonth !== 'all' && <> · {monthLabel(activeMonth)}</>}
          </div>
          <div className="hero-networth">
            <Term tip="Rental income tagged to this property minus the expenses tagged to it. This is cash flow — it does not yet include depreciation or taxes (coming next).">
              Net cash flow
            </Term>
            <div className={'hero-amount' + (net < 0 ? ' down' : '')}>{fmt0(net)}</div>
          </div>
          <div className="airbnb-pl">
            <div className="airbnb-pl-row"><span>💰 Income in</span><strong className="mono up">{fmt0(income)}</strong></div>
            <div className="airbnb-pl-row"><span>🧾 Expenses out</span><strong className="mono">{fmt0(expenses)}</strong></div>
            <div className="airbnb-pl-row total"><span>{net < 0 ? '📉 Net loss' : '📈 Net profit'}</span><strong className={'mono ' + (net < 0 ? 'down' : 'up')}>{fmt0(net)}</strong></div>
          </div>
          <div className="hero-goal-note">
            Tax view — Schedule E, depreciation &amp; set-aside — is the next phase. This is cash in vs. cash out. 🧾
          </div>
        </div>
        <div className="hero-right budget-donut-wrap">
          {expenses > 0 ? (
            <Donut
              slices={bySE.map(c => ({ id: c.id, color: c.color, value: c.spent }))}
              size={150}
              centerTop={fmt0(expenses)}
              centerBottom="expenses"
            />
          ) : (
            <div className="hold-empty">No expenses tagged yet.</div>
          )}
        </div>
      </Card>

      {/* expenses by tax line */}
      {bySE.length > 0 && (
        <Card>
          <SectionLabel>Expenses by tax line (Schedule E)</SectionLabel>
          <div className="cat-list">
            {bySE.map(c => (
              <div className="cat-row" key={c.id}>
                <span className="budget-cat-emoji">{c.emoji}</span>
                <div className="cat-name">
                  {c.name}
                  <span className="cat-sub">{expenses ? Math.round(c.spent / expenses * 100) : 0}% of expenses</span>
                </div>
                <div className="budget-cat-bar">
                  <ProgressBar pct={expenses ? c.spent / expenses * 100 : 0} height={8} />
                </div>
                <div className="cat-vals"><div className="cat-value">{fmt0(c.spent)}</div></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* tagged transactions — change the line or untag */}
      {hasData && (
        <Card>
          <SectionLabel right={<Chip tone="soft">{tagged.length} tagged</Chip>}>Tagged to {property.name}</SectionLabel>
          <div className="cat-expand" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            {scoped.sort((a, z) => z.date.localeCompare(a.date)).map(t => {
              const acc = b.accounts.find(a => a.id === t.accountId);
              return (
                <div className="txrow airbnb-txrow" key={t.id}>
                  <span className="mono tx-date">{dayLabel(t.date)}</span>
                  <span title={acc?.name}>{acc?.emoji}</span>
                  <span className="tx-desc">{t.desc}</span>
                  {t.kind === 'income' ? (
                    <span className="chip chip-soft" style={{ justifySelf: 'end' }}>💰 Rent income</span>
                  ) : (
                    <select className="tx-cat" value={t.scheduleE || 'other'}
                      onChange={e => b.tagTransaction(t.id, property.id, e.target.value)}
                      title="Which Schedule E line is this?">
                      {SCHEDULE_E_CATEGORIES.map(sc => <option key={sc.id} value={sc.id}>{sc.emoji} {sc.name}</option>)}
                    </select>
                  )}
                  <span className={'mono tx-amt' + (t.kind === 'income' ? ' up' : '')}>{fmt(t.amount)}</span>
                  <button className="hold-del" title="Remove from this property (back to personal)"
                    onClick={() => b.tagTransaction(t.id, null)}>✕</button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* find & tag house expenses hiding in the statements */}
      <Card>
        <SectionLabel>Find house expenses</SectionLabel>
        <p className="reb-tip" style={{ marginBottom: 10 }}>
          Search your transactions and tag the ones that belong to the house — toilet
          paper delivered there, a repair, a utility. Tag a merchant once and it
          auto-tags next month. 🧠
        </p>
        <input className="airbnb-search" placeholder="Search descriptions… e.g. Octopus, Spectrum, Home Depot"
          value={query} onChange={e => setQuery(e.target.value)} />
        <div className="cat-expand" style={{ background: 'transparent', border: 'none', padding: 0, marginTop: 8 }}>
          {untagged.map(t => {
            const acc = b.accounts.find(a => a.id === t.accountId);
            return (
              <div className="txrow airbnb-txrow" key={t.id}>
                <span className="mono tx-date">{dayLabel(t.date)}</span>
                <span title={acc?.name}>{acc?.emoji}</span>
                <span className="tx-desc">{t.desc}</span>
                <span className="chip chip-soft" style={{ justifySelf: 'end' }}>{t.kind === 'income' ? '💰 income' : '🧾 expense'}</span>
                <span className={'mono tx-amt' + (t.kind === 'income' ? ' up' : '')}>{fmt(t.amount)}</span>
                <button className="btn-soft" style={{ padding: '3px 8px', fontSize: 12 }}
                  title="Tag this to the property"
                  onClick={() => b.tagTransaction(t.id, property.id)}>🏡 Tag</button>
              </div>
            );
          })}
          {!untagged.length && <div className="hold-empty">{query ? 'No untagged matches — try another search.' : 'Nothing left to tag here.'}</div>}
        </div>
      </Card>
    </>
  );
}
