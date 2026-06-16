import { useEffect, useState } from 'react';
import { CATEGORIES } from '../data/portfolio';
import { Card, CatDot, Chip, Donut, ProgressBar, SectionLabel, Term } from './ui';
import { fmt, fmt0 } from '../lib/format';

const GOAL_KEY = 'sg_goal';
const PEAK_KEY = 'sg_max_networth';

const DEFAULT_GOAL = { label: 'First $20k together', target: 20000 };

function loadGoal() {
  try {
    const g = JSON.parse(localStorage.getItem(GOAL_KEY));
    if (g && g.label && g.target > 0) return g;
  } catch { /* fall through */ }
  return DEFAULT_GOAL;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning, you two ☀️';
  if (h < 18) return 'Good afternoon, you two ☀️';
  return 'Good evening, you two 🌙';
}

export default function Overview({ holdings, categoryTotals, fxRate, setFxRate, onCategoryClick, accounts, derivedAccounts = [], addAccount, updateAccount, removeAccount, onManageBudget }) {
  const totals = categoryTotals();
  const totalVal = Object.values(totals).reduce((a, t) => a + t.value, 0);
  const totalCost = Object.values(totals).reduce((a, t) => a + t.cost, 0);
  const pnl = totalVal - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost * 100) : 0;
  const manualCash = accounts.reduce((a, c) => a + (c.value || 0), 0);
  const derivedCash = derivedAccounts.reduce((a, c) => a + (c.value || 0), 0);
  const cashTotal = manualCash + derivedCash;
  const accountCount = accounts.length + derivedAccounts.length;
  const netWorth = totalVal + cashTotal;
  const ownedCount = holdings.filter(h => (h.shares || 0) > 0).length;

  const [goal, setGoal] = useState(loadGoal);
  const [editingGoal, setEditingGoal] = useState(false);
  const saveGoal = (g) => {
    setGoal(g);
    try { localStorage.setItem(GOAL_KEY, JSON.stringify(g)) } catch { /* ignore */ }
  };
  const goalPct = Math.min(100, (netWorth / goal.target) * 100);

  // All-time-high celebration: compare against the highest net worth seen on this device
  const [peakAtLoad] = useState(() => parseFloat(localStorage.getItem(PEAK_KEY)) || 0);
  const isRecord = netWorth > 0 && netWorth >= peakAtLoad;
  useEffect(() => {
    if (netWorth <= 0) return;
    const peak = parseFloat(localStorage.getItem(PEAK_KEY)) || 0;
    if (netWorth > peak) {
      try { localStorage.setItem(PEAK_KEY, String(netWorth)) } catch { /* ignore */ }
    }
  }, [netWorth]);

  const ownedSlices = CATEGORIES
    .map(c => ({ id: c.id, color: c.color, value: totals[c.id].value }))
    .filter(s => s.value > 0);
  const slices = ownedSlices.length ? ownedSlices : [{ id: 'none', color: 'var(--accent-soft)', value: 1 }];

  const sortedCategories = [...CATEGORIES].sort((a, b) => totals[b.id].value - totals[a.id].value);
  const diversified = slices.length > 1;

  return (
    <div className="screen">
      {/* Hero: greeting + net worth + goal */}
      <Card className="hero">
        <div>
          <div className="hero-greeting">{greeting()}</div>
          {isRecord && (
            <div className="celebrate-row">
              <span className="celebrate-chip">🎉 All-time high net worth!</span>
            </div>
          )}
          <div className="hero-networth">
            <Term tip="Everything you own minus everything you owe. Here it's your investments plus your cash.">Net worth</Term>
            <div className="hero-amount">{fmt(netWorth)}</div>
          </div>
          <div>
            <div className="hero-goal-row">
              {editingGoal ? (
                <span className="hero-goal-label">
                  <input className="goal-edit-input goal-edit-name" value={goal.label}
                    onChange={e => saveGoal({ ...goal, label: e.target.value })} />
                  $<input className="goal-edit-input goal-edit-amount" type="number" min="1" value={goal.target}
                    onChange={e => saveGoal({ ...goal, target: parseFloat(e.target.value) || goal.target })} />
                  <button className="goal-edit-btn" onClick={() => setEditingGoal(false)}>✓ done</button>
                </span>
              ) : (
                <span className="hero-goal-label">
                  {goal.label}
                  <button className="goal-edit-btn" title="Edit your goal" onClick={() => setEditingGoal(true)}>✎</button>
                </span>
              )}
              <span className="hero-goal-pct">{goalPct.toFixed(0)}% there</span>
            </div>
            <ProgressBar pct={goalPct} height={10} />
            <div className="hero-goal-note">
              {netWorth >= goal.target
                ? 'Goal reached — time to dream up the next one! 🎉'
                : <>{fmt0(goal.target - netWorth)} to go — every deposit moves this bar 💪</>}
            </div>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-stat">
            <div className="hs-label"><Term tip="Money currently in stocks, funds and crypto — not counting the emergency fund.">Invested</Term></div>
            <div className="hs-value">{fmt(totalVal)}</div>
          </div>
          <div className="hero-stat">
            <div className="hs-label"><Term tip="Cash sitting in your bank and brokerage accounts, ready to use or invest.">Cash</Term></div>
            <div className="hs-value">{fmt(cashTotal)}</div>
            <div className="hs-sub">across {accountCount} account{accountCount === 1 ? '' : 's'}</div>
          </div>
          <div className="hero-stat">
            <div className="hs-label"><Term tip="Profit or Loss — how much your investments have gained or lost since you bought them. Red days are normal; the long game is what counts.">Profit / Loss</Term></div>
            <div className={'hs-value ' + (pnl < 0 ? 'down' : 'up')}>{fmt(pnl, { plus: true })}</div>
            <div className={'hs-sub ' + (pnl < 0 ? 'down' : 'up')}>{(pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1)}%</div>
          </div>
        </div>
      </Card>

      {/* Allocation + categories */}
      <div className="two-col">
        <Card>
          <SectionLabel right={<Chip>{ownedCount} investments owned</Chip>}>
            <Term tip="How your invested money is split between different types of investments.">Allocation</Term>
          </SectionLabel>
          <div className="alloc-body">
            <Donut
              slices={slices}
              centerTop={fmt0(totalVal)}
              centerBottom="invested"
            />
            <div className="alloc-note">
              <div className="alloc-legend">
                {CATEGORIES.map(c => (
                  <span className="legend-item" key={c.id}><CatDot color={c.color} /> {c.name}</span>
                ))}
              </div>
              <p className="alloc-line">
                {diversified
                  ? <>Money spread across {slices.length} categories — the <b>Rebalance</b> tab shows how close you are to the mix you chose. 🦩</>
                  : <>All eggs in one basket for now — the <b>Rebalance</b> tab has the plan to spread new money around. Every color here is a future win. 🦩</>}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionLabel>By category</SectionLabel>
          <div className="cat-list">
            {sortedCategories.map(c => {
              const t = totals[c.id];
              const catPnl = t.value - t.cost;
              return (
                <div className="cat-row clickable" key={c.id} onClick={() => onCategoryClick?.(c.id)}
                  title={`Click to see the ${c.name} investments`}>
                  <CatDot color={c.color} />
                  <div className="cat-name">
                    {c.id === 'fii' ? <span><Term tip="Fundos Imobiliários — Brazilian real-estate funds that pay monthly rent-like income.">{c.name}</Term></span>
                      : c.id === 'renda_fixa' ? <span><Term tip="Brazil's version of bonds and CDs — steady, predictable interest.">{c.name}</Term></span>
                      : c.name}
                    <span className="cat-sub">{t.owned} owned · {t.count} on the list</span>
                  </div>
                  <div className="cat-vals">
                    <div className="cat-value">{fmt(t.value)}</div>
                    <div className={'cat-pl ' + (t.value === 0 ? 'flat' : catPnl < 0 ? 'down' : catPnl > 0 ? 'up' : 'flat')}>
                      {t.value === 0 ? 'ready to start' : `${fmt(catPnl, { plus: true })} · ${(t.cost > 0 ? (catPnl / t.cost * 100) : 0).toFixed(1)}%`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Accounts */}
      <SectionLabel right={
        <span className="acct-tools">
          <label className="fx-pill" title="The exchange rate used to show Brazilian investments in US dollars. You can edit it.">
            USD/BRL
            <input type="number" step="0.01" value={fxRate}
              onChange={e => setFxRate(parseFloat(e.target.value) || 5.70)} />
          </label>
          <button className="btn-soft" type="button" onClick={addAccount}>+ Add account</button>
        </span>
      }>Accounts · {fmt(cashTotal)} cash</SectionLabel>
      <div className="acct-grid">
        {derivedAccounts.map(acc => (
          <Card className="acct-card acct-card-linked" key={acc.id}
            title="This balance comes straight from the statements you import on the Budget side — it updates itself, so there's nothing to type here.">
            <div className="acct-head">
              <span className="acct-name-static">🏦 {acc.label}</span>
              <Chip tone="soft"><Term tip="The closing balance of this account's most recent imported statement. Import a newer one on the Budget tab and this updates automatically.">📄 from statements</Term></Chip>
            </div>
            <div className="acct-note-static">{acc.note}</div>
            <div className="acct-value acct-value-static">{fmt(acc.value || 0)}</div>
            <button className="acct-manage" type="button" title="Manage statements for this account"
              onClick={() => onManageBudget?.()}>Manage in Budget →</button>
          </Card>
        ))}
        {accounts.map(acc => (
          <Card className="acct-card" key={acc.id}>
            <div className="acct-head">
              <input className="acct-name-input" value={acc.label} placeholder="Account name"
                onChange={e => updateAccount(acc.id, 'label', e.target.value)} />
              {acc.apy ? (
                <Chip tone="up"><Term tip="Annual Percentage Yield — the interest this cash earns in a year, compounding included.">{acc.apy}% APY</Term></Chip>
              ) : null}
            </div>
            <input className="acct-note-input" value={acc.note || ''} placeholder="Note (e.g. emergency fund)"
              onChange={e => updateAccount(acc.id, 'note', e.target.value)} />
            <div className="acct-value"
              title="Balances are updated by hand for now — type the current balance here, or import a statement on the Budget tab to track a bank account automatically.">
              $<input className="acct-value-input" type="number" step="0.01" value={acc.value || ''} placeholder="0.00"
                onChange={e => updateAccount(acc.id, 'value', e.target.value)} />
            </div>
            <button className="acct-del" title="Remove this account"
              onClick={() => { if (confirm(`Remove "${acc.label || 'this account'}"?`)) removeAccount(acc.id) }}>×</button>
          </Card>
        ))}
      </div>
    </div>
  );
}
