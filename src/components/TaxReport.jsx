import { useMemo, useState } from 'react';
import { Card, Chip, Donut, SectionLabel, Term } from './ui';
import { fmt0 } from '../lib/format';
import { TAX_DEFAULTS, scheduleEById } from '../data/property';
import { isHouseCategory } from '../data/house';
import { sourceById, GLOSSARY_GROUPS, DEDUCTION_WATCHLIST } from '../data/taxSources';
import {
  scheduleESummary, buildingBasis, missingInputs, isReportFinal, setAside,
  personalUseFlag, palAllowance, niitApplies, shortTermExceptionPossible, yearOf,
} from '../lib/tax';

// The Taxes view — Phase 3. Turns the property's filed transactions + a handful
// of once-a-year inputs (basis, Form 1098, escrow) into a Schedule E year-end
// summary, a depreciation schedule, a set-aside estimate, and a panel of CPA
// flags. Everything is framed as an estimate pending CPA review — see
// AIRBNB_MODULE_PLAN.md → Phase 3 and src/lib/tax.js for the rules behind it.

const FILING_STATUSES = [
  { id: 'single', label: 'Single' },
  { id: 'mfj', label: 'Married — joint' },
  { id: 'mfs', label: 'Married — separate' },
  { id: 'hoh', label: 'Head of household' },
];

// Distinct donut/report colors for lines that aren't tagging categories.
const LINE_COLOR = { depreciation: '#6B57A8', other_interest: '#B0876B' };
const lineColor = id => LINE_COLOR[id] || scheduleEById(id).color;

const commit = v => (v === '' || v == null ? null : Number(v));

// Small labeled number input (uncontrolled + commit-on-blur, the app's pattern).
function NumField({ label, tip, value, onCommit, placeholder, suffix }) {
  return (
    <label className="tax-field">
      <span className="tax-field-label">{tip ? <Term tip={tip}>{label}</Term> : label}</span>
      <div className="tax-field-input">
        <input className="h-input num" type="number" inputMode="decimal"
          defaultValue={value ?? ''} placeholder={placeholder}
          onBlur={e => onCommit(commit(e.target.value))}
          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
        {suffix && <span className="tax-field-suffix">{suffix}</span>}
      </div>
    </label>
  );
}

// CPA assistant — a "📚" cite that opens the official IRS source behind a line
// or section, and the modal that shows the plain-English rule + the .gov links.
function Cite({ id, onOpen }) {
  if (!sourceById(id)) return null;
  return (
    <button type="button" className="tax-cite" title="Show the official IRS source behind this"
      onClick={() => onOpen(id)}>📚</button>
  );
}

function SourceModal({ id, onClose }) {
  const s = sourceById(id);
  if (!s) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal-card tax-source-modal" onClick={e => e.stopPropagation()}>
        <SectionLabel right={<Chip tone="soft">📚 official source</Chip>}>{s.title}</SectionLabel>
        <p className="tax-source-plain">{s.plain}</p>
        <div className="tax-source-links">
          {s.authority.map((a, i) => (
            <a key={i} className="tax-source-link" href={a.url} target="_blank" rel="noopener noreferrer">🔗 {a.label}</a>
          ))}
        </div>
        <p className="reb-tip" style={{ marginTop: 12 }}>These links show the rule exists — whether it applies to your facts is your CPA’s call. Not tax advice.</p>
        <div className="pending-actions" style={{ marginTop: 12 }}>
          <button className="btn-soft" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// One "keep an eye out" deduction: a nudge you can read in a second, which opens
// into what it is, why it qualifies, and the .gov page that says so. Collapsed by
// default — the point is to be skimmable, not to be another wall of tax text.
function WatchRow({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={'ded-item' + (open ? ' open' : '')}>
      <button type="button" className="ded-sum" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="ded-emoji">{item.emoji}</span>
        <span className="ded-teaser">{item.teaser}</span>
        <span className="ded-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="ded-body">
          <div className="ded-block">
            <div className="ded-h">What it is</div>
            <p>{item.what}</p>
          </div>
          <div className="ded-block">
            <div className="ded-h">Why it qualifies</div>
            <p>{item.why}</p>
          </div>
          <div className="tax-source-links">
            {item.authority.map((a, i) => (
              <a key={i} className="tax-source-link" href={a.url} target="_blank" rel="noopener noreferrer">🔗 {a.label}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaxReport({ b, property }) {
  // Merge stored tax inputs over the defaults so properties created before the
  // tax phase still render. Memoized on property.tax so the heavy summary below
  // only recomputes when an input actually changes.
  const tax = useMemo(() => ({
    ...TAX_DEFAULTS, ...(property.tax || {}),
    form1098: { ...TAX_DEFAULTS.form1098, ...(property.tax?.form1098 || {}) },
    escrow: { ...TAX_DEFAULTS.escrow, ...(property.tax?.escrow || {}) },
  }), [property.tax]);

  const setTax = patch => b.updatePropertyTax(property.id, patch);

  // Available tax years = years with tagged transactions + in-service year + now.
  const years = useMemo(() => {
    const s = new Set(
      b.transactions.filter(t => isHouseCategory(t.category)).map(t => yearOf(t.date)).filter(Boolean));
    const inSvc = yearOf(tax.placedInService || property.placedInService);
    if (inSvc) s.add(inSvc);
    s.add(new Date().getFullYear());
    return [...s].sort((a, z) => z - a);
  }, [b.transactions, property, tax.placedInService]);

  const [yearSel, setYearSel] = useState(null);
  const year = yearSel && years.includes(yearSel) ? yearSel : years[0];
  const [cite, setCite] = useState(null); // open source-citation modal (CPA assistant)

  const summary = useMemo(
    () => scheduleESummary({ transactions: b.transactions, property, tax, year }),
    [b.transactions, property, tax, year]);

  const missing = useMemo(() => missingInputs(tax, property), [tax, property]);
  const final = isReportFinal(tax, property);
  const bBasis = buildingBasis(tax, property);
  const pu = personalUseFlag(tax);
  const allowance = palAllowance(tax.magi, tax.filingStatus);
  const niit = niitApplies(tax.magi, tax.filingStatus);
  const strPossible = shortTermExceptionPossible(tax);
  const reserve = setAside(summary.net, tax.marginalRatePct);
  const inSvcMonth = Number(String(tax.placedInService || property.placedInService || '').slice(5, 7));

  // ── capital improvements (each its own 27.5-yr schedule) ──
  const cis = tax.capitalImprovements || [];
  const setCis = next => setTax({ capitalImprovements: next });
  const addCi = () => setCis([...cis, {
    id: 'ci_' + Math.random().toString(36).slice(2, 8),
    desc: '', amount: null, placedInService: tax.placedInService || property.placedInService || '',
  }]);
  const patchCi = (id, p) => setCis(cis.map(c => (c.id === id ? { ...c, ...p } : c)));
  const rmCi = id => setCis(cis.filter(c => c.id !== id));

  // ── CPA flags: things we surface, never auto-decide ──
  const flags = useMemo(() => {
    const out = [];
    // §280A personal use
    if (pu.personalUseDays > 0 || pu.fairRentalDays != null) {
      out.push(pu.usedAsHome
        ? { tone: 'warn', icon: '🏖️', title: 'Personal use may limit deductions (§280A)',
            body: `Personal use of ${pu.personalUseDays} days exceeds the greater of 14 days or 10% of rental days (${Math.round(pu.threshold)}). The home may be "used as a home," capping deductions at rental income and requiring proration. A CPA should decide — this isn't auto-applied.` }
        : { tone: 'soft', icon: '🏖️', title: 'Personal use within limits',
            body: `${pu.personalUseDays} personal days is within the greater-of-14-days-or-10% test (${Math.round(pu.threshold)}). Not treated as a home.` });
    } else {
      out.push({ tone: 'soft', icon: '🏖️', title: 'Not owner-occupied',
        body: 'No personal-use days recorded, so the §280A vacation-home limits don’t apply. If anyone stays at the property, log the days here first.' });
    }
    // Passive loss vs STR exception — only material on a loss year
    if (summary.net < 0) {
      if (strPossible && tax.materiallyParticipates === true) {
        out.push({ tone: 'soft', icon: '🔑', title: 'Loss may be non-passive (STR exception)',
          body: 'Average stay ≤ 7 days plus material participation can take this out of the passive-loss rules, letting the loss offset ordinary/W-2 income. High-value and fact-specific — your CPA must confirm the participation tests.' });
      } else if (strPossible) {
        out.push({ tone: 'warn', icon: '🔑', title: 'Short-term-rental exception may apply',
          body: 'Average stay ≤ 7 days can qualify a loss as non-passive — but only if you materially participate. Answer the participation question below and confirm with a CPA; it decides whether a year-1 loss is usable now or carried forward.' });
      } else if (allowance === 0 || (tax.magi != null && tax.magi >= 150000)) {
        out.push({ tone: 'warn', icon: '📉', title: '$25k special allowance phased out',
          body: 'At this income the $25,000 special allowance is fully phased out (MAGI ≥ $150k), so a passive rental loss is likely suspended and carried forward rather than deducted now. A net loss still generally reduces other tax rather than creating any. CPA to confirm.' });
      } else {
        out.push({ tone: 'soft', icon: '📉', title: 'Passive loss — special allowance may apply',
          body: `Up to ${allowance != null ? fmt0(allowance) : 'the $25,000'} of rental loss may offset ordinary income if you actively participate (phases out $100k–$150k MAGI). Excess is carried forward. CPA to confirm.` });
      }
    }
    // Self-employment tax (standing judgment call)
    out.push({ tone: 'soft', icon: '🧑‍🍳', title: 'Substantial services → possible SE tax',
      body: 'If you provide hotel-like services (daily cleaning, meals, concierge), the IRS may treat this as a business on Schedule C with 15.3% self-employment tax instead of Schedule E. A judgment call for your CPA.' });
    // QBI on a profit
    if (summary.net > 0) {
      out.push({ tone: 'soft', icon: '🧮', title: 'Net profit may qualify for 20% QBI',
        body: 'Net rental profit may be eligible for the 20% qualified-business-income deduction (§199A), often via the 250-hour rental safe harbor. Ask your CPA whether it applies.' });
    }
    // NIIT
    if (niit === true) {
      out.push({ tone: 'warn', icon: '💸', title: 'Possible 3.8% net investment income tax',
        body: 'MAGI is above the NIIT threshold, so net rental income may face the additional 3.8% tax. CPA to assess.' });
    } else if (tax.magi != null) {
      out.push({ tone: 'soft', icon: '💸', title: 'Below the NIIT threshold',
        body: 'MAGI is under the 3.8% net investment income tax threshold ($200k single / $250k joint), so NIIT likely doesn’t apply.' });
    }
    // Bonus depreciation / cost seg opportunity
    out.push({ tone: 'soft', icon: '🛋️', title: 'Furnishings may allow bonus depreciation',
      body: 'Furniture and appliances are 5–7-year property and can qualify for bonus depreciation / cost segregation — a potentially large first-year deduction not captured by the 27.5-year building schedule. Worth raising with your CPA.' });
    // Mid-year proration
    if (inSvcMonth > 1) {
      out.push({ tone: 'soft', icon: '📆', title: 'Only post-in-service costs are rental expenses',
        body: 'Costs before the placed-in-service date are personal, not rental. Pre-service mortgage interest and property tax may instead be Schedule A itemized deductions — only amounts after the in-service date belong on Schedule E.' });
    }
    // Local occupancy tax
    out.push({ tone: 'soft', icon: '🏨', title: 'Local hotel occupancy tax is the host’s job',
      body: 'Airbnb remits the 6% Texas state HOT, but the Allen / Collin County local occupancy tax is yours to register for and remit directly. Track it separately from income tax.' });
    return out;
  }, [summary.net, pu, strPossible, tax.materiallyParticipates, tax.magi, allowance, niit, inSvcMonth]);

  // ── exports ──
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const csvCell = v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  function exportCsv() {
    const rows = [
      ['Portfolio Manager — Schedule E backup (ESTIMATE, not tax advice)'],
      ['Property', property.name], ['Address', property.address || ''],
      ['Tax year', year], ['Status', final ? 'Inputs confirmed (still an estimate)' : 'DRAFT — estimates'],
      [],
      ['Line', 'Description', 'Amount (USD)'],
      ['3', 'Rents received', summary.income.toFixed(2)],
      ...summary.lines.map(l => [String(l.line), l.label, l.amount.toFixed(2)]),
      ['20', 'Total expenses', summary.totalExpenses.toFixed(2)],
      ['21', summary.net < 0 ? 'Net loss' : 'Net income', summary.net.toFixed(2)],
      [],
      ['Depreciation detail (straight-line, 27.5-yr, mid-month)'],
      ['Asset', 'Basis', 'Placed in service', `${year} depreciation`],
      ...summary.depreciation.items.map(it => [it.label, it.basis != null ? it.basis.toFixed(2) : '', it.placedInService || '', it.amount.toFixed(2)]),
      [],
      ['Excluded / held (not in totals)'],
      ['PITI paid to servicer', summary.pitiPaid.toFixed(2)],
      ['Capital improvements tagged', summary.capitalTagged.toFixed(2)],
      ['Unclassified — needs CPA', summary.unclassified.toFixed(2)],
      [],
      ['Disclaimer', 'This is a bookkeeping summary, not tax advice or a tax return. Review with a licensed CPA before filing.'],
    ];
    download(`${property.name.replace(/\s+/g, '_')}_ScheduleE_${year}.csv`,
      rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  }
  function printReport() {
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups to export the PDF report.'); return; }
    const row = (l, label, amt, cls = '') =>
      `<tr class="${cls}"><td class="ln">${l}</td><td>${label}</td><td class="amt">${fmt0(amt)}</td></tr>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Schedule E ${year} — ${property.name}</title>
<style>
  body{font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#1c2b2a;max-width:720px;margin:32px auto;padding:0 20px}
  h1{font-size:20px;margin:0 0 2px} .sub{color:#647a77;margin:0 0 16px;font-size:13px}
  .draft{display:inline-block;background:#fbf1dc;color:#9a7224;border-radius:6px;padding:3px 9px;font-weight:700;font-size:12px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;margin:10px 0 18px} td,th{padding:7px 6px;border-bottom:1px solid #e6efed;text-align:left}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#647a77}
  .ln{width:44px;color:#647a77;font-variant-numeric:tabular-nums} .amt{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .tot td{border-top:2px solid #cfe0dd;border-bottom:none;font-weight:700}
  .disc{background:#f4f9f8;border:1px solid #e0eeeb;border-radius:10px;padding:12px 14px;color:#3a544f;font-size:12.5px;margin-top:18px}
  @media print{body{margin:0}}
</style></head><body>
  <h1>Schedule E backup — ${year}</h1>
  <p class="sub">${property.name}${property.address ? ' · ' + property.address : ''} · residential rental (Form 1040, Schedule E)</p>
  <div class="draft">${final ? 'INPUTS CONFIRMED — ESTIMATE' : 'DRAFT — ESTIMATE, INPUTS UNCONFIRMED'}</div>
  <table>
    <tr><th class="ln">Line</th><th>Item</th><th class="amt">Amount</th></tr>
    ${row(3, 'Rents received', summary.income)}
    ${summary.lines.map(l => row(l.line, l.label, l.amount)).join('')}
    ${row(20, 'Total expenses', summary.totalExpenses, 'tot')}
    ${row(21, summary.net < 0 ? 'Net loss' : 'Net income', summary.net, 'tot')}
  </table>
  <table>
    <tr><th>Depreciation (SL, 27.5-yr, mid-month)</th><th>Basis</th><th class="amt">${year}</th></tr>
    ${summary.depreciation.items.map(it => `<tr><td>${it.label}${it.placedInService ? ' · ' + it.placedInService : ''}</td><td>${it.basis != null ? fmt0(it.basis) : '—'}</td><td class="amt">${fmt0(it.amount)}</td></tr>`).join('')}
  </table>
  <div class="disc"><strong>Not tax advice.</strong> This is an organizational bookkeeping summary generated from tagged transactions and user-entered figures — not a tax return. Amounts are estimates pending review by a licensed CPA before filing.</div>
  <script>onload=function(){print()}</script>
</body></html>`);
    w.document.close();
  }

  return (
    <div className="tax-report">
      {cite && <SourceModal id={cite} onClose={() => setCite(null)} />}
      {/* disclaimer — always visible */}
      <div className="explainer tax-disclaimer">
        <p><strong>🧾 Bookkeeping tool — not tax advice.</strong> Every figure here is an
          estimate to organize your year and guide a conversation with a licensed CPA.
          Have a CPA review before filing. Calculations follow current IRS Schedule E &amp;
          Publication 527 guidance.</p>
      </div>

      {/* header: year + draft state + export */}
      <Card>
        <div className="tax-head">
          <div>
            <div className="tax-head-title">{property.emoji} {property.name} · Taxes</div>
            <div className="tax-head-sub">{property.address || property.state} · Schedule E (Form 1040)</div>
          </div>
          <div className="tax-head-actions">
            <button className="btn-soft" onClick={exportCsv} title="Download the summary as a CSV">⬇ CSV</button>
            <button className="btn-soft on" onClick={printReport} title="Open a clean printable report — save as PDF">🖨 PDF</button>
          </div>
        </div>
        <div className="month-row" style={{ marginTop: 12 }}>
          {years.map(y => (
            <button key={y} className={'month-chip' + (y === year ? ' active' : '')} onClick={() => setYearSel(y)}>{y}</button>
          ))}
        </div>
        <div className={'tax-draft-banner' + (final ? ' ok' : '')}>
          {final
            ? <><Chip tone="soft">✓ Inputs confirmed</Chip><span>Still an estimate — have your CPA review before filing.</span></>
            : <><Chip tone="warn">⚠️ Draft — estimate</Chip>
                {missing.length > 0
                  ? <span>Needed before these figures are final: {missing.join(' · ')}.</span>
                  : <span>All inputs entered — tick “confirm inputs” in the calculator to lift the draft watermark.</span>}
              </>}
        </div>
      </Card>

      {/* Schedule E summary hero */}
      <Card className="hero tax-hero">
        <div>
          <div className="hero-greeting">Schedule E summary · {year}</div>
          <div className="hero-networth">
            <Term tip="Rents received minus deductible expenses and depreciation for this property and year. A loss generally reduces other tax rather than creating any — subject to the passive-loss limits flagged below.">
              {summary.net < 0 ? 'Net rental loss (est.)' : 'Net rental income (est.)'}
            </Term>
            <div className={'hero-amount' + (summary.net < 0 ? ' down' : '')}>{fmt0(summary.net)}</div>
          </div>
          <div className="airbnb-pl">
            <div className="airbnb-pl-row"><span>💰 Rents received · L3</span><strong className="mono up">{fmt0(summary.income)}</strong></div>
            <div className="airbnb-pl-row"><span>🧾 Total expenses · L20</span><strong className="mono">{fmt0(summary.totalExpenses)}</strong></div>
            <div className="airbnb-pl-row total"><span>{summary.net < 0 ? '📉 Net loss · L21' : '📈 Net income · L21'}</span><strong className={'mono ' + (summary.net < 0 ? 'down' : 'up')}>{fmt0(summary.net)}</strong></div>
          </div>
          {summary.net > 0
            ? <div className="hero-goal-note">Suggested set-aside ≈ <strong className="mono">{fmt0(reserve)}</strong> ({tax.marginalRatePct || 0}% of net profit) — an estimate to reserve, not a payment due.</div>
            : <div className="hero-goal-note">Nothing to set aside on a loss year — see the passive-loss flag for how the loss may be used.</div>}
        </div>
        <div className="hero-right budget-donut-wrap">
          {summary.totalExpenses > 0
            ? <Donut size={163} centerTop={fmt0(summary.totalExpenses)} centerBottom="expenses"
                slices={summary.lines.map(l => ({ id: l.id, color: lineColor(l.id), value: l.amount }))} />
            : <div className="hold-empty">No deductible expenses tagged for {year} yet.</div>}
        </div>
      </Card>

      {/* Schedule E line items */}
      <Card>
        <SectionLabel right={<><Cite id="schedule_e" onOpen={setCite} /><Chip tone="soft">{summary.txCount} txns · {year}</Chip></>}>Schedule E line items</SectionLabel>
        <div className="cat-list">
          {summary.lines.map(l => (
            <div className="cat-row" key={l.id}>
              <span className="tax-line-no mono">L{l.line}</span>
              <div className="cat-name">
                {l.label}
                {l.id === 'depreciation' && <span className="cat-sub">computed · straight-line 27.5-yr, mid-month</span>}
                {l.id === 'mortgage_interest' && summary.mortgage.toLine12 > 0 && <span className="cat-sub">includes Form 1098 interest{summary.mortgage.points ? ' + points' : ''}</span>}
                {l.id === 'taxes' && summary.mortgage.toLine16 > 0 && <span className="cat-sub">includes escrowed property tax</span>}
                {l.id === 'insurance' && summary.mortgage.toLine9 > 0 && <span className="cat-sub">includes escrowed insurance</span>}
              </div>
              <Cite id={l.id} onOpen={setCite} />
              <div className="cat-vals"><div className="cat-value mono">{fmt0(l.amount)}</div></div>
            </div>
          ))}
          {!summary.lines.length && <div className="hold-empty">Nothing filed for {year} yet — find the house’s costs on the 🏡 house tab.</div>}
          <div className="cat-row tax-total-row"><span className="tax-line-no mono">L20</span><div className="cat-name">Total expenses</div><div className="cat-vals"><div className="cat-value mono">{fmt0(summary.totalExpenses)}</div></div></div>
          <div className="cat-row tax-total-row"><span className="tax-line-no mono">L21</span><div className="cat-name">{summary.net < 0 ? 'Net loss' : 'Net income'}</div><div className="cat-vals"><div className={'cat-value mono ' + (summary.net < 0 ? 'down' : 'up')}>{fmt0(summary.net)}</div></div></div>
        </div>
        {(summary.pitiPaid > 0 || summary.capitalTagged > 0 || summary.unclassified > 0) && (
          <div className="tax-excluded">
            {summary.pitiPaid > 0 && <div>🏠 <strong>PITI paid to servicer {fmt0(summary.pitiPaid)}</strong> — excluded here; its deductible pieces come from your 1098/escrow inputs (lines 9/12/16) so nothing is double-counted.</div>}
            {summary.capitalTagged > 0 && <div>🔨 <strong>Capital improvements tagged {fmt0(summary.capitalTagged)}</strong> — not expensed; add them to the depreciation schedule below.</div>}
            {summary.unclassified > 0 && <div>🚧 <strong>Unclassified {fmt0(summary.unclassified)}</strong> — held out of totals pending CPA input.</div>}
          </div>
        )}
      </Card>

      {/* Depreciation calculator */}
      <Card>
        <SectionLabel right={<><Cite id="depreciation" onOpen={setCite} /><Chip tone={final ? 'soft' : 'warn'}>{final ? 'confirmed' : 'estimate'}</Chip></>}>Depreciation calculator</SectionLabel>
        <p className="reb-tip" style={{ marginBottom: 12 }}>
          Residential rental depreciates straight-line over 27.5 years; land isn’t depreciable.
          Because this was your home before it became a rental, the basis is the{' '}
          <Term tip="Pub 527: for a home converted to a rental, depreciable basis is the LESSER of its adjusted basis or its fair-market value on the date it became a rental — then subtract land.">lesser of adjusted basis or FMV</Term>{' '}
          at conversion, minus land.
        </p>
        <div className="tax-grid">
          <NumField label="Purchase price / adjusted basis" value={property.purchasePrice}
            tip="What you paid plus improvements before renting. An estimate until you confirm it."
            onCommit={v => b.updateProperty(property.id, { purchasePrice: v })} suffix="$" />
          <NumField label="FMV at conversion" value={tax.fmvAtConversion} placeholder="required"
            tip="Fair market value the day it became a rental (county appraisal). Basis = lesser of this and adjusted basis."
            onCommit={v => setTax({ fmvAtConversion: v })} suffix="$" />
          <NumField label="Land value" value={tax.landValue} placeholder={`or use ${property.landPct || 0}%`}
            tip="Land isn't depreciable. Use the county's land allocation (Collin CAD). Leave blank to use the land % instead."
            onCommit={v => setTax({ landValue: v })} suffix="$" />
          <NumField label="Land %" value={property.landPct} suffix="%"
            tip="Share of basis that's land, if you don't have a dollar figure. Estimate ~20% until the appraisal confirms it."
            onCommit={v => b.updateProperty(property.id, { landPct: v })} />
          <label className="tax-field">
            <span className="tax-field-label"><Term tip="The date the property was first available to guests — not the purchase date. Drives the mid-month convention.">Placed in service</Term></span>
            <div className="tax-field-input">
              <input className="h-input" type="date" defaultValue={tax.placedInService || property.placedInService || ''}
                onBlur={e => b.updateProperty(property.id, { placedInService: e.target.value })} />
            </div>
          </label>
          <NumField label="Business-use %" value={tax.businessUsePct} suffix="%"
            tip="100% if fully a rental. Lower only if there's personal use — which also raises the §280A flag."
            onCommit={v => setTax({ businessUsePct: v })} />
        </div>
        <div className="tax-computed">
          <div><span className="tax-computed-label">Depreciable building basis</span><span className="tax-computed-val mono">{bBasis != null ? fmt0(bBasis) : '— needs basis + land'}</span></div>
          <div><span className="tax-computed-label">{year} depreciation (line 18)</span><span className="tax-computed-val mono">{fmt0(summary.depreciation.total)}</span></div>
        </div>
        {!tax.fmvAtConversion && <div className="tax-inline-warn">FMV at conversion is still needed to apply the lesser-of-basis rule — until then this uses purchase price and is a rough estimate.</div>}

        {/* capital improvements */}
        <div className="tax-ci">
          <div className="tax-ci-head"><span>Capital improvements</span>
            <button className="btn-soft" onClick={addCi}>＋ Add</button></div>
          <p className="reb-tip" style={{ margin: '2px 0 8px' }}>New roof, renovation, major work — capitalized and depreciated on its own 27.5-year clock, not expensed. Small fixes are Repairs instead.</p>
          {cis.map(ci => (
            <div className="tax-ci-row" key={ci.id}>
              <input className="h-input head-font" placeholder="e.g. New roof" defaultValue={ci.desc || ''}
                onBlur={e => patchCi(ci.id, { desc: e.target.value })} />
              <input className="h-input num" type="number" placeholder="$" defaultValue={ci.amount ?? ''}
                onBlur={e => patchCi(ci.id, { amount: commit(e.target.value) })} />
              <input className="h-input" type="date" defaultValue={ci.placedInService || ''}
                onBlur={e => patchCi(ci.id, { placedInService: e.target.value })} />
              <button className="hold-del" title="Remove" onClick={() => rmCi(ci.id)}>✕</button>
            </div>
          ))}
          {!cis.length && <div className="hold-empty">None yet. Items tagged “Improvements & work” on Overview belong here.</div>}
        </div>
      </Card>

      {/* Mortgage interest split */}
      <Card>
        <SectionLabel right={<Cite id="mortgage_split" onOpen={setCite} />}>Mortgage split (from Form 1098 &amp; escrow)</SectionLabel>
        <p className="reb-tip" style={{ marginBottom: 12 }}>
          The one ~{fmt0(property.monthlyPayment || 0)}/mo PITI line is four things. Only three are
          deductible, and they land on different Schedule E lines — entered from the statement, never
          guessed from the bank feed. Principal isn’t deductible.
        </p>
        <div className="tax-grid">
          <NumField label="Mortgage interest (1098 box 1)" value={tax.form1098.mortgageInterest} placeholder="required" suffix="$"
            tip="Deductible → Schedule E line 12. Use only the portion after the placed-in-service date."
            onCommit={v => setTax({ form1098: { mortgageInterest: v } })} />
          <NumField label="Points (1098 box 6)" value={tax.form1098.points} suffix="$"
            tip="Deductible mortgage points, if any → line 12."
            onCommit={v => setTax({ form1098: { points: v } })} />
          <NumField label="Property tax from escrow" value={tax.escrow.propertyTax} suffix="$"
            tip="Property tax the lender disbursed from escrow → line 16. From the year-end escrow analysis."
            onCommit={v => setTax({ escrow: { propertyTax: v } })} />
          <NumField label="Insurance from escrow" value={tax.escrow.insurance} suffix="$"
            tip="Landlord/STR insurance disbursed from escrow → line 9."
            onCommit={v => setTax({ escrow: { insurance: v } })} />
        </div>
        <div className="tax-computed">
          <div><span className="tax-computed-label">Deductible from the mortgage</span><span className="tax-computed-val mono">{fmt0(summary.mortgage.deductible)}</span></div>
          <div><span className="tax-computed-label">→ L12 interest · L16 tax · L9 insurance</span><span className="tax-computed-val mono">{fmt0(summary.mortgage.toLine12)} · {fmt0(summary.mortgage.toLine16)} · {fmt0(summary.mortgage.toLine9)}</span></div>
        </div>
      </Card>

      {/* Filer & participation */}
      <Card>
        <SectionLabel right={<Cite id="passive_loss" onOpen={setCite} />}>Filer &amp; participation</SectionLabel>
        <div className="tax-grid">
          <label className="tax-field">
            <span className="tax-field-label">Filing status</span>
            <div className="tax-field-input">
              <select className="h-input head-font" value={tax.filingStatus} onChange={e => setTax({ filingStatus: e.target.value })}>
                {FILING_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </label>
          <NumField label="Marginal federal rate" value={tax.marginalRatePct} suffix="%"
            tip="Your top federal bracket — used only to estimate a set-aside on net profit."
            onCommit={v => setTax({ marginalRatePct: v })} />
          <NumField label="MAGI (approx.)" value={tax.magi} placeholder="for loss/NIIT flags" suffix="$"
            tip="Modified AGI — drives the $25k passive-loss phaseout ($100k–$150k) and the NIIT threshold."
            onCommit={v => setTax({ magi: v })} />
          <NumField label="Average guest stay" value={tax.avgStayDays} placeholder="days" suffix="d"
            tip="Average nights per booking. 7 or fewer opens the short-term-rental exception question."
            onCommit={v => setTax({ avgStayDays: v })} />
        </div>
        <div className="tax-tristate">
          <span className="tax-field-label"><Term tip="Whether you materially participate (e.g. 500 hours, or 100 hours and more than anyone else). With an avg stay ≤7 days this can make losses non-passive. We never decide this for you.">Do you materially participate?</Term></span>
          <div className="tax-tristate-btns">
            {[['Yes', true], ['No', false], ['Undecided', null]].map(([lbl, val]) => (
              <button key={lbl} className={'btn-soft' + (tax.materiallyParticipates === val ? ' on' : '')}
                onClick={() => setTax({ materiallyParticipates: val })}>{lbl}</button>
            ))}
          </div>
        </div>
      </Card>

      {/* Personal use (§280A) */}
      <Card>
        <SectionLabel right={<><Cite id="personal_use" onOpen={setCite} /><Chip tone={pu.usedAsHome ? 'warn' : 'soft'}>{pu.usedAsHome ? 'may limit deductions' : 'within limits'}</Chip></>}>Personal use (§280A)</SectionLabel>
        <div className="tax-grid">
          <NumField label="Personal-use days" value={tax.personalUseDays} placeholder="0" suffix="d"
            tip="Nights you, family, or friends stayed at below-market rates. Normally 0 since you don't live there."
            onCommit={v => setTax({ personalUseDays: v })} />
          <NumField label="Days rented at fair price" value={tax.fairRentalDays} placeholder="optional" suffix="d"
            tip="Nights rented to guests at a fair market rate — sets the 10% side of the test."
            onCommit={v => setTax({ fairRentalDays: v })} />
        </div>
        <div className="tax-inline-note">
          Test: personal use over the greater of <strong>14 days</strong> or <strong>10% of rental days</strong> ({Math.round(pu.threshold)}) makes it “used as a home.”{' '}
          {pu.usedAsHome
            ? <span className="down">Currently exceeds the threshold — see the §280A flag.</span>
            : <span>Currently within limits.</span>}
        </div>
      </Card>

      {/* CPA flags */}
      <Card>
        <SectionLabel right={<Chip tone="warn">judgment calls</Chip>}>Flags for your CPA</SectionLabel>
        <p className="reb-tip" style={{ marginBottom: 12 }}>These are surfaced, never auto-decided — the high-value questions a CPA should rule on.</p>
        <div className="tax-flags">
          {flags.map((f, i) => (
            <div className={'tax-flag ' + f.tone} key={i}>
              <span className="tax-flag-icon">{f.icon}</span>
              <div><div className="tax-flag-title">{f.title}</div><p className="tax-flag-body">{f.body}</p></div>
            </div>
          ))}
        </div>
      </Card>

      {/* CPA assistant — sources & authority glossary */}
      <Card>
        <SectionLabel right={<Chip tone="soft">📚 official sources</Chip>}>CPA assistant — sources &amp; authority</SectionLabel>
        <p className="reb-tip" style={{ marginBottom: 14 }}>
          Every category and calculation paired with the government source that backs it — tap 📚 anywhere
          above to jump to a rule. These prove the rule <em>exists</em>; your CPA confirms it fits your facts.
        </p>
        {GLOSSARY_GROUPS.map(g => (
          <div className="tax-gloss-group" key={g.label}>
            <div className="tax-gloss-grouplabel">{g.label}</div>
            {g.ids.map(id => {
              const s = sourceById(id);
              if (!s) return null;
              return (
                <div className="tax-gloss-row" key={id}>
                  <div className="tax-gloss-title">{s.title}</div>
                  <p className="tax-gloss-plain">{s.plain}</p>
                  <div className="tax-source-links">
                    {s.authority.map((a, i) => (
                      <a key={i} className="tax-source-link" href={a.url} target="_blank" rel="noopener noreferrer">🔗 {a.label}</a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      {/* deductions to keep an eye out for — the ones with no bank line to file */}
      <Card>
        <SectionLabel right={<Chip tone="soft">{DEDUCTION_WATCHLIST.length} to watch</Chip>}>Keep an eye out 👀</SectionLabel>
        <p className="reb-tip" style={{ marginBottom: 14 }}>
          Everything above is built from money that moved through the bank. These are the
          deductions that <em>don’t</em> show up as a transaction — the miles, the elections,
          the paperwork — plus the ones hiding inside a line you already filed. Tap any one
          for what it is, why it counts, and the IRS page that says so.
        </p>
        <div className="ded-list">
          {DEDUCTION_WATCHLIST.map(item => <WatchRow key={item.id} item={item} />)}
        </div>
        <p className="reb-tip" style={{ marginTop: 12 }}>
          Same rule as everywhere else here: these show the deduction <em>exists</em>. Whether it
          fits your year is your CPA’s call. 🧾
        </p>
      </Card>

      {/* confirm gate */}
      <Card className="tax-confirm-card">
        <label className="tax-confirm">
          <input type="checkbox" checked={!!tax.confirmed} onChange={e => setTax({ confirmed: e.target.checked })} />
          <span>
            <strong>I’ve reviewed and confirmed these inputs.</strong> Lifts the draft watermark on exports.
            {missing.length > 0 && <span className="down"> Still missing: {missing.join(' · ')}.</span>}
            {' '}This remains an estimate — not tax advice, and not a substitute for a CPA.
          </span>
        </label>
      </Card>
    </div>
  );
}
