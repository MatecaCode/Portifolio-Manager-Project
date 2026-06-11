import { Card, Chip } from './ui';

// Placeholder for the file-import feature. Each source will get its own
// parser: select where the file came from → upload → preview changes → apply.
const SOURCES = [
  { id: 'wealthfront', name: 'Wealthfront',          icon: '🏛️', detail: 'Savings balance from the account CSV export' },
  { id: 'chase_bank',  name: 'Chase Bank',            icon: '🏦', detail: 'Checking balances from the statement export' },
  { id: 'chase_card',  name: 'Chase Card',            icon: '💳', detail: 'Card activity (future: spending insights)' },
  { id: 'kraken',      name: 'Kraken',                icon: '🪙', detail: 'Crypto positions and balances from the ledger CSV' },
  { id: 'fidelity',    name: 'Fidelity',              icon: '📈', detail: 'US stock positions from the portfolio CSV' },
  { id: 'ibkr',        name: 'Interactive Brokers',   icon: '🌐', detail: 'Positions from the Flex/activity report' },
  { id: 'b3',          name: 'B3 / Brazilian broker', icon: '🇧🇷', detail: 'Notas de corretagem and position reports' },
  { id: 'other',       name: 'Other',                 icon: '📄', detail: 'Any CSV — map the columns manually' },
];

export default function Import() {
  return (
    <div className="screen">
      <div className="import-hero">
        <h2>Import from a file</h2>
        <p>
          Pick where your file comes from, upload it, and we'll show you exactly
          what would change before anything is saved. No surprises.
        </p>
        <Chip tone="warn">COMING SOON — UNDER CONSTRUCTION</Chip>
      </div>

      <div className="import-grid">
        {SOURCES.map(s => (
          <Card className="import-card" key={s.id}>
            <div className="import-icon">{s.icon}</div>
            <div className="import-name">{s.name}</div>
            <p className="import-note">{s.detail}</p>
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
