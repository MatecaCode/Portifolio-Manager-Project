import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CATEGORIES, CASH_ACCOUNTS } from '../data/portfolio';
import styles from './Overview.module.css';

const fmt = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => n.toFixed(1) + '%';

function MetricCard({ label, value, sub, positive, negative, mono }) {
  return (
    <div className={styles.metric}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={`${styles.metricVal} ${positive ? styles.pos : ''} ${negative ? styles.neg : ''} ${mono ? styles.mono : ''}`}>
        {value}
      </p>
      {sub && <p className={styles.metricSub}>{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0];
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipName}>{name}</p>
      <p className={styles.tooltipVal}>{fmt(value)}</p>
      <p className={styles.tooltipPct}>{pct(percent * 100)}</p>
    </div>
  );
};

export default function Overview({ holdings, categoryTotals, holdingValue, holdingCost, fxRate, setFxRate }) {
  const totals = categoryTotals();
  const totalVal = Object.values(totals).reduce((a, t) => a + t.value, 0);
  const totalCost = Object.values(totals).reduce((a, t) => a + t.cost, 0);
  const pnl = totalVal - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost * 100) : 0;
  const cashTotal = CASH_ACCOUNTS.reduce((a, c) => a + c.value, 0);
  const netWorth = totalVal + cashTotal;

  const chartData = useMemo(() =>
    CATEGORIES
      .map(c => ({ name: c.name, value: totals[c.id].value, color: c.color }))
      .filter(d => d.value > 0),
    [totals]
  );

  const fcHoldings = holdings.filter(h => h.finclass);
  const enHoldings = holdings.filter(h => h.energy);
  const fcVal = fcHoldings.reduce((a, h) => a + holdingValue(h), 0);
  const enVal = enHoldings.reduce((a, h) => a + holdingValue(h), 0);
  const fcCost = fcHoldings.reduce((a, h) => a + holdingCost(h), 0);
  const enCost = enHoldings.reduce((a, h) => a + holdingCost(h), 0);

  return (
    <div className={styles.container}>
      {/* Cash accounts */}
      <div className={styles.cashRow}>
        {CASH_ACCOUNTS.map(acc => (
          <div key={acc.id} className={styles.cashCard}>
            <div className={styles.cashLeft}>
              <span className={styles.cashIcon}>🏦</span>
              <div>
                <p className={styles.cashLabel}>{acc.label}</p>
                <p className={styles.cashNote}>{acc.note}</p>
              </div>
            </div>
            <div className={styles.cashRight}>
              <p className={styles.cashVal}>{fmt(acc.value)}</p>
              <p className={styles.cashApy}>{acc.apy}% APY · Emergency fund</p>
            </div>
          </div>
        ))}
        <div className={styles.fxCard}>
          <p className={styles.cashLabel}>USD / BRL</p>
          <input
            className={styles.fxInput}
            type="number"
            step="0.01"
            value={fxRate}
            onChange={e => setFxRate(parseFloat(e.target.value) || 5.70)}
          />
        </div>
      </div>

      {/* Metric cards */}
      <div className={styles.metrics}>
        <MetricCard label="Net Worth" value={fmt(netWorth)} sub="investments + cash" />
        <MetricCard label="Investments" value={fmt(totalVal)} sub="excl. emergency fund" />
        <MetricCard
          label="Total P/L"
          value={(pnl >= 0 ? '+' : '') + fmt(pnl)}
          sub={(pnlPct >= 0 ? '+' : '') + pct(pnlPct)}
          positive={pnl >= 0}
          negative={pnl < 0}
        />
        <MetricCard label="Total Cost" value={fmt(totalCost)} mono />
        <MetricCard label="Holdings" value={holdings.length} sub={`across ${CATEGORIES.length} categories`} />
      </div>

      {/* Chart + legend */}
      <div className={styles.chartSection}>
        <div className={styles.chartWrap}>
          <p className={styles.sectionTitle}>Allocation</p>
          {chartData.length === 0 ? (
            <div className={styles.emptyChart}>Add shares to see allocation</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.legendWrap}>
          <p className={styles.sectionTitle}>By category</p>
          {CATEGORIES.map(c => {
            const t = totals[c.id];
            const share = totalVal > 0 ? (t.value / totalVal * 100) : 0;
            const catPnl = t.value - t.cost;
            return (
              <div key={c.id} className={styles.legendRow}>
                <div className={styles.legendLeft}>
                  <span className={styles.legendDot} style={{ background: c.color }} />
                  <div>
                    <p className={styles.legendName}>{c.name}</p>
                    <p className={styles.legendSub}>{t.count} holding{t.count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className={styles.legendRight}>
                  <p className={styles.legendVal}>{fmt(t.value)}</p>
                  <p className={`${styles.legendPnl} ${catPnl >= 0 ? styles.pos : styles.neg}`}>
                    {catPnl >= 0 ? '+' : ''}{fmt(catPnl)} · {pct(share)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tag breakdown */}
      <div className={styles.tagSection}>
        <p className={styles.sectionTitle}>Strategy tags</p>
        <div className={styles.tagCards}>
          <div className={`${styles.tagCard} ${styles.tagFC}`}>
            <div className={styles.tagBadge}>FC</div>
            <div>
              <p className={styles.tagVal}>{fmt(fcVal)}</p>
              <p className={styles.tagMeta}>{fcHoldings.length} FinClass picks · {totalVal > 0 ? pct(fcVal / totalVal * 100) : '0%'} of portfolio</p>
              <p className={`${styles.tagPnl} ${fcVal - fcCost >= 0 ? styles.pos : styles.neg}`}>
                {fcVal - fcCost >= 0 ? '+' : ''}{fmt(fcVal - fcCost)} P/L
              </p>
            </div>
          </div>
          <div className={`${styles.tagCard} ${styles.tagEN}`}>
            <div className={`${styles.tagBadge} ${styles.tagBadgeEN}`}>EN</div>
            <div>
              <p className={styles.tagVal}>{fmt(enVal)}</p>
              <p className={styles.tagMeta}>{enHoldings.length} Energy picks · {totalVal > 0 ? pct(enVal / totalVal * 100) : '0%'} of portfolio</p>
              <p className={`${styles.tagPnl} ${enVal - enCost >= 0 ? styles.pos : styles.neg}`}>
                {enVal - enCost >= 0 ? '+' : ''}{fmt(enVal - enCost)} P/L
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
