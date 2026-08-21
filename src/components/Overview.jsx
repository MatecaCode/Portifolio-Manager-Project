import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, REGIONS, bucketOf, categoryById } from '../data/portfolio';
import { Card, CatDot, Chip, Donut, ProgressBar, RegionBadge, SectionLabel, Term } from './ui';
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

const fmtQty = n => n.toLocaleString('en-US', { maximumFractionDigits: 5 });

export default function Overview({ holdings, categoryTotals, regionTotals, holdingValue, holdingCost, fxRate, setFxRate, onCategoryClick, accounts, derivedAccounts = [], addAccount, updateAccount, removeAccount, onManageRental }) {
  const totals = categoryTotals();
  const byRegion = regionTotals();
  const totalVal = Object.values(totals).reduce((a, t) => a + t.value, 0);
  const totalCost = Object.values(totals).reduce((a, t) => a + t.cost, 0);
  const pnl = totalVal - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost * 100) : 0;
  // Emergency savings is money with a job, so it sits with the investments
  // rather than with spending money. "Cash" then means what it says: the liquid
  // balance in checking and broker accounts.
  const allAccounts = [...accounts, ...derivedAccounts];
  const savingsTotal = allAccounts.filter(a => bucketOf(a) === 'savings').reduce((a, c) => a + (c.value || 0), 0);
  const cashTotal    = allAccounts.filter(a => bucketOf(a) !== 'savings').reduce((a, c) => a + (c.value || 0), 0);
  const pendingBalances = derivedAccounts.filter(c => c.value == null).length;
  const accountCount = allAccounts.filter(a => bucketOf(a) !== 'savings').length;
  const netWorth = totalVal + savingsTotal + cashTotal;
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

  // The ring is the investment mix, full stop — the same categories Rebalance
  // tracks. The emergency fund has no rebalance target and isn't a bet on
  // anything, so it doesn't compete for a slice here; it gets its own stat
  // instead (see the hero above).
  const ownedSlices = CATEGORIES
    .map(c => ({ id: c.id, name: c.name, color: c.color, value: totals[c.id].value }))
    .filter(s => s.value > 0);
  const slices = ownedSlices.length ? ownedSlices : [{ id: 'none', color: 'var(--accent-soft)', value: 1 }];

  const sortedCategories = [...CATEGORIES].sort((a, b) => totals[b.id].value - totals[a.id].value);
  const diversified = slices.length > 1;
  const savingsShareOfNetWorth = netWorth > 0 ? (savingsTotal / netWorth * 100) : 0;

  // Country lives on each holding now, so the geographic mix is its own view
  // rather than something you read off the bucket names.
  const regionSlices = REGIONS
    .map(r => ({ ...r, value: byRegion[r.id].value }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);

  // ── Chart ⇄ list linkage ───────────────────────────────────────────────
  // Hovering the ring previews a category in the panel beside it; clicking pins
  // it so you can read the list without keeping the pointer still. Hover always
  // wins over the pin, so you can peek at a neighbour and fall back to what's
  // pinned when you leave.
  const [hoverCat, setHoverCat] = useState(null);
  const [pinnedCat, setPinnedCat] = useState(null);
  const [rowCat, setRowCat] = useState(null);
  // After a click that un-pins, the pointer is still sitting on the wedge —
  // without this the hover preview would light it straight back up and the
  // click would look like it did nothing.
  const mutedRef = useRef(null);
  const activeCat = hoverCat ?? pinnedCat;
  // Rows only tint the ring; they never swap the panel out from under the
  // cursor (that would delete the very thing you were pointing at).
  const ringCat = activeCat ?? rowCat;

  const onHover = id => {
    if (id == null) { mutedRef.current = null; setHoverCat(null); return }
    if (mutedRef.current === id) return;
    setHoverCat(id);
  };
  const onPick = id => {
    if (pinnedCat === id) {
      mutedRef.current = id;
      setPinnedCat(null);
      setHoverCat(null);
    } else {
      mutedRef.current = null;
      setPinnedCat(id);
      setHoverCat(id);
    }
  };
  const clearCat = () => { mutedRef.current = null; setPinnedCat(null); setHoverCat(null) };

  useEffect(() => {
    if (!pinnedCat) return;
    const onKey = e => { if (e.key === 'Escape') clearCat() };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinnedCat]);

  const activeInfo = activeCat ? categoryById(activeCat) : null;
  const activeTotals = activeCat ? totals[activeCat] : null;
  const activeShare = activeTotals && totalVal > 0 ? (activeTotals.value / totalVal * 100) : 0;
  // Owned first and biggest-first; the ones still on the wish list trail behind
  // so the card doubles as "what's left to start".
  const activeHoldings = activeCat
    ? holdings
        .filter(h => h.category === activeCat)
        .map(h => ({ ...h, val: holdingValue(h), cst: holdingCost(h) }))
        .sort((a, b) => b.val - a.val || String(a.ticker).localeCompare(String(b.ticker)))
    : [];
  // A dimmed legend entry has no wedge to light up, so don't ask the ring to
  // highlight something that isn't drawn — that would just dim everything.
  const ringActiveId = slices.some(s => s.id === ringCat) ? ringCat : null;

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
            <Term tip="Everything you own minus everything you owe. Here it's your investments, your emergency fund, and your cash.">Net worth</Term>
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
            <div className="hs-label"><Term tip="Money in stocks, funds and crypto — the categories tracked on the Rebalance tab. The emergency fund isn't a bet on anything, so it's kept separate below.">Invested</Term></div>
            <div className="hs-value">{fmt(totalVal)}</div>
          </div>
          {savingsTotal > 0 && (
            <div className="hero-stat">
              <div className="hs-label"><Term tip="Money set aside for emergencies. It's real money working for you — it counts toward net worth — but it isn't an investment: no rebalance target, no market risk, its own thing.">Emergency fund</Term></div>
              <div className="hs-value">{fmt(savingsTotal)}</div>
              <div className="hs-sub">{savingsShareOfNetWorth.toFixed(0)}% of net worth</div>
            </div>
          )}
          <div className="hero-stat">
            <div className="hs-label"><Term tip="Truly liquid money — what's sitting in your checking and broker cash accounts, ready to spend or invest.">Cash</Term></div>
            <div className="hs-value">{fmt(cashTotal)}</div>
            <div className="hs-sub">
              across {accountCount} account{accountCount === 1 ? '' : 's'}
              {pendingBalances > 0 && <> · <span className="down">{pendingBalances} need re-import</span></>}
            </div>
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
          <div className="alloc-stage">
            <Donut
              slices={slices}
              size={236}
              activeId={ringActiveId}
              onSliceHover={onHover}
              onSliceClick={onPick}
              ariaLabel="Investment mix by category — hover a slice to see what's in it"
              centerTop={activeInfo ? fmt0(activeTotals.value) : fmt0(totalVal)}
              centerBottom={activeInfo ? activeInfo.name : 'invested'}
            />
          </div>

          {regionSlices.length > 0 && (
            <div className="region-split">
              {/* Percentages here are of market holdings only. The ring above
                  also counts the emergency fund, which has no country — sharing
                  a denominator would make both numbers wrong. */}
              <div className="region-split-label">
                <Term tip="Where your money actually sits in the world. Each holding carries a country sticker — this adds them up. The emergency fund isn't in here: it's cash, not a bet on a country.">By country</Term>
                {savingsTotal > 0 && <span className="region-split-scope">of {fmt0(totalVal)} in markets</span>}
              </div>
              <div className="region-bar">
                {regionSlices.map(r => (
                  <div key={r.id} className="region-bar-seg" style={{ width: `${r.value / totalVal * 100}%`, background: r.color }}
                    title={`${r.name}: ${fmt(r.value)} (${(r.value / totalVal * 100).toFixed(1)}%)`} />
                ))}
              </div>
              <div className="region-split-legend">
                {regionSlices.map(r => (
                  <span className="legend-item" key={r.id}>
                    <CatDot color={r.color} /> {r.code} {(r.value / totalVal * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Legend + prose live under the chart: the ring is the headline here,
              and the legend doubles as the keyboard/pointer handle for the
              slivers that are too thin to hover. */}
          <div className="alloc-foot">
            <div className="alloc-legend">
              {sortedCategories.map(c => (
                <button type="button" key={c.id}
                  className={'legend-item alloc-legend-btn'
                    + (totals[c.id].value > 0 ? '' : ' legend-empty')
                    + (activeCat === c.id ? ' on' : '')}
                  title={`Show the ${c.name} investments`}
                  onMouseEnter={() => onHover(c.id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(c.id)}
                  onBlur={() => onHover(null)}
                  onClick={() => onPick(c.id)}>
                  <CatDot color={c.color} /> {c.name}
                </button>
              ))}
            </div>
            <p className="alloc-line">
              {diversified
                ? <>Money spread across {slices.length} categories — the <b>Rebalance</b> tab shows how close you are to the mix you chose. 🦩</>
                : <>All eggs in one basket for now — the <b>Rebalance</b> tab has the plan to spread new money around. Every color here is a future win. 🦩</>}
            </p>
            <p className="alloc-hint">
              {pinnedCat
                ? 'Pinned — click it again (or press Esc) to let go.'
                : 'Hover a slice to see what\'s inside it; click to pin it.'}
            </p>
          </div>
        </Card>

        <Card>
          {activeInfo ? (
            <>
              <SectionLabel right={
                <>
                  <Chip tone="soft">{activeShare.toFixed(1)}% of invested</Chip>
                  {pinnedCat === activeCat && (
                    <button className="drill-open" type="button" onClick={clearCat} title="Unpin (Esc)">✕ unpin</button>
                  )}
                </>
              }>
                <span className="drill-head">
                  <CatDot color={activeInfo.color} size={11} />
                  <span className="drill-title">{activeInfo.name}</span>
                </span>
              </SectionLabel>
              <p className="drill-blurb">{activeInfo.blurb}</p>
              <div className="drill-list">
                {activeHoldings.length === 0 && (
                  <div className="hold-empty">Nothing on the list here yet — add one on the Holdings tab.</div>
                )}
                {activeHoldings.map(h => {
                  const owned = (h.shares || 0) > 0;
                  const pnl = h.val - h.cst;
                  return (
                    <div className={'drill-row' + (owned ? '' : ' is-empty')} key={h.id}>
                      <div className="drill-id">
                        <span className="drill-top">
                          <span className="drill-ticker">{h.ticker}</span>
                          <RegionBadge region={h.region} size="sm" />
                          <span className="drill-name">{h.name}</span>
                        </span>
                        <span className="drill-sub">
                          {owned ? `${fmtQty(h.shares)} × ${fmt(h.price || 0)}` : 'not started yet'}
                        </span>
                      </div>
                      <div className="drill-vals">
                        <div className="drill-value">{owned ? fmt(h.val) : '—'}</div>
                        <div className={'drill-pl ' + (!owned ? 'flat' : pnl < 0 ? 'down' : pnl > 0 ? 'up' : 'flat')}>
                          {owned
                            ? `${fmt(pnl, { plus: true })} · ${(h.cst > 0 ? (pnl / h.cst * 100) : 0).toFixed(1)}%`
                            : 'on the list'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="drill-foot">
                <span className="cat-sub">{activeTotals.owned} owned · {activeTotals.count} on the list</span>
                <button className="drill-open" type="button" onClick={() => onCategoryClick?.(activeCat)}>
                  Open in Holdings →
                </button>
              </div>
            </>
          ) : (
            <>
              <SectionLabel>By category</SectionLabel>
              <div className="cat-list">
                {sortedCategories.map(c => {
                  const t = totals[c.id];
                  const catPnl = t.value - t.cost;
                  return (
                    <div className="cat-row clickable" key={c.id} onClick={() => onCategoryClick?.(c.id)}
                      onMouseEnter={() => setRowCat(c.id)} onMouseLeave={() => setRowCat(null)}
                      title={`Click to see the ${c.name} investments`}>
                      <CatDot color={c.color} />
                      <div className="cat-name">
                        <span><Term tip={c.blurb}>{c.name}</Term></span>
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
            </>
          )}
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
      }>Accounts · {fmt(cashTotal)} cash + {fmt(savingsTotal)} savings</SectionLabel>
      <div className="acct-grid">
        {derivedAccounts.map(acc => {
          const known = acc.value != null;
          return (
            <Card className="acct-card acct-card-linked" key={acc.id}
              title="This balance comes straight from the statements you import on the Rental side — it updates itself, so there's nothing to type here.">
              <div className="acct-head">
                <span className="acct-name-static">🏦 {acc.label}</span>
                {known
                  ? <Chip tone="soft"><Term tip="The closing balance of this account's most recent imported statement. Import a newer one on the Rental tab and this updates automatically.">📄 from statements</Term></Chip>
                  : <Chip tone="warn"><Term tip="This account's statements were imported before balance tracking existed, so no closing balance was captured. Re-import the statement on the Rental tab (remove it, then drop the PDF again) and the balance will appear here and update on its own.">⚠ needs re-import</Term></Chip>}
              </div>
              <div className="acct-note-static">{known ? acc.note : 'Re-import this statement on the Rental tab to capture its balance'}</div>
              <div className="acct-value acct-value-static">{known ? fmt(acc.value) : '—'}</div>
              <button className="acct-manage" type="button" title="Manage statements for this account"
                onClick={() => onManageRental?.()}>Manage in Rental →</button>
            </Card>
          );
        })}
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
            {/* Which side of the picture this account counts on. Savings joins
                the investments ring; cash stays liquid. */}
            <div className="acct-bucket" role="group" aria-label="Account type">
              {[
                { id: 'cash',    label: 'Cash',    tip: 'Liquid — checking or broker cash you could spend today.' },
                { id: 'savings', label: 'Savings', tip: 'Emergency fund — counts with your investments, but gets no rebalance target.' },
              ].map(b => (
                <button key={b.id} type="button" title={b.tip}
                  className={'acct-bucket-btn' + (bucketOf(acc) === b.id ? ' on' : '')}
                  onClick={() => updateAccount(acc.id, 'bucket', b.id)}>
                  {b.label}
                </button>
              ))}
            </div>
            <div className="acct-value"
              title="Balances are updated by hand for now — type the current balance here, or import a statement on the Rental tab to track a bank account automatically.">
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
