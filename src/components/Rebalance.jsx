import { useState } from 'react';
import { CATEGORIES } from '../data/portfolio';
import { Card, CatDot, Chip, ProgressBar, RegionBadge, SectionLabel, Term } from './ui';
import { fmt0 } from '../lib/format';

const pctOf = h => parseFloat(h.targetPct) || 0;
const sumTargets = items => items.reduce((a, h) => a + pctOf(h), 0);
const groupOk = (items, sum) => items.length === 0 || Math.abs(sum - 100) < 0.1;

// ── Layer 2: how one group is split between its own investments ──────────
// The group owns a % of the whole portfolio; these targets say how that slice
// is divided inside it. A 20% group split 60/40 means 12% and 8% of the total.
function GroupSplit({ cat, items, groupTarget, groupValue, totalVal, holdingValue, updateHolding, splitGroupEvenly, normalizeGroup, open, onToggle }) {
  const sum = sumTargets(items);
  const ok = groupOk(items, sum);
  // What this group *should* be worth once the top-layer target is hit — the
  // per-holding buy/trim numbers are measured against that, not today's value,
  // so the two layers point the same direction instead of fighting each other.
  const targetGroupValue = (groupTarget / 100) * totalVal;

  return (
    <div className="reb-inner">
      <button type="button" className="reb-inner-toggle" onClick={onToggle}
        title="Set how this group is divided between the investments inside it">
        <span className="reb-caret">{open ? '▾' : '▸'}</span>
        <span>Inside this group</span>
        <Chip tone={items.length === 0 ? 'soft' : ok ? 'up' : 'warn'}>
          {items.length === 0 ? 'empty' : `${sum.toFixed(1)}%`}
        </Chip>
      </button>

      {open && (items.length === 0 ? (
        <p className="reb-tip reb-inner-empty">Nothing in this group yet — add investments on the Holdings tab first.</p>
      ) : (
        <div className="reb-h-table">
          <div className="reb-h-row reb-h-head">
            <span>Investment</span>
            <span className="reb-h-num">
              <Term tip="This investment's share of its own group. All the rows here should add up to 100%.">Target</Term>
            </span>
            <span className="reb-h-num">
              <Term tip="What it is today, as a share of what the group is worth right now.">Actual</Term>
            </span>
            <span className="reb-h-num">
              <Term tip="Share of the whole portfolio: the group's target multiplied by this row's target.">Of total</Term>
            </span>
            <span className="reb-h-num">
              <Term tip="How much to add (or trim) to reach this target, once the group itself is at its own target.">Buy / trim</Term>
            </span>
          </div>

          {items.map(h => {
            const value = holdingValue(h);
            const target = pctOf(h);
            const actual = groupValue > 0 ? (value / groupValue) * 100 : 0;
            const ofTotal = (groupTarget * target) / 100;
            const needed = (targetGroupValue * target) / 100 - value;
            return (
              <div className="reb-h-row" key={h.id}>
                <span className="reb-h-id">
                  <span className="reb-h-tick mono">{h.ticker || '—'}</span>
                  {/* a group can hold reais and dollars at once now, and every
                      figure in this table is USD — the sticker says which rows
                      were converted to get there */}
                  <RegionBadge region={h.region} size="sm" />
                  <span className="reb-h-name">{h.name}</span>
                  {(h.shares || 0) <= 0 && <span className="reb-h-flag">not bought yet</span>}
                </span>
                <span className="reb-h-num">
                  <input type="number" className="reb-input mono" min="0" max="100" step="0.5"
                    value={h.targetPct ?? 0}
                    onChange={e => updateHolding(h.id, 'targetPct', e.target.value)} /> %
                </span>
                <span className="reb-h-num mono">{actual.toFixed(1)}%</span>
                <span className="reb-h-num mono soft-val">{ofTotal.toFixed(1)}%</span>
                <span className={'reb-h-num mono ' + (needed >= 0 ? 'up' : 'down')}>{fmt0(needed)}</span>
              </div>
            );
          })}

          <div className="reb-h-foot">
            <Chip tone={ok ? 'up' : 'warn'} title="The investments inside a group should add up to exactly 100% of that group.">
              {ok ? '✓' : '…'} {sum.toFixed(1)}% of {cat.name}
            </Chip>
            <span className="rev-spacer" />
            <button type="button" className="btn-soft" onClick={() => splitGroupEvenly(cat.id)}
              title="Give every investment in this group the same weight">
              Split evenly
            </button>
            <button type="button" className="btn-soft" disabled={sum <= 0} onClick={() => normalizeGroup(cat.id)}
              title="Keep the weights you typed but scale them so they add up to 100%">
              Scale to 100%
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Rebalance({ holdings, targets, categoryTotals, updateTarget, updateHolding, splitGroupEvenly, normalizeGroup, holdingValue }) {
  const [openCat, setOpenCat] = useState(null);
  const totals = categoryTotals();
  const totalVal = Object.values(totals).reduce((a, t) => a + t.value, 0);
  const targetSum = Object.values(targets).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const sumOk = Math.abs(targetSum - 100) < 0.1;

  const membersOf = catId => holdings.filter(h => h.category === catId);
  const needsSplit = CATEGORIES.filter(c => {
    const items = membersOf(c.id);
    return !groupOk(items, sumTargets(items));
  });

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
          Two layers. First set the target % for each <b>group</b> — those add up to 100% of the portfolio.
          Then open a group to split it between the <b>investments</b> inside it — those add up to 100% of that group.
          {' '}<Term tip="Rebalancing nudges your money back to the mix you chose — usually by directing new deposits to whatever is underweight.">Why rebalance?</Term>
        </p>
        <div className="reb-intro-chips">
          <Chip tone={sumOk ? 'up' : 'warn'} title="Your group targets should add up to exactly 100% of the portfolio.">
            {sumOk ? '✓' : '…'} Groups: {targetSum.toFixed(1)}%
          </Chip>
          <Chip tone={needsSplit.length === 0 ? 'up' : 'warn'}
            title={needsSplit.length === 0
              ? 'Every group is split to exactly 100% between its own investments.'
              : `These groups don't add up to 100% inside yet: ${needsSplit.map(c => c.name).join(', ')}`}>
            {needsSplit.length === 0 ? '✓ Splits set' : `… ${needsSplit.length} group${needsSplit.length > 1 ? 's' : ''} to split`}
          </Chip>
        </div>
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
                        ? <><b>Add about <span className="mono">{fmt0(needed)}</span> to {cat.name}</b> — {actual.toFixed(1)}% of the portfolio, target is {target}%. Open the group below to see which names that money should go to.</>
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
          const items = membersOf(cat.id);
          const isOpen = openCat === cat.id;

          return (
            <Card className={'reb-card' + (isOpen ? ' reb-card-open' : '')} key={cat.id}>
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

              <GroupSplit
                cat={cat}
                items={items}
                groupTarget={target}
                groupValue={value}
                totalVal={totalVal}
                holdingValue={holdingValue}
                updateHolding={updateHolding}
                splitGroupEvenly={splitGroupEvenly}
                normalizeGroup={normalizeGroup}
                open={isOpen}
                onToggle={() => setOpenCat(isOpen ? null : cat.id)}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
