// Rebalance screen
const { useState: useRebState } = React;

function Rebalance() {
  const D = window.PF_DATA;
  const [targets, setTargets] = useRebState(Object.fromEntries(D.categories.map(c => [c.id, c.target])));
  const totalTarget = Object.values(targets).reduce((s, v) => s + v, 0);

  return (
    <div className="screen">
      <div className="reb-intro">
        <p>
          Set your target % per category. The filled bar is where you <b>are</b>; the little line is where you <b>want to be</b>.
          {" "}<Term tip="Rebalancing nudges your money back to the mix you chose — usually by directing new deposits to whatever is underweight.">Why rebalance?</Term>
        </p>
        <Chip tone={totalTarget === 100 ? "up" : "warn"}>{totalTarget === 100 ? "✓" : "…"} Targets: {totalTarget.toFixed(1)}%</Chip>
      </div>

      <Card>
        <SectionLabel>Where the portfolio is today</SectionLabel>
        <div className="reb-stack">
          {D.categories.filter(c => c.actual > 0).map(c => (
            <div className="reb-stack-seg" key={c.id} style={{ width: c.actual + "%", background: `var(--cat-${c.id})` }}></div>
          ))}
        </div>
        <div className="reb-stack-legend">
          {D.categories.filter(c => c.actual > 0).map(c => (
            <span key={c.id} className="legend-item"><CatDot id={c.id} /> {c.name} {c.actual.toFixed(1)}%</span>
          ))}
        </div>

        <SectionLabel>What to do about it</SectionLabel>
        <div className="reb-advice">
          {D.rebalance.map(r => {
            const c = D.categories.find(x => x.id === r.id);
            return (
              <div className="reb-advice-row" key={r.id}>
                <CatDot id={r.id} size={11} />
                <p>
                  {r.action === "trim"
                    ? <span><b>{c.name} is overweight</b> — {r.why} Trimming about <b className="mono">{fmt0(r.amount)}</b> would even it out.</span>
                    : <span><b>Add about <span className="mono">{fmt0(r.amount)}</span> to {c.name}</b> — {r.why}</span>}
                </p>
              </div>
            );
          })}
        </div>
        <p className="reb-tip">Gentle tip: for long-term investing, rebalancing with <b>new deposits</b> usually beats selling — no taxes, no fees, no stress. 🌱</p>
      </Card>

      <div className="reb-grid">
        {D.categories.map(c => {
          const t = targets[c.id];
          const diff = c.actual - t;
          const buyAmt = D.rebalance.find(r => r.id === c.id);
          return (
            <Card className="reb-card" key={c.id}>
              <div className="reb-card-head">
                <CatDot id={c.id} size={10} />
                <span className="reb-card-name">{c.name}</span>
                <label className="reb-target">
                  Target
                  <input type="number" className="reb-input mono" value={t} min="0" max="100"
                         onChange={e => setTargets({ ...targets, [c.id]: +e.target.value || 0 })} /> %
                </label>
              </div>
              <ProgressBar pct={c.actual} marker={t} height={9} tone={c.actual > t + 1 ? "down" : "accent"} />
              <div className="reb-axis"><span>0%</span><span>100%</span></div>
              <div className="reb-stats">
                <div><div className="rs-label">Actual</div><div className="rs-val mono">{c.actual.toFixed(1)}%</div></div>
                <div><div className="rs-label"><Term tip="How far you are from the target, in percentage points.">Diff</Term></div>
                  <div className={"rs-val mono " + (diff > 1 ? "down" : "up")}>{(diff >= 0 ? "+" : "") + diff.toFixed(1)}pp</div></div>
                <div><div className="rs-label">Value</div><div className="rs-val mono">{fmt0(c.value)}</div></div>
                <div><div className="rs-label">{buyAmt && buyAmt.action === "trim" ? "Trim" : "Buy"}</div>
                  <div className={"rs-val mono " + (buyAmt && buyAmt.action === "trim" ? "down" : "up")}>{buyAmt ? fmt0(buyAmt.amount) : "—"}</div></div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Rebalance });
