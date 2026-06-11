import { useEffect } from 'react';
import { CATEGORIES } from '../data/portfolio';
import styles from './Holdings.module.css';

const COL_HINTS = {
  qty: 'How many shares (or units) you own. Zero means it is on the watchlist — planned but not bought yet. For Renda Fixa and funds like ACE/Genoa, enter the amount in reais invested.',
  cost: 'The average price paid per share when buying. Used to calculate profit or loss.',
  price: "Today's price per share. Updates automatically for most investments; can also be typed in by hand.",
  value: 'What this position is worth right now: quantity × current price.',
  pnl: 'Profit or Loss in percent: how much this position has gained or lost versus what was paid.',
};

const fmt2 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

function HoldingRow({ holding, category, onUpdate, onRemove, onToggleTag, holdingValue, holdingCost }) {
  const valLocal = (holding.shares || 0) * (holding.price || 0);
  const costLocal = (holding.shares || 0) * (holding.cost || 0);
  const pnlLocal = valLocal - costLocal;
  const pnlPct = costLocal > 0 ? (pnlLocal / costLocal * 100) : 0;
  const isCrypto = holding.category === 'crypto';

  return (
    <div className={styles.row}>
      <div className={styles.nameCol}>
        <input
          className={`${styles.input} ${styles.tickerInput}`}
          value={holding.ticker}
          onChange={e => onUpdate(holding.id, 'ticker', e.target.value)}
          placeholder="TICK"
        />
        <input
          className={`${styles.input} ${styles.nameInput}`}
          value={holding.name}
          onChange={e => onUpdate(holding.id, 'name', e.target.value)}
          placeholder="Name"
        />
        <button
          className={`${styles.tag} ${holding.finclass ? styles.tagFCOn : ''}`}
          onClick={() => onToggleTag(holding.id, 'finclass')}
          title="FinClass pick"
        >FC</button>
        <button
          className={`${styles.tag} ${holding.energy ? styles.tagENOn : ''}`}
          onClick={() => onToggleTag(holding.id, 'energy')}
          title="Energy thesis"
        >EN</button>
      </div>

      <div className={styles.cell}>
        <span className={styles.cellLabel} title={COL_HINTS.qty}>Qty</span>
        <input
          className={`${styles.input} ${styles.numInput}`}
          type="number"
          step="any"
          value={holding.shares || ''}
          onChange={e => onUpdate(holding.id, 'shares', e.target.value)}
          placeholder="0"
        />
      </div>
      <div className={styles.cell}>
        <span className={styles.cellLabel} title={COL_HINTS.cost}>Avg Cost</span>
        <input
          className={`${styles.input} ${styles.numInput}`}
          type="number"
          step="any"
          value={holding.cost || ''}
          onChange={e => onUpdate(holding.id, 'cost', e.target.value)}
          placeholder="Avg cost"
        />
      </div>
      <div className={styles.cell}>
        <span className={styles.cellLabel} title={COL_HINTS.price}>Current</span>
        <div className={`${styles.numInput} ${styles.priceCell}`}>
          <input
            className={`${styles.input} ${styles.numInput}`}
            type="number"
            step="any"
            value={holding.price || ''}
            onChange={e => onUpdate(holding.id, 'price', e.target.value)}
            placeholder="Price"
          />
          {isCrypto && <span className={styles.liveTag}>LIVE</span>}
        </div>
      </div>

      <div className={styles.cell}>
        <span className={styles.cellLabel} title={COL_HINTS.value}>Value</span>
        <div className={`${styles.numInput} ${styles.valueCell}`}>
          {category.currency} {fmt2(valLocal)}
        </div>
      </div>
      <div className={styles.cell}>
        <span className={styles.cellLabel} title={COL_HINTS.pnl}>P/L %</span>
        <div className={`${styles.numInput} ${styles.pnlCell} ${pnlLocal >= 0 ? styles.pos : styles.neg}`}>
          {fmtPct(pnlPct)}
        </div>
      </div>
      <button className={styles.delBtn} onClick={() => onRemove(holding.id)}>×</button>
    </div>
  );
}

export default function Holdings({ holdings, addHolding, updateHolding, removeHolding, toggleTag, holdingValue, holdingCost, focusCategory, onFocusHandled }) {
  useEffect(() => {
    if (!focusCategory) return;
    const el = document.getElementById(`cat-${focusCategory}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add(styles.flash);
      const t = setTimeout(() => {
        el.classList.remove(styles.flash);
        onFocusHandled?.();
      }, 1800);
      return () => clearTimeout(t);
    }
    onFocusHandled?.();
  }, [focusCategory, onFocusHandled]);

  return (
    <div className={styles.container}>
      <div className={styles.legend}>
        <span className={`${styles.tag} ${styles.tagFCOn}`} style={{cursor:'default'}}>FC</span> FinClass pick &nbsp;·&nbsp;
        <span className={`${styles.tag} ${styles.tagENOn}`} style={{cursor:'default'}}>EN</span> Energy thesis &nbsp;·&nbsp;
        <span className={styles.liveTag}>LIVE</span> Auto-updated price
      </div>

      {CATEGORIES.map(cat => {
        const items = holdings.filter(h => h.category === cat.id);
        const owned = items.filter(h => (h.shares || 0) > 0).length;
        const totalVal = items.reduce((a, h) => {
          const c = CATEGORIES.find(x => x.id === h.category);
          const v = (h.shares || 0) * (h.price || 0);
          return a + v;
        }, 0);
        const totalPnl = items.reduce((a, h) => {
          const v = (h.shares || 0) * (h.price || 0);
          const c = (h.shares || 0) * (h.cost || 0);
          return a + (v - c);
        }, 0);

        return (
          <div key={cat.id} id={`cat-${cat.id}`} className={styles.catBlock}>
            <div className={styles.catHead}>
              <div className={styles.catTitle}>
                <span className={styles.catDot} style={{ background: cat.color }} />
                <span className={styles.catName}>{cat.name}</span>
                <span className={styles.catCurrency}>({cat.currency})</span>
                <span className={styles.catCount} title={`${owned} owned, ${items.length} on the list (watchlist items have quantity 0)`}>
                  {owned} owned / {items.length}
                </span>
              </div>
              <div className={styles.catRight}>
                {items.length > 0 && (
                  <span className={styles.catTotals}>
                    {cat.currency} {totalVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    <span className={totalPnl >= 0 ? styles.pos : styles.neg}>
                      {' '}· {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </span>
                  </span>
                )}
                <button className={styles.addBtn} onClick={() => addHolding(cat.id)}>+ Add</button>
              </div>
            </div>

            {items.length > 0 && (
              <div className={styles.tableHead}>
                <div className={styles.nameCol} title="The investment's code on the exchange, its name, and strategy tags.">Ticker / Name / Tags</div>
                <div className={styles.numInput} title={COL_HINTS.qty}>Qty</div>
                <div className={styles.numInput} title={COL_HINTS.cost}>Avg Cost</div>
                <div className={styles.numInput} title={COL_HINTS.price}>Current</div>
                <div className={styles.numInput} title={COL_HINTS.value}>Value</div>
                <div className={styles.numInput} title={COL_HINTS.pnl}>P/L %</div>
                <div style={{width:24}}></div>
              </div>
            )}

            {items.map(h => (
              <HoldingRow
                key={h.id}
                holding={h}
                category={cat}
                onUpdate={updateHolding}
                onRemove={removeHolding}
                onToggleTag={toggleTag}
                holdingValue={holdingValue}
                holdingCost={holdingCost}
              />
            ))}

            {items.length === 0 && (
              <p className={styles.empty}>No holdings yet — click + Add to start.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
