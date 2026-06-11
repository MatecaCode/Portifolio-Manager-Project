// Shared UI primitives for the Sea Glass rebrand
const { useState } = React;

const fmt = (n, opts = {}) => {
  const sign = n < 0 ? "-" : (opts.plus && n > 0 ? "+" : "");
  return sign + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: opts.dec ?? 2, maximumFractionDigits: opts.dec ?? 2 });
};
const fmt0 = (n, opts = {}) => fmt(n, { ...opts, dec: 0 });

// Plain-English tooltip: dotted underline + hover bubble
function Term({ tip, children }) {
  return (
    <span className="term" tabIndex={0}>
      {children}
      <span className="term-tip">{tip}</span>
    </span>
  );
}

function Card({ className = "", children, style }) {
  return <div className={"card " + className} style={style}>{children}</div>;
}

function SectionLabel({ children, right }) {
  return (
    <div className="section-label">
      <span>{children}</span>
      {right && <span className="section-label-right">{right}</span>}
    </div>
  );
}

function Chip({ tone = "soft", children }) {
  return <span className={"chip chip-" + tone}>{children}</span>;
}

function CatDot({ id, size = 9 }) {
  return <span className="cat-dot" style={{ background: `var(--cat-${id})`, width: size, height: size }}></span>;
}

function TagBadge({ tag }) {
  const map = { FC: { label: "FC", tip: "A FinClass pick — recommended in the course we follow", cls: "tag-fc" },
                EN: { label: "EN", tip: "Part of our energy thesis — companies powering the world", cls: "tag-en" } };
  const t = map[tag];
  if (!t) return null;
  return (
    <span className={"tag-badge " + t.cls} tabIndex={0}>
      {t.label}
      <span className="term-tip">{t.tip}</span>
    </span>
  );
}

function ProgressBar({ pct, marker, tone = "accent", height = 8 }) {
  return (
    <div className="pbar" style={{ height }}>
      <div className="pbar-fill" style={{ width: Math.min(100, Math.max(0, pct)) + "%", background: `var(--${tone})` }}></div>
      {marker != null && <div className="pbar-marker" style={{ left: marker + "%" }}></div>}
    </div>
  );
}

function Donut({ slices, size = 190, hole = 0.62, centerTop, centerBottom }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = slices.map(s => {
    const from = (acc / total) * 100; acc += s.value;
    const to = (acc / total) * 100;
    return `var(--cat-${s.id}) ${from}% ${to}%`;
  }).join(", ");
  return (
    <div className="donut" style={{ width: size, height: size, background: `conic-gradient(${stops})` }}>
      <div className="donut-hole" style={{ width: size * hole, height: size * hole }}>
        {centerTop && <div className="donut-top">{centerTop}</div>}
        {centerBottom && <div className="donut-bottom">{centerBottom}</div>}
      </div>
    </div>
  );
}

// Simple SVG area chart
function AreaChart({ data, width = 760, height = 240, pad = 34 }) {
  const xs = data.map((_, i) => pad + (i * (width - pad * 2)) / (data.length - 1));
  const max = Math.max(...data.map(d => d.total)) * 1.06;
  const min = Math.min(...data.map(d => d.invested)) * 0.82;
  const y = v => height - pad - ((v - min) / (max - min)) * (height - pad * 2);
  const line = key => xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${y(data[i][key]).toFixed(1)}`).join(" ");
  const area = `${line("total")} L${xs[xs.length - 1]},${height - pad} L${xs[0]},${height - pad} Z`;
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
      <path d={line("invested")} className="line-invested" />
      <path d={line("total")} className="line-total" />
      <circle cx={xs[xs.length - 1]} cy={y(last.total)} r="5" className="line-dot" />
      {data.map((d, i) => (i % 2 === 0 || i === data.length - 1) && (
        <text key={i} x={xs[i]} y={height - 10} className="axis-label" textAnchor="middle">{d.m}</text>
      ))}
    </svg>
  );
}

Object.assign(window, { fmt, fmt0, Term, Card, SectionLabel, Chip, CatDot, TagBadge, ProgressBar, Donut, AreaChart });
