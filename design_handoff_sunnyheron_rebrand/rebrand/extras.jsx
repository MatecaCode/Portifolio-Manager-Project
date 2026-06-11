// Learn + Import screens
function Learn() {
  const D = window.PF_DATA;
  return (
    <div className="screen">
      <div className="learn-hero">
        <h2>Little lessons, plain English 🌿</h2>
        <p>Three-minute reads, zero jargon. Knowing <i>why</i> makes the numbers way more fun to watch.</p>
      </div>
      <div className="lesson-grid">
        {D.lessons.map(l => (
          <Card className="lesson-card" key={l.title}>
            <div className="lesson-icon">{l.icon}</div>
            <div className="lesson-title">{l.title}</div>
            <p className="lesson-blurb">{l.blurb}</p>
            <div className="lesson-foot">
              <Chip>{l.mins} min read</Chip>
              <span className="lesson-go">Read →</span>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <SectionLabel>Glossary — the words, decoded</SectionLabel>
        <div className="glossary">
          {D.glossary.map(g => (
            <div className="gloss-row" key={g.term}>
              <div className="gloss-term">{g.term}</div>
              <div className="gloss-def">{g.def}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ImportScreen() {
  const sources = [
    { icon: "🏛️", name: "Wealthfront", note: "Savings balance from the account CSV export" },
    { icon: "🏦", name: "Chase Bank", note: "Checking balances from the statement export" },
    { icon: "💳", name: "Chase Card", note: "Card activity (future: spending insights)" },
    { icon: "🪙", name: "Kraken", note: "Crypto positions and balances from the ledger CSV" },
    { icon: "📈", name: "Fidelity", note: "US stock positions from the portfolio CSV" },
    { icon: "🌐", name: "Interactive Brokers", note: "Positions from the Flex/activity report" },
    { icon: "🇧🇷", name: "B3 / Brazilian broker", note: "Notas de corretagem and position reports" },
    { icon: "📄", name: "Other", note: "Any CSV — map the columns manually" }
  ];
  return (
    <div className="screen">
      <div className="learn-hero">
        <h2>Import from a file</h2>
        <p>Pick where your file comes from, upload it, and we'll show you exactly what would change before anything is saved. No surprises.</p>
        <Chip tone="warn">COMING SOON — UNDER CONSTRUCTION</Chip>
      </div>
      <div className="import-grid">
        {sources.map(s => (
          <Card className="import-card" key={s.name}>
            <div className="import-icon">{s.icon}</div>
            <div className="import-name">{s.name}</div>
            <p className="import-note">{s.note}</p>
          </Card>
        ))}
      </div>
      <div className="dropzone">
        <div className="dropzone-title">Drop a file here</div>
        <p>CSV exports first; PDFs and screenshots later. Until then, balances can be typed directly in Overview → Accounts.</p>
      </div>
    </div>
  );
}

Object.assign(window, { Learn, ImportScreen });
