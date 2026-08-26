import { useMemo } from 'react';
import { Card, Chip, SectionLabel, Term } from './ui';
import { fmt0 } from '../lib/format';
import { isCashAccount } from '../lib/statements';

// Accounts & balances — the bank-side plumbing that keeps net worth honest.
// Each imported statement carries a closing balance; this view shows where that
// cash sits, how it has moved, and lets you point an account at a portfolio cash
// account so the number updates itself instead of being typed in twice.
//
// It deliberately does NOT analyse spending. Household budgeting lives in Rocket
// Money now — the only thing this app reads out of a statement is the rental's
// transactions and the account's balance.

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

export default function Accounts({ b, portfolioAccounts = [], onLinkChange }) {
  // Cash-holding accounts (checking + savings) — credit cards owe, they don't hold.
  const cashAccts = useMemo(() => b.accounts.filter(a => isCashAccount(a.kind)), [b.accounts]);

  const balances = useMemo(
    () => cashAccts.map(a => ({ acct: a, bal: b.accountBalance(a.id) })),
    [cashAccts, b]);
  const totalCash = balances.reduce((s, x) => s + (x.bal || 0), 0);
  const haveBalances = balances.some(x => x.bal != null);

  // ── balance trend per account, from its statements ──
  const trends = useMemo(() => cashAccts.map(a => {
    const pts = b.statements
      .filter(s => s.accountId === a.id && s.endingBalance != null)
      .sort((x, y) => x.periodEnd.localeCompare(y.periodEnd))
      .map(s => ({ t: s.periodEnd, v: s.endingBalance }));
    return { acct: a, pts };
  }), [cashAccts, b.statements]);

  return (
    <>
      {/* cash on hand */}
      <Card className="hero">
        <div>
          <div className="hero-greeting">Where things stand 🏦</div>
          <div className="hero-networth">
            <Term tip="The real cash sitting in your bank (checking & savings) accounts right now — taken from the closing balance of the most recent statement for each. Credit cards aren't cash, so they're left out.">Cash on hand</Term>
            <div className="hero-amount">{haveBalances ? fmt0(totalCash) : '—'}</div>
          </div>
          {!haveBalances && (
            <div className="hero-goal-note">
              No bank balances captured yet. Import a <strong>checking</strong> or <strong>savings</strong> statement (not a card) and its closing balance shows up here.
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
            {!cashAccts.length && <div className="hs-sub">No cash accounts yet — only credit cards, which hold no balance.</div>}
          </div>
        </div>
      </Card>

      {/* accounts: rename, balance trend, portfolio sync */}
      {b.accounts.length > 0 && (
        <Card>
          <SectionLabel>Cards &amp; accounts</SectionLabel>
          <p className="reb-tip" style={{ marginBottom: 12 }}>
            Link a checking or savings account to one of your portfolio cash accounts — each new statement then writes its closing balance straight into your net worth, so you only enter it once.
          </p>
          <div className="cf-trend-list">
            {b.accounts.map(acct => {
              const isCash = isCashAccount(acct.kind);
              const pts = trends.find(t => t.acct.id === acct.id)?.pts || [];
              const linked = portfolioAccounts.find(p => p.id === acct.portfolioAccountId);
              return (
                <div className="cf-trend-row" key={acct.id}>
                  <div className="cf-trend-head">
                    <span className="cf-bal-name">
                      {acct.emoji}
                      <input className="bacct-name" value={acct.name}
                        onChange={e => b.renameAccount(acct.id, e.target.value)} />
                    </span>
                    <span className="cf-bal-amt mono">
                      {isCash
                        ? (pts.length ? fmt0(pts[pts.length - 1].v) : <span className="flat">—</span>)
                        : <span className="flat">credit card</span>}
                    </span>
                  </div>
                  <Spark points={pts} />
                  {isCash && (
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
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
