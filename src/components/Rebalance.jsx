import { CATEGORIES } from '../data/portfolio';
import styles from './Rebalance.module.css';

const pct = n => n.toFixed(1) + '%';

export default function Rebalance({ holdings, targets, categoryTotals, updateTarget, holdingValue }) {
  const totals = categoryTotals();
  const totalVal = Object.values(totals).reduce((a, t) => a + t.value, 0);
  const targetSum = Object.values(targets).reduce((a, b) => a + (parseFloat(b) || 0), 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={styles.note}>
          Set your target % per category. The filled bar is your actual allocation; the line marker is your target.
        </p>
        <div className={`${styles.sumBadge} ${Math.abs(targetSum - 100) < 0.1 ? styles.ok : styles.warn}`}>
          {Math.abs(targetSum - 100) < 0.1 ? '✓' : '⚠'} Targets: {targetSum.toFixed(1)}%
        </div>
      </div>

      <div className={styles.grid}>
        {CATEGORIES.map(cat => {
          const actual = totalVal > 0 ? (totals[cat.id].value / totalVal * 100) : 0;
          const target = parseFloat(targets[cat.id]) || 0;
          const diff = actual - target;
          const value = totals[cat.id].value;
          const needed = totalVal > 0 ? (target / 100 * totalVal) - value : 0;

          return (
            <div key={cat.id} className={styles.catCard}>
              <div className={styles.catTop}>
                <div className={styles.catName}>
                  <span className={styles.dot} style={{ background: cat.color }} />
                  {cat.name}
                </div>
                <div className={styles.catTarget}>
                  Target
                  <input
                    className={styles.targetInput}
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={targets[cat.id]}
                    onChange={e => updateTarget(cat.id, e.target.value)}
                  />
                  %
                </div>
              </div>

              <div className={styles.barArea}>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${Math.min(actual, 100)}%`, background: cat.color }}
                  />
                  <div
                    className={styles.targetLine}
                    style={{ left: `${Math.min(target, 100)}%` }}
                  />
                </div>
                <div className={styles.barLabels}>
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className={styles.catStats}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Actual</span>
                  <span className={styles.statVal}>{pct(actual)}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Diff</span>
                  <span className={`${styles.statVal} ${Math.abs(diff) < 0.5 ? styles.neutral : diff > 0 ? styles.over : styles.under}`}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}pp
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Value</span>
                  <span className={styles.statVal}>${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>{needed >= 0 ? 'Buy' : 'Trim'}</span>
                  <span className={`${styles.statVal} ${needed >= 0 ? styles.under : styles.over}`}>
                    ${Math.abs(needed).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
