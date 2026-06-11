// Growth screen — historical growth, recap, projection
const { useMemo, useState: useGrowthState } = React;

function Growth() {
  const D = window.PF_DATA;
  const hist = D.history;
  const first = hist[0], last = hist[hist.length - 1];
  const growth = last.total - first.total;
  const contributed = last.invested - first.invested;
  const marketGain = growth - contributed;
  const monthChange = last.total - hist[hist.length - 2].total;
  const isRecord = last.total >= Math.max(...hist.map(h => h.total));
  const bestMonth = hist.reduce((best, h, i) => {
    if (i === 0) return best;
    const d = h.total - hist[i - 1].total;
    return d > best.d ? { m: h.m, d } : best;
  }, { m: "", d: -Infinity });

  const [monthly, setMonthly] = useGrowthState(300);
  const projection = useMemo(() => {
    const r = 0.07 / 12; // gentle 7%/yr assumption
    let v = last.total;
    const out = [];
    for (let i = 1; i <= 120; i++) {
      v = v * (1 + r) + monthly;
      if (i % 12 === 0) out.push({ yr: i / 12, v });
    }
    return out;
  }, [monthly, last.total]);

  return (
    <div className="screen">
      <Card className="growth-hero">
        <SectionLabel right={
          <span className="section-label-right">
            {isRecord && <Chip tone="up">🏆 Record high</Chip>}
            <Chip tone={monthChange >= 0 ? "up" : "soft"}>{monthChange >= 0 ? "▲" : "▼"} {fmt0(Math.abs(monthChange))} this month</Chip>
          </span>
        }>
          Your money story · last 12 months
        </SectionLabel>
        <AreaChart data={hist} />
        <div className="legend">
          <span className="legend-item"><span className="legend-swatch legend-total"></span><Term tip="Investments + cash, added together, at the end of each month.">Net worth</Term></span>
          <span className="legend-item"><span className="legend-swatch legend-invested"></span><Term tip="The money you actually deposited — so you can see what the market did on top of it.">What you put in</Term></span>
        </div>
      </Card>

      <Card className="recap-story">
        <SectionLabel>Your money story · {last.m.replace(" 26", " 2026")}</SectionLabel>
        <div className="story-grid">
          <div className="story-cell">
            <div className="story-emoji">{monthChange >= 0 ? "🌞" : "🌧️"}</div>
            <div className="story-text">Net worth grew <b className={"mono " + (monthChange >= 0 ? "up" : "down")}>{fmt0(monthChange, { plus: true })}</b> this month{isRecord ? " — a new record for you two! 🎉" : "."}</div>
          </div>
          <div className="story-cell">
            <div className="story-emoji">💡</div>
            <div className="story-text">Deposits were quiet, so the markets and your <Term tip="Annual Percentage Yield — the interest your cash earns in a year, compounding included.">4.05% APY</Term> savings did all the lifting.</div>
          </div>
          <div className="story-cell">
            <div className="story-emoji">⭐</div>
            <div className="story-text">Best month of the year so far: <b>{bestMonth.m}</b>, up <b className="mono up">{fmt0(bestMonth.d, { plus: true })}</b>.</div>
          </div>
        </div>
      </Card>

      <div className="three-col">
        <Card className="recap-card">
          <div className="recap-emoji">📈</div>
          <div className="recap-value up">{fmt0(growth, { plus: true })}</div>
          <div className="recap-label">net worth growth in 12 months</div>
        </Card>
        <Card className="recap-card">
          <div className="recap-emoji">🫶</div>
          <div className="recap-value">{fmt0(contributed)}</div>
          <div className="recap-label">came from your own deposits — the part you control</div>
        </Card>
        <Card className="recap-card">
          <div className="recap-emoji">🌊</div>
          <div className={"recap-value " + (marketGain >= 0 ? "up" : "down")}>{fmt0(marketGain, { plus: true })}</div>
          <div className="recap-label">came from markets &amp; interest doing their thing</div>
        </Card>
      </div>

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
                <div className="proj-yr">in {yr} {yr === 1 ? "year" : "years"}</div>
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

Object.assign(window, { Growth });
