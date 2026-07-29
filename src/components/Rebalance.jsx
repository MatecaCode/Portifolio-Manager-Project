import { CATEGORIES } from '../data/portfolio';
import { Card, CatDot, Chip, ProgressBar, SectionLabel, Term } from './ui';
import { fmt0 } from '../lib/format';

export default function Rebalance({ targets, categoryTotals, updateTarget }) {
  const totals = categoryTotals();
  const totalVal = Object.values(totals).reduce((a, t) => a + t.value, 0);
  const targetSum = Object.values(targets).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const sumOk = Math.abs(targetSum - 100) < 0.1;

  // Written advice: biggest gaps first, ignore gaps under 1 percentage point
  const advice = CATEGORIES.map(cat => {
    const actual = totalVal > 0 ? (totals[cat.id].value / totalVal * 100) : 0;
    const target = parseFloat(targets[cat.id]) || 0;
    const needed = totalVal > 0 ? (target / 100 * totalVal) - totals[cat.id].value : 0;
    return { cat, actual, target, diff: actual - target, needed };
  }).filter(a => Math.abs(a.diff) >= 1)
    .sort((a, b) => Math.abs(b.needed) - Math.abs(a.needed));

  return (
    <div className="screen">
      <div className="reb-intro">
        <p>
          Set your target % per category. The filled bar is where you <b>are</b>; the little line is where you <b>want to be</b>.
          {' '}<Term tip="Rebalancing nudges your money back to the mix you chose — usually by directing new deposits to whatever is underweight.">Why rebalance?</Term>
        </p>
        <Chip tone={sumOk ? 'up' : 'warn'} title="Your targets should add up to exactly 100% of the portfolio.">
          {sumOk ? '✓' : '…'} Targets: {targetSum.toFixed(1)}%
        </Chip>
      </div>

      <Card>
        <SectionLabel>Where the portfolio is today</SectionLabel>
        {totalVal > 0 ? (
          <>
            <div className="reb-stack" title="Each colored segment is a category's share of the portfolio right now.">
              {CATEGORIES.map(cat => {
                const share = totals[cat.id].value / totalVal * 100;
                if (share <= 0) return null;
                return (
                  <div key={cat.id} className="reb-stack-seg"
                    style={{ width: `${share}%`, background: cat.color }}
                    title={`${cat.name}: ${share.toFixed(1)}% (target ${parseFloat(targets[cat.id]) || 0}%)`} />
                );
              })}
            </div>
            <div className="reb-stack-legend">
              {CATEGORIES.filter(c => totals[c.id].value > 0).map(cat => (
                <span key={cat.id} className="legend-item">
                  <CatDot color={cat.color} /> {cat.name} {(totals[cat.id].value / totalVal * 100).toFixed(1)}%
                </span>
              ))}
            </div>

            <SectionLabel>What to do about it</SectionLabel>
            <div className="reb-advice">
              {advice.length === 0 ? (
                <div className="reb-advice-row"><p>✅ Nicely balanced — every category is within 1% of its target. Nothing to do.</p></div>
              ) : (
                advice.map(({ cat, actual, target, needed }) => (
                  <div className="reb-advice-row" key={cat.id}>
                    <CatDot color={cat.color} size={11} />
                    <p>
                      {needed > 0
                        ? <><b>Add about <span className="mono">{fmt0(needed)}</span> to {cat.name}</b> — {actual.toFixed(1)}% of the portfolio, target is {target}%.</>
                        : <><b>{cat.name} is overweight</b> — {actual.toFixed(1)}% of the portfolio vs a {target}% target. Either trim about <b className="mono">{fmt0(Math.abs(needed))}</b>, or simply direct new money to the other categories until it evens out.</>}
                    </p>
                  </div>
                ))
              )}
            </div>
            <p className="reb-tip">Gentle tip: for long-term investing, rebalancing with <b>new deposits</b> usually beats selling — no taxes, no fees, no stress. 🌱</p>
          </>
        ) : (
          <p className="reb-tip">Once you own investments (quantity above zero), this section shows your real balance and what to adjust.</p>
        )}
      </Card>

      <div className="reb-grid">
        {CATEGORIES.map(cat => {
          const actual = totalVal > 0 ? (totals[cat.id].value / totalVal * 100) : 0;
          const target = parseFloat(targets[cat.id]) || 0;
          const diff = actual - target;
          const value = totals[cat.id].value;
          const needed = totalVal > 0 ? (target / 100 * totalVal) - value : 0;

          return (
            <Card className="reb-card" key={cat.id}>
              <div className="reb-card-head">
                <CatDot color={cat.color} size={10} />
                <span className="reb-card-name"><Term tip={cat.blurb}>{cat.name}</Term></span>
                <label className="reb-target">
                  Target
                  <input type="number" className="reb-input mono" value={targets[cat.id]} min="0" max="100" step="0.5"
                    onChange={e => updateTarget(cat.id, e.target.value)} /> %
                </label>
              </div>
              <ProgressBar pct={actual} marker={target} height={9} tone={actual > target + 1 ? 'down' : 'accent'} />
              <div className="reb-axis"><span>0%</span><span>100%</span></div>
              <div className="reb-stats">
                <div><div className="rs-label">Actual</div><div className="rs-val mono">{actual.toFixed(1)}%</div></div>
                <div>
                  <div className="rs-label"><Term tip="How far you are from the target, in percentage points.">Diff</Term></div>
                  <div className={'rs-val mono ' + (diff > 1 ? 'down' : 'up')}>{(diff >= 0 ? '+' : '') + diff.toFixed(1)}pp</div>
                </div>
                <div><div className="rs-label">Value</div><div className="rs-val mono">{fmt0(value)}</div></div>
                <div>
                  <div className="rs-label">{needed >= 0 ? 'Buy' : 'Trim'}</div>
                  <div className={'rs-val mono ' + (needed >= 0 ? 'up' : 'down')}>{fmt0(Math.abs(needed))}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
