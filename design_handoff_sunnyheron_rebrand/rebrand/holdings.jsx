// Holdings screen
function HoldingsGroup({ catId }) {
  const D = window.PF_DATA;
  const cat = D.categories.find(c => c.id === catId);
  const rows = D.holdings[catId] || [];
  const totalValue = rows.reduce((s, r) => s + r.qty * r.cur, 0);
  const totalPL = rows.reduce((s, r) => s + r.qty * (r.cur - r.avg), 0);
  return (
    <Card className="hold-group">
      <div className="hold-head">
        <CatDot id={catId} size={10} />
        <span className="hold-cat">{cat.name}</span>
        <span className="hold-ccy">({cat.ccy})</span>
        <Chip>{cat.owned} owned / {cat.listed}</Chip>
        <span className="hold-total">
          <span className="mono">{cat.ccy === "BRL" ? "R$" : "$"}{totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          <span className={"mono " + (totalPL < 0 ? "down" : totalPL > 0 ? "up" : "flat")}> · {totalPL >= 0 ? "+" : "-"}{Math.abs(totalPL).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </span>
      </div>
      <div className="hold-table">
        <div className="hold-row hold-row-header">
          <span>Ticker / name</span>
          <span className="num"><Term tip="How many units you own.">Qty</Term></span>
          <span className="num"><Term tip="The average price you paid per unit.">Avg cost</Term></span>
          <span className="num"><Term tip="What one unit is worth right now.">Current</Term></span>
          <span className="num">Value</span>
          <span className="num">P/L %</span>
        </div>
        {rows.map(r => {
          const value = r.qty * r.cur;
          const plPct = r.qty > 0 ? ((r.cur - r.avg) / r.avg) * 100 : 0;
          return (
            <div className="hold-row" key={r.ticker}>
              <span className="hold-id">
                <span className="ticker" title="Click to learn about it">{r.ticker}</span>
                <span className="hold-name">{r.name}</span>
                {r.tags.map(t => <TagBadge tag={t} key={t} />)}
              </span>
              <span className="num mono">{r.qty || "—"}</span>
              <span className="num mono">{r.avg.toLocaleString("en-US")}</span>
              <span className="num mono">{r.cur.toLocaleString("en-US")}</span>
              <span className="num mono">{r.qty > 0 ? (cat.ccy === "BRL" ? "R$" : "$") + value.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}</span>
              <span className={"num mono " + (plPct < 0 ? "down" : plPct > 0 ? "up" : "flat")}>
                {r.qty > 0 ? (plPct >= 0 ? "+" : "") + plPct.toFixed(1) + "%" : "on the list"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Holdings() {
  return (
    <div className="screen">
      <div className="hold-toolbar">
        <span className="hold-legend">
          <TagBadge tag="FC" /> FinClass pick &nbsp;·&nbsp; <TagBadge tag="EN" /> Energy thesis &nbsp;·&nbsp;
          <Chip tone="up">LIVE</Chip> auto-updated price · hover anything dotted to learn
        </span>
        <button className="btn-soft" type="button">✎ Edit holdings</button>
      </div>
      {["crypto", "br", "fii", "rf", "us", "intl"].map(id => <HoldingsGroup catId={id} key={id} />)}
    </div>
  );
}

Object.assign(window, { Holdings });
