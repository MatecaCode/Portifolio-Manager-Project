import { useMemo, useState } from 'react';
import { Card, Chip, SectionLabel, Term } from './ui';
import { fmt, fmt0 } from '../lib/format';
import { isInvestmentTransfer } from '../lib/statements';

// The Cashflow view — the bird's-eye companion to the detailed Spending view.
// Where Spending answers "what did we buy?", this answers "are we keeping more
// than we spend, and how much cash is actually in the bank?".

const monthOf = tx => tx.date.slice(0, 7);
const monthLabel = ym => new Date(ym + '-15T12:00:00').toLocaleString('en-US', { month: 'short', year: '2-digit' });
const monthLong = ym => new Date(ym + '-15T12:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });

const RANGES = [
  { id: 3,  label: '3 mo'  },
  { id: 6,  label: '6 mo'  },
  { id: 12, label: '12 mo' },
  { id: 0,  label: 'All'   },
];

// Tiny inline sparkline for an account's balance over time.
function Spark({ points, width = 150, height = 34 }) {
  if (points.length < 2) return null;
  const vals = points.map(p => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const xs = points.map((_, i) => (i * width) / (points.length - 1));
  const y = v => height - 3 - ((v - min) / span) * (height - 6);
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y(vals[i]).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="spark" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={y(last.v)} r="2.6" fill="var(--accent)" />
    </svg>
  );
}

export default function Cashflow({ b, portfolioAccounts = [], onLinkChange }) {
  const [range, setRange] = useState(6);
  const [selected, setSelected] = useState(null); // null = all accounts

  const checking = useMemo(() => b.accounts.filter(a => a.kind === 'checking'), [b.accounts]);

  // ── which accounts feed the income/spending picture (tap to include) ──
  const selectedIds = useMemo(() => {
    const all = new Set(b.accounts.map(a => a.id));
    if (selected === null) return all;
    return new Set([...selected].filter(id => all.has(id)));
  }, [selected, b.accounts]);
  const allSelected = selectedIds.size === b.accounts.length;
  const toggleAccount = id => setSelected(prev => {
    const cur = prev === null ? new Set(b.accounts.map(a => a.id)) : new Set(prev);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    return cur;
  });
  const scopedTx = useMemo(
    () => b.transactions.filter(t => selectedIds.has(t.accountId)),
    [b.transactions, selectedIds]);

  // ── cash on hand: ending balance of each checking account ──
  const balances = useMemo(
    () => checking.map(a => ({ acct: a, bal: b.accountBalance(a.id) })),
    [checking, b]);
  const totalCash = balances.reduce((s, x) => s + (x.bal || 0), 0);
  const haveBalances = balances.some(x => x.bal != null);

  // ── per-month income vs spend for the selected accounts (transfers excluded).
  // Money moved into investments is pulled OUT of spending into its own bucket:
  // it left the bank but it's still yours, so the overview reads it as retained. ──
  const allMonths = useMemo(() => {
    const s = new Set(scopedTx.map(monthOf));
    return [...s].sort(); // ascending
  }, [scopedTx]);

  const months = range === 0 ? allMonths : allMonths.slice(-range);

  const byMonth = useMemo(() => {
    const set = new Set(months);
    const m = {};
    for (const ym of months) m[ym] = { income: 0, expense: 0, invested: 0 };
    for (const t of scopedTx) {
      const ym = monthOf(t);
      if (!set.has(ym)) continue;
      if (t.kind === 'income') m[ym].income += t.amount;
      else if (isInvestmentTransfer(t.desc)) m[ym].invested += t.amount;
      else if (t.kind === 'expense') m[ym].expense += t.amount;
    }
    return months.map(ym => ({ ym, ...m[ym], net: m[ym].income - m[ym].expense }));
  }, [scopedTx, months]);

  const totals = byMonth.reduce((a, r) => ({
    income: a.income + r.income, expense: a.expense + r.expense, invested: a.invested + r.invested,
  }), { income: 0, expense: 0, invested: 0 });
  const net = totals.income - totals.expense;
  const positiveMonths = byMonth.filter(r => r.net > 0).length;
  const barMax = Math.max(1, ...byMonth.map(r => Math.max(r.income, r.expense, r.invested)));

  // ── balance trend per account, from its statements ──
  const trends = useMemo(() => checking.map(a => {
    const pts = b.statements
      .filter(s => s.accountId === a.id && s.endingBalance != null)
      .sort((x, y) => x.periodEnd.localeCompare(y.periodEnd))
      .map(s => ({ t: s.periodEnd, v: s.endingBalance }));
    return { acct: a, pts };
  }), [checking, b.statements]);

  const hasIncomeData = scopedTx.some(t => t.kind === 'income');

  return (
    <>
      {/* cash on hand */}
      <Card className="hero">
        <div>
          <div className="hero-greeting">Where things stand 🏦</div>
          <div className="hero-networth">
            <Term tip="The real cash sitting in your bank (checking) accounts right now — taken from the closing balance of the most recent statement for each. Credit cards aren't cash, so they're left out.">Cash on hand</Term>
            <div className="hero-amount">{haveBalances ? fmt0(totalCash) : '—'}</div>
          </div>
          {!haveBalances && (
            <div className="hero-goal-note">
              No bank balances captured yet. Import a Chase <strong>checking</strong> statement (not a card) and its closing balance shows up here.
            </div>
          )}
        </div>
        <div className="hero-right">
          <div className="cf-balances">
            {balances.map(({ acct, bal }) => (
              <div className="cf-bal-row" key={acct.id}>
                <span className="cf-bal-name">{acct.emoji} {acct.name}</span>
                <span className="cf-bal-amt mono">{bal != null ? fmt0(bal) : <span className="flat">no statement</span>}</span>
              </div>
            ))}
            {!checking.length && <div className="hs-sub">No checking accounts yet — only credit cards hold no cash balance.</div>}
          </div>
        </div>
      </Card>

      {/* income vs spending */}
      <Card>
        <SectionLabel right={
          <div className="month-row" style={{ margin: 0 }}>
            {RANGES.map(r => (
              <button key={r.id} className={'month-chip' + (range === r.id ? ' active' : '')} onClick={() => setRange(r.id)}>{r.label}</button>
            ))}
          </div>
        }>Income vs. spending</SectionLabel>

        {b.accounts.length > 1 && (
          <div className="month-row cf-acct-row">
            <button className={'month-chip' + (allSelected ? ' active' : '')} onClick={() => setSelected(null)}>
              {allSelected ? '✓ All accounts' : 'All accounts'}
            </button>
            {b.accounts.map(a => (
              <button key={a.id} className={'month-chip' + (selectedIds.has(a.id) ? ' active' : '')}
                onClick={() => toggleAccount(a.id)}
                title={selectedIds.has(a.id) ? 'Tap to exclude this account' : 'Tap to include this account'}>
                {a.emoji} {a.name}
              </button>
            ))}
          </div>
        )}

        {!hasIncomeData && (
          <div className="hero-goal-note" style={{ marginBottom: 14 }}>
            Only spending data so far. Import a <strong>checking</strong> statement to capture income (paychecks, deposits) and unlock the keep-rate below. Card payments and internal transfers are always set aside so nothing is double-counted.
          </div>
        )}

        <div className="cf-stat-row">
          <div className="cf-stat">
            <div className="cf-stat-label"><Term tip="Money coming in — deposits and paychecks on the selected accounts. Internal transfers between your own accounts are excluded.">Income in</Term></div>
            <div className="cf-stat-val mono up">{fmt0(totals.income)}</div>
          </div>
          <div className="cf-stat">
            <div className="cf-stat-label"><Term tip="Everything actually spent across the selected accounts in this range. Card payments, self-transfers, and money moved into investments are all excluded.">Spent</Term></div>
            <div className="cf-stat-val mono down">{fmt0(totals.expense)}</div>
          </div>
          <div className="cf-stat cf-stat-inv">
            <div className="cf-stat-label"><Term tip="Money moved into investment / brokerage accounts (Wealthfront, Fidelity, Kraken…). It left the bank but it's still yours — so it counts as kept, not spent.">Invested</Term></div>
            <div className="cf-stat-val mono inv">{fmt0(totals.invested)}</div>
          </div>
          <div className="cf-stat">
            <div className="cf-stat-label"><Term tip="Income minus spending. Money you put into investments is NOT spending, so it stays on the positive side here — you kept it, it's just working.">Net kept</Term></div>
            <div className={'cf-stat-val mono ' + (net >= 0 ? 'up' : 'down')}>{fmt(net, { plus: true, dec: 0 })}</div>
          </div>
        </div>

        {totals.invested > 0 && (
          <div className="cf-money-map">
            🌱 Of the {fmt0(totals.income)} that came in, <strong className="down">{fmt0(totals.expense)}</strong> was
            spent and <strong className="inv">{fmt0(totals.invested)}</strong> went into investments — that part
            isn’t gone, it’s still yours and working. Counting it, you kept <strong className="up">{fmt0(net)}</strong>.
          </div>
        )}

        {/* month-by-month bars */}
        {byMonth.length > 0 ? (
          <div className="cf-bars">
            {byMonth.map(r => (
              <div className="cf-bar-col" key={r.ym} title={`${monthLong(r.ym)} · in ${fmt0(r.income)} · out ${fmt0(r.expense)}${r.invested ? ` · invested ${fmt0(r.invested)}` : ''} · net ${fmt0(r.net)}`}>
                <div className="cf-bar-pair">
                  <div className="cf-bar cf-bar-in"  style={{ height: (r.income / barMax * 100) + '%' }} />
                  <div className="cf-bar cf-bar-out" style={{ height: (r.expense / barMax * 100) + '%' }} />
                  {r.invested > 0 && <div className="cf-bar cf-bar-inv" style={{ height: (r.invested / barMax * 100) + '%' }} />}
                </div>
                <div className={'cf-bar-net mono ' + (r.net >= 0 ? 'up' : 'down')}>{r.net >= 0 ? '+' : '−'}{fmt0(Math.abs(r.net)).replace('$', '')}</div>
                <div className="cf-bar-label">{monthLabel(r.ym)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="hold-empty">No transactions in this range yet.</div>
        )}

        <div className="cf-legend">
          <span><i className="cf-dot cf-dot-in" /> Income</span>
          <span><i className="cf-dot cf-dot-out" /> Spending</span>
          {totals.invested > 0 && <span><i className="cf-dot cf-dot-inv" /> Invested</span>}
          {byMonth.length > 0 && (
            <span className="cf-legend-note">
              {positiveMonths === byMonth.length
                ? `Every month in the green — you kept money all ${byMonth.length} months. 🌱`
                : `${positiveMonths} of ${byMonth.length} months in the green.`}
            </span>
          )}
        </div>
      </Card>

      {/* balance trend + portfolio sync */}
      {checking.length > 0 && (
        <Card>
          <SectionLabel>Balance over time &amp; portfolio sync</SectionLabel>
          <p className="reb-tip" style={{ marginBottom: 12 }}>
            Link a checking account to one of your portfolio cash accounts — each new statement then writes its closing balance straight into your net worth, so you only enter it once.
          </p>
          <div className="cf-trend-list">
            {trends.map(({ acct, pts }) => {
              const linked = portfolioAccounts.find(p => p.id === acct.portfolioAccountId);
              return (
                <div className="cf-trend-row" key={acct.id}>
                  <div className="cf-trend-head">
                    <span className="cf-bal-name">{acct.emoji} {acct.name}</span>
                    <span className="cf-bal-amt mono">{pts.length ? fmt0(pts[pts.length - 1].v) : <span className="flat">—</span>}</span>
                  </div>
                  <Spark points={pts} />
                  <div className="cf-link">
                    <span className="cf-link-label">↪ Sync to:</span>
                    <select className="tx-cat" value={acct.portfolioAccountId || ''}
                      onChange={e => onLinkChange(acct.id, e.target.value)}>
                      <option value="">— not linked —</option>
                      {portfolioAccounts.map(p => (
                        <option key={p.id} value={p.id}>{p.label || '(unnamed)'}</option>
                      ))}
                    </select>
                    {linked && <Chip tone="soft">↺ auto-updates {linked.label}</Chip>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
