import { CATEGORIES } from '../data/portfolio';
import { Card, CatDot, Chip, SectionLabel, Term } from './ui';

const catColor = id => CATEGORIES.find(c => c.id === id)?.color;

// Candidate investments Matheus & Melanie review together before any money
// moves. Approve → drops into Holdings as a 0-share watchlist entry; reject →
// clears it. Grouped by theme for easy skimming.
export default function Review({ reviews, addReview, updateReview, rejectReview, approveReview }) {
  const groups = {};
  reviews.forEach(r => { const k = r.theme?.trim() || 'Other ideas'; (groups[k] ||= []).push(r); });
  const themeKeys = Object.keys(groups);

  return (
    <div className="screen">
      <div className="rev-intro">
        <div>
          <h2 className="rev-title">Investments for review</h2>
          <p className="rev-sub">
            A shared shortlist to talk through <b>before</b> any money moves. Approving one drops it into
            Holdings as a <Term tip="0 shares — it shows up so you can track its live price, but counts as $0 in your portfolio until you actually buy.">watchlist entry</Term>;
            rejecting clears it. Nothing here affects your real allocation until approved.
          </p>
        </div>
        <Chip tone="soft" title="Candidates waiting on a decision">{reviews.length} to review</Chip>
      </div>

      {reviews.length === 0 ? (
        <Card><p className="reb-tip">Nothing to review right now. Add a candidate below, or ask Claude to research ideas and drop them here. 🌱</p></Card>
      ) : themeKeys.map(theme => (
        <div key={theme}>
          <SectionLabel>{theme}</SectionLabel>
          <div className="rev-grid">
            {groups[theme].map(r => (
              <Card className="rev-card" key={r.id}>
                <div className="rev-head">
                  <CatDot color={catColor(r.category)} size={11} />
                  <input className="rev-ticker mono" value={r.ticker} placeholder="TICK"
                    onChange={e => updateReview(r.id, 'ticker', e.target.value)} />
                  <input className="rev-name" value={r.name} placeholder="Company / fund name"
                    onChange={e => updateReview(r.id, 'name', e.target.value)} />
                  {r.source && <Chip tone="soft" title="Where this idea came from">{r.source}</Chip>}
                </div>

                <textarea className="rev-thesis" value={r.thesis} rows={3} placeholder="Why it's interesting…"
                  onChange={e => updateReview(r.id, 'thesis', e.target.value)} />

                <div className="rev-alloc">
                  <label className="rev-field">
                    <span className="rev-flabel">
                      <Term tip="Which of your six portfolio groups this joins if approved. Dedicated new groups are a planned follow-up.">Goes in</Term>
                    </span>
                    <select className="rev-select" value={r.category}
                      onChange={e => updateReview(r.id, 'category', e.target.value)}>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className="rev-field">
                    <span className="rev-flabel">
                      <Term tip="Suggested share of that group to put in this one name — a sizing guide, not a rule.">Target of group</Term>
                    </span>
                    <span className="rev-pct">
                      <input className="rev-input mono" type="number" min="0" max="100" step="0.5" value={r.groupPct}
                        onChange={e => updateReview(r.id, 'groupPct', e.target.value)} />%
                    </span>
                  </label>
                </div>

                <div className="rev-actions">
                  {r.link && <a className="rev-link" href={r.link} target="_blank" rel="noreferrer">Learn more ↗</a>}
                  <span className="rev-spacer" />
                  <button type="button" className="btn-soft"
                    onClick={() => { if (confirm(`Reject ${r.ticker || 'this candidate'}? It'll be removed from the review list.`)) rejectReview(r.id); }}>
                    Reject
                  </button>
                  <button type="button" className="btn-soft on"
                    title="Add to Holdings as a 0-share watchlist entry"
                    onClick={() => approveReview(r.id)}>
                    ✓ Approve
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <div className="rev-addrow">
        <button type="button" className="btn-soft" onClick={addReview}>+ Add a candidate</button>
      </div>
    </div>
  );
}
