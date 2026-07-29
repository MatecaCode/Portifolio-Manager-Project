// Shared UI primitives for the SunnyHeron "Sea Glass" design
// (see design_handoff_sunnyheron_rebrand/README.md)
import { REGIONS, regionById } from '../data/portfolio';

// Plain-English tooltip: dotted underline + hover bubble — THE core UX pattern
export function Term({ tip, children }) {
  return (
    <span className="term" tabIndex={0}>
      {children}
      <span className="term-tip">{tip}</span>
    </span>
  );
}

export function Card({ className = '', children, style, id }) {
  return <div className={'card ' + className} style={style} id={id}>{children}</div>;
}

export function SectionLabel({ children, right }) {
  return (
    <div className="section-label">
      <span>{children}</span>
      {right && <span className="section-label-right">{right}</span>}
    </div>
  );
}

export function Chip({ tone = 'soft', children, title }) {
  return <span className={'chip chip-' + tone} title={title}>{children}</span>;
}

export function CatDot({ color, size = 9 }) {
  return <span className="cat-dot" style={{ background: color, width: size, height: size }}></span>;
}

const TAG_INFO = {
  finclass: { label: 'FC', tip: 'A FinClass pick — recommended in the course we follow', cls: 'tag-fc' },
};

export function TagBadge({ tag, on = true, onClick }) {
  const t = TAG_INFO[tag];
  if (!t) return null;
  if (onClick) {
    return (
      <button type="button" className={'tag-badge ' + (on ? t.cls : 'tag-off')} onClick={onClick}
        title={on ? 'Click to remove this tag' : 'Click to add this tag'}>
        {t.label}
      </button>
    );
  }
  return (
    <span className={'tag-badge ' + t.cls} tabIndex={0}>
      {t.label}
      <span className="term-tip">{t.tip}</span>
    </span>
  );
}

// Country sticker: says where a holding lives, which is also what decides its
// currency and which price feed quotes it.
export function RegionBadge({ region, size = 'md' }) {
  const r = regionById(region);
  return (
    <span className={`region-badge region-${r.id}` + (size === 'sm' ? ' region-sm' : '')} tabIndex={0}>
      {r.code}
      <span className="term-tip">{r.name} — {r.tip}</span>
    </span>
  );
}

// Same sticker, as a picker. Styled to read as a badge until you click it.
export function RegionSelect({ value, onChange }) {
  const r = regionById(value);
  return (
    <select className={`region-select region-${r.id}`} value={r.id} onChange={e => onChange(e.target.value)}
      title="Where this one lives — sets its currency and which price feed quotes it">
      {REGIONS.map(o => <option key={o.id} value={o.id}>{o.code}</option>)}
    </select>
  );
}

export function ProgressBar({ pct, marker, tone = 'accent', height = 8 }) {
  return (
    <div className="pbar" style={{ height }}>
      <div className="pbar-fill" style={{ width: Math.min(100, Math.max(0, pct)) + '%', background: `var(--${tone})` }}></div>
      {marker != null && <div className="pbar-marker" style={{ left: Math.min(100, Math.max(0, marker)) + '%' }}></div>}
    </div>
  );
}

export function Donut({ slices, size = 190, hole = 0.62, centerTop, centerBottom, onSliceClick }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const stops = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((a, x) => a + x.value, 0);
    const from = (before / total) * 100;
    const to = ((before + s.value) / total) * 100;
    return `${s.color} ${from}% ${to}%`;
  }).join(', ');
  return (
    <div
      className="donut"
      style={{ width: size, height: size, background: `conic-gradient(${stops})`, cursor: onSliceClick ? 'pointer' : undefined }}
      onClick={onSliceClick}
      title={onSliceClick ? 'Click to see the holdings' : undefined}
    >
      <div className="donut-hole" style={{ width: size * hole, height: size * hole }}>
        {centerTop && <div className="donut-top">{centerTop}</div>}
        {centerBottom && <div className="donut-bottom">{centerBottom}</div>}
      </div>
    </div>
  );
}

// Simple SVG area chart: net worth (solid) vs cumulative deposits (dashed)
export function AreaChart({ data, width = 760, height = 240, pad = 34 }) {
  const xs = data.map((_, i) => pad + (i * (width - pad * 2)) / (data.length - 1));
  const max = Math.max(...data.map(d => d.total)) * 1.06;
  const min = Math.min(...data.map(d => d.invested)) * 0.82;
  const y = v => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
  const line = key => xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y(data[i][key]).toFixed(1)}`).join(' ');
  const area = `${line('total')} L${xs[xs.length - 1]},${height - pad} L${xs[0]},${height - pad} Z`;
  const last = data[data.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="area-chart" role="img" aria-label="Net worth over time">
      <defs>
        <linearGradient id="agrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={pad} x2={width - pad} y1={pad + f * (height - pad * 2)} y2={pad + f * (height - pad * 2)} className="grid-line" />
      ))}
      <path d={area} fill="url(#agrad)" />
      <path d={line('invested')} className="line-invested" />
      <path d={line('total')} className="line-total" />
      <circle cx={xs[xs.length - 1]} cy={y(last.total)} r="5" className="line-dot" />
      {data.map((d, i) => (i % 2 === 0 || i === data.length - 1) && (
        <text key={i} x={xs[i]} y={height - 10} className="axis-label" textAnchor="middle">{d.m}</text>
      ))}
    </svg>
  );
}
