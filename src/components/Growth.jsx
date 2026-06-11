import { useEffect, useMemo, useState } from 'react';
import { Card, Chip, SectionLabel, Term, AreaChart } from './ui';
import { fmt0 } from '../lib/format';

const HIST_KEY = 'sg_history';

// Real per-month history doesn't exist until file imports ship, so the app
// records a snapshot per month (net worth + money put in) as it gets used.
function monthLabel(d = new Date()) {
  return d.toLocaleDateString('en-US', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
}

function loadHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(HIST_KEY));
    return Array.isArray(h) ? h : [];
  } catch { return []; }
}

export default function Growth({ categoryTotals, accounts }) {
  const totals = categoryTotals();
  const totalVal = Object.values(totals).reduce((a, t) => a + t.value, 0);
  const totalCost = Object.values(totals).reduce((a, t) => a + t.cost, 0);
  const cashTotal = accounts.reduce((a, c) => a + (c.value || 0), 0);
  const netWorth = totalVal + cashTotal;
  const putIn = totalCost + cashTotal;

  // Merge this month's live snapshot into the stored series, and persist it
  const [storedHistory] = useState(loadHistory);
  const history = useMemo(() => {
    if (netWorth <= 0) return storedHistory;
    const m = monthLabel();
    return [...storedHistory.filter(h => h.m !== m).slice(-23), { m, invested: putIn, total: netWorth }];
  }, [storedHistory, netWorth, putIn]);

  useEffect(() => {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(history)) } catch { /* ignore */ }
  }, [history]);

  const hist = history.slice(-12);
  const hasStory = hist.length >= 2;
  const first = hist[0], last = hist[hist.length - 1];
  const growth = hasStory ? last.total - first.total : 0;
  const contributed = hasStory ? last.invested - first.invested : 0;
  const marketGain = growth - contributed;
  const monthChange = hasStory ? last.total - hist[hist.length - 2].total : 0;
  const isRecord = hasStory && last.total >= Math.max(...hist.map(h => h.total));
  const bestMonth = hasStory
    ? hist.reduce((best, h, i) => {
        if (i === 0) return best;
        const d = h.total - hist[i - 1].total;
        return d > best.d ? { m: h.m, d } : best;
      }, { m: '', d: -Infinity })
    : null;
  const spanLabel = hasStory ? `last ${hist.length} months` : 'your story starts here';
  const monthName = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const [monthly, setMonthly] = useState(300);
  const projection = useMemo(() => {
    const r = 0.07 / 12; // gentle 7%/yr assumption
    let v = netWorth;
    const out = [];
    for (let i = 1; i <= 120; i++) {
      v = v * (1 + r) + monthly;
      if (i % 12 === 0) out.push({ yr: i / 12, v });
    }
    return out;
  }, [monthly, netWorth]);

  return (
    <div className="screen">
      <Card>
        <SectionLabel right={
          <span className="section-label-right">
            {isRecord && <Chip tone="up">🏆 Record high</Chip>}
            {hasStory && <Chip tone={monthChange >= 0 ? 'up' : 'soft'}>{monthChange >= 0 ? '▲' : '▼'} {fmt0(Math.abs(monthChange))} this month</Chip>}
          </span>
        }>
          Your money story · {spanLabel}
        </SectionLabel>
        {hasStory ? (
          <>
            <AreaChart data={hist} />
            <div className="legend">
              <span className="legend-item"><span className="legend-swatch legend-total"></span><Term tip="Investments + cash, added together, at the end of each month.">Net worth</Term></span>
              <span className="legend-item"><span className="legend-swatch legend-invested"></span><Term tip="The money you actually deposited — so you can see what the market did on top of it.">What you put in</Term></span>
            </div>
          </>
        ) : (
          <div className="explainer">
            <p>
              This chart fills in as the months go by — the app saves a snapshot of your net worth each month
              from now on. Come back next month to see your first data point grow into a line. 🌱
            </p>
          </div>
        )}
      </Card>

      {hasStory && (
        <Card>
          <SectionLabel>Your money story · {monthName}</SectionLabel>
          <div className="story-grid">
            <div className="story-cell">
              <div className="story-emoji">{monthChange >= 0 ? '🌞' : '🌧️'}</div>
              <div className="story-text">Net worth {monthChange >= 0 ? 'grew' : 'dipped'} <b className={'mono ' + (monthChange >= 0 ? 'up' : 'down')}>{fmt0(monthChange, { plus: true })}</b> this month{isRecord ? ' — a new record for you two! 🎉' : monthChange >= 0 ? '.' : ' — red days are normal; the long game is what counts.'}</div>
            </div>
            <div className="story-cell">
              <div className="story-emoji">💡</div>
              <div className="story-text">
                {contributed > 0
                  ? <>You deposited <b className="mono">{fmt0(contributed)}</b> over this stretch — the part you control. 💪</>
                  : <>Deposits were quiet, so the markets and your savings interest did all the lifting.</>}
              </div>
            </div>
            <div className="story-cell">
              <div className="story-emoji">⭐</div>
              <div className="story-text">Best month so far: <b>{bestMonth.m}</b>, up <b className="mono up">{fmt0(bestMonth.d, { plus: true })}</b>.</div>
            </div>
          </div>
        </Card>
      )}

      {hasStory && (
        <div className="three-col">
          <Card className="recap-card">
            <div className="recap-emoji">📈</div>
            <div className={'recap-value ' + (growth >= 0 ? 'up' : 'down')}>{fmt0(growth, { plus: true })}</div>
            <div className="recap-label">net worth growth in {hist.length} months</div>
          </Card>
          <Card className="recap-card">
            <div className="recap-emoji">🫶</div>
            <div className="recap-value">{fmt0(contributed)}</div>
            <div className="recap-label">came from your own deposits — the part you control</div>
          </Card>
          <Card className="recap-card">
            <div className="recap-emoji">🌊</div>
            <div className={'recap-value ' + (marketGain >= 0 ? 'up' : 'down')}>{fmt0(marketGain, { plus: true })}</div>
            <div className="recap-label">came from markets &amp; interest doing their thing</div>
          </Card>
        </div>
      )}

      <Card>
        <SectionLabel>If you keep going… ✨</SectionLabel>
        <div className="proj-controls">
          <span>Investing</span>
          <input type="range" min="50" max="2000" step="50" value={monthly} onChange={e => setMonthly(+e.target.value)} className="proj-slider" />
          <span className="proj-amount">{fmt0(monthly)}/month</span>
          <span className="proj-note">
            assuming a calm <Term tip="A middle-of-the-road long-term return for a diversified portfolio. Not a promise — just a planning number.">7% per year</Term>
          </span>
        </div>
        <div className="proj-grid">
          {[1, 3, 5, 10].map(yr => {
            const p = projection.find(x => x.yr === yr);
            return (
              <div className="proj-cell" key={yr}>
                <div className="proj-yr">in {yr} {yr === 1 ? 'year' : 'years'}</div>
                <div className="proj-val">{fmt0(p.v)}</div>
              </div>
            );
          })}
        </div>
        <p className="proj-foot">That curve bending up? That's <Term tip="Earnings earning their own earnings. The first years feel slow, then it takes off — the trick is simply not stopping.">compound interest</Term> — the quiet superpower. ✨</p>
      </Card>
    </div>
  );
}
