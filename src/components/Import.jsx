import styles from './Import.module.css';

// Placeholder for the file-import feature. Each source will get its own
// parser: select where the file came from → upload → preview changes → apply.
const SOURCES = [
  { id: 'wealthfront', name: 'Wealthfront',         icon: '🏦', detail: 'Savings balance from the account CSV export' },
  { id: 'chase_bank',  name: 'Chase Bank',           icon: '🏛️', detail: 'Checking balances from the statement export' },
  { id: 'chase_card',  name: 'Chase Card',           icon: '💳', detail: 'Card activity (future: spending insights)' },
  { id: 'kraken',      name: 'Kraken',               icon: '🪙', detail: 'Crypto positions and balances from the ledger CSV' },
  { id: 'fidelity',    name: 'Fidelity',             icon: '📈', detail: 'US stock positions from the portfolio CSV' },
  { id: 'ibkr',        name: 'Interactive Brokers',  icon: '🌐', detail: 'Positions from the Flex/activity report' },
  { id: 'b3',          name: 'B3 / Brazilian broker', icon: '🇧🇷', detail: 'Notas de corretagem and position reports' },
  { id: 'other',       name: 'Other',                icon: '📄', detail: 'Any CSV — map the columns manually' },
];

export default function Import() {
  return (
    <div className={styles.container}>
      <div className={styles.intro}>
        <h2 className={styles.title}>Import from a file</h2>
        <p className={styles.text}>
          Pick where your file comes from, upload it, and the app will read it and
          show you exactly what would change before anything is saved.
        </p>
        <span className={styles.soon}>Coming soon — under construction</span>
      </div>

      <div className={styles.grid}>
        {SOURCES.map(s => (
          <button key={s.id} className={styles.sourceCard} disabled
            title="Not ready yet — this source's importer is still being built.">
            <span className={styles.sourceIcon}>{s.icon}</span>
            <span className={styles.sourceName}>{s.name}</span>
            <span className={styles.sourceDetail}>{s.detail}</span>
          </button>
        ))}
      </div>

      <div className={styles.dropZone}>
        <p className={styles.dropTitle}>Drop a file here</p>
        <p className={styles.dropSub}>CSV exports first; PDFs and screenshots later. Until then, balances can be typed directly in Overview → Accounts.</p>
      </div>
    </div>
  );
}
