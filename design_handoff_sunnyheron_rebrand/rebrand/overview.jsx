// Overview screen
function Overview() {
  const D = window.PF_DATA;
  const goalPct = (D.netWorth / D.goal.target) * 100;
  const owned = D.categories.filter(c => c.value > 0);

  return (
    <div className="screen">
      {/* Hero: goal + greeting */}
      <Card className="hero">
        <div className="hero-left">
          <div className="hero-greeting">Good morning, you two ☀️</div>
          <div className="celebrate-row">
            <span className="celebrate-chip">🎉 All-time high net worth!</span>
          </div>
          <div className="hero-networth">
            <Term tip="Everything you own minus everything you owe. Here it's your investments plus your cash.">Net worth</Term>
            <div className="hero-amount">{fmt(D.netWorth)}</div>
          </div>
          <div className="hero-goal">
            <div className="hero-goal-row">
              <span className="hero-goal-label">{D.goal.label}</span>
              <span className="hero-goal-pct">{goalPct.toFixed(0)}% there</span>
            </div>
            <ProgressBar pct={goalPct} height={10} />
            <div className="hero-goal-note">{fmt0(D.goal.target - D.netWorth)} to go — every deposit moves this bar 💪</div>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-stat">
            <div className="hs-label"><Term tip="Money currently in stocks, funds and crypto — not counting the emergency fund.">Invested</Term></div>
            <div className="hs-value">{fmt(D.investments)}</div>
          </div>
          <div className="hero-stat">
            <div className="hs-label"><Term tip="Cash sitting in your bank and brokerage accounts, ready to use or invest.">Cash</Term></div>
            <div className="hs-value">{fmt(D.cash)}</div>
            <div className="hs-sub">across {D.cashAccounts} accounts</div>
          </div>
          <div className="hero-stat">
            <div className="hs-label"><Term tip="Profit or Loss — how much your investments have gained or lost since you bought them. Red days are normal; the long game is what counts.">Profit / Loss</Term></div>
            <div className={"hs-value " + (D.totalPL < 0 ? "down" : "up")}>{fmt(D.totalPL, { plus: true })}</div>
            <div className={"hs-sub " + (D.totalPL < 0 ? "down" : "up")}>{D.totalPLPct}%</div>
          </div>
        </div>
      </Card>

      {/* Allocation + categories */}
      <div className="two-col">
        <Card>
          <SectionLabel right={<Chip>5 investments owned</Chip>}>
            <Term tip="How your invested money is split between different types of investments.">Allocation</Term>
          </SectionLabel>
          <div className="alloc-body">
            <Donut
              slices={owned.length ? owned : [{ id: "crypto", value: 1 }]}
              centerTop={fmt0(D.investments)}
              centerBottom="invested"
            />
            <div className="alloc-note">
              <div className="alloc-legend">
                {D.categories.map(c => (
                  <span className="legend-item" key={c.id}><CatDot id={c.id} /> {c.name}</span>
                ))}
              </div>
              <p className="alloc-line">
                All eggs in one basket for now — the <b>Rebalance</b> tab has the plan to spread new money around. Every color here is a future win. 🦩
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionLabel>By category</SectionLabel>
          <div className="cat-list">
            {D.categories.map(c => (
              <div className="cat-row" key={c.id}>
                <CatDot id={c.id} />
                <div className="cat-name">
                  {c.id === "fii" ? <Term tip="Fundos Imobiliários — Brazilian real-estate funds that pay monthly rent-like income.">{c.name}</Term>
                   : c.id === "rf" ? <Term tip="Brazil's version of bonds and CDs — steady, predictable interest.">{c.name}</Term>
                   : c.name}
                  <span className="cat-sub">{c.owned} owned · {c.listed} on the list</span>
                </div>
                <div className="cat-vals">
                  <div className="cat-value">{fmt(c.value)}</div>
                  <div className={"cat-pl " + (c.pl < 0 ? "down" : c.pl > 0 ? "up" : "flat")}>
                    {c.value === 0 ? "ready to start" : `${fmt(c.pl, { plus: true })} · ${c.plPct}%`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Accounts */}
      <SectionLabel right={
        <span className="acct-tools">
          <span className="fx-pill">USD/BRL <b>{window.PF_DATA.usdbrl}</b></span>
          <button className="btn-soft" type="button">+ Add account</button>
        </span>
      }>Accounts · {fmt(window.PF_DATA.cash)} cash</SectionLabel>
      <div className="acct-grid">
        {window.PF_DATA.accounts.map(a => (
          <Card className="acct-card" key={a.name}>
            <div className="acct-head">
              <div className="acct-name">{a.name}</div>
              {a.apy && <Chip tone="up"><Term tip="Annual Percentage Yield — the interest this cash earns in a year, compounding included.">{a.apy}</Term></Chip>}
            </div>
            <div className="acct-note">{a.note}</div>
            <div className="acct-value">{fmt(a.value)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Overview });
