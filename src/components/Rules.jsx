import { useMemo, useState } from 'react';
import { Card, Chip, SectionLabel } from './ui';
import { fmt } from '../lib/format';
import { BUDGET_CATEGORIES, catById, suggestRulePhrase, smartRuleMatches } from '../data/budget';
import { SCHEDULE_E_CATEGORIES, scheduleEById, guessScheduleE } from '../data/property';

// Smart rules — the user-facing "logic builder". A rule is plain English:
// "when a transaction's description CONTAINS <phrase>, sort it / tag it / review it".
// The wizard (RuleWizard) is reused from the Rules manager and from any
// transaction row; the manager lists, toggles, edits and deletes the rules.

const dayLabel = d => `${d.slice(5, 7)}/${d.slice(8, 10)}`;

// A draft can be seeded from a transaction ({ desc, category }) or an existing
// rule ({ id, contains, ... }). suggestRulePhrase gives a friendly default phrase.
function draftFrom(seed = {}) {
  return {
    contains: seed.contains ?? (seed.desc ? suggestRulePhrase(seed.desc) : ''),
    category: seed.category ?? null,
    propertyId: seed.propertyId ?? null,
    scheduleE: seed.scheduleE ?? null,
    review: seed.review ?? false,
  };
}

export function RuleWizard({ b, seed = {}, onClose }) {
  const editing = !!seed.id;
  const properties = b.properties || [];
  const [d, setD] = useState(() => draftFrom(seed));
  const [applyExisting, setApplyExisting] = useState(true);

  const mode = d.review ? 'review' : (d.propertyId ? 'house' : 'none');
  const setMode = m => setD(s => ({
    ...s,
    review: m === 'review',
    propertyId: m === 'house' ? (s.propertyId || properties[0]?.id || null) : null,
    scheduleE: m === 'house' ? (s.scheduleE || guessScheduleE(s.category || 'other')) : null,
  }));

  const matches = useMemo(() => {
    if (d.contains.trim().length < 2) return [];
    const probe = { contains: d.contains.trim(), enabled: true };
    return b.transactions.filter(t => smartRuleMatches(probe, t))
      .sort((a, z) => z.date.localeCompare(a.date));
  }, [b.transactions, d.contains]);

  const hasAction = !!d.category || d.review || !!d.propertyId;
  const canSave = d.contains.trim().length >= 2 && hasAction;

  function save() {
    if (!canSave) return;
    const rule = {
      contains: d.contains.trim(),
      category: d.category || null,
      propertyId: d.review ? null : (d.propertyId || null),
      scheduleE: d.review ? null : (d.propertyId ? (d.scheduleE || guessScheduleE(d.category || 'other')) : null),
      review: d.review,
      enabled: true,
    };
    if (editing) {
      b.updateSmartRule(seed.id, rule);
      if (applyExisting) b.applySmartRule(seed.id);
    } else {
      b.addSmartRule(rule, applyExisting);
    }
    onClose?.();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal-card rule-wizard" onClick={e => e.stopPropagation()}>
        <SectionLabel right={<Chip tone="warn">{editing ? 'EDIT RULE' : 'NEW RULE'}</Chip>}>
          {editing ? 'Edit smart rule 🧠' : 'Build a smart rule 🧠'}
        </SectionLabel>

        {/* 1 · the trigger */}
        <div className="rw-step">
          <div className="rw-q">1 · When a transaction’s description contains…</div>
          <input className="rw-input" autoFocus value={d.contains}
            placeholder="e.g. BORRELIO"
            onChange={e => setD(s => ({ ...s, contains: e.target.value }))} />
          <div className="rw-hint">Not case-sensitive. Keep it short and distinctive — a name or brand works best.</div>
        </div>

        {/* 2 · the category */}
        <div className="rw-step">
          <div className="rw-q">2 · Sort it into… <span className="rw-opt">(optional)</span></div>
          <div className="rw-chips">
            {BUDGET_CATEGORIES.map(c => (
              <button key={c.id} type="button"
                className={'rw-chip' + (d.category === c.id ? ' on' : '')}
                onClick={() => setD(s => ({ ...s, category: s.category === c.id ? null : c.id }))}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* 3 · the house decision */}
        <div className="rw-step">
          <div className="rw-q">3 · Is it for the {properties[0]?.name || 'house'}?</div>
          <div className="rw-modes">
            <button type="button" className={'rw-mode' + (mode === 'none' ? ' on' : '')} onClick={() => setMode('none')}>👤 Personal</button>
            <button type="button" className={'rw-mode' + (mode === 'house' ? ' on' : '')} onClick={() => setMode('house')} disabled={!properties.length}>🏡 House</button>
            <button type="button" className={'rw-mode' + (mode === 'review' ? ' on' : '')} onClick={() => setMode('review')}>🔍 Always ask me</button>
          </div>
          {mode === 'house' && (
            <div className="rw-house">
              {properties.length > 1 && (
                <select className="tx-cat" value={d.propertyId || ''}
                  onChange={e => setD(s => ({ ...s, propertyId: e.target.value }))}>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                </select>
              )}
              <select className="tx-cat" value={d.scheduleE || ''}
                onChange={e => setD(s => ({ ...s, scheduleE: e.target.value }))}>
                {SCHEDULE_E_CATEGORIES.map(sc => <option key={sc.id} value={sc.id}>{sc.emoji} {sc.name}</option>)}
              </select>
            </div>
          )}
          {mode === 'review' && <div className="rw-hint">Matching lines land in “Needs manual review” so you decide each one by hand — nothing is auto-tagged.</div>}
          {!properties.length && <div className="rw-hint">Create a property on the Airbnb tab to enable house tagging.</div>}
        </div>

        {/* live preview */}
        <div className="rw-preview">
          <div className="rw-preview-head">
            {d.contains.trim().length < 2
              ? 'Type a phrase to see what it matches.'
              : <>Matches <strong>{matches.length}</strong> transaction{matches.length === 1 ? '' : 's'} right now.</>}
          </div>
          {matches.slice(0, 3).map(t => (
            <div className="rw-preview-row" key={t.id}>
              <span className="mono tx-date">{dayLabel(t.date)}</span>
              <span className="tx-desc">{t.desc}</span>
              <span className="mono tx-amt">{fmt(t.amount)}</span>
            </div>
          ))}
          {matches.length > 3 && <div className="rw-hint">…and {matches.length - 3} more.</div>}
          {matches.length > 0 && (
            <label className="rw-apply">
              <input type="checkbox" checked={applyExisting} onChange={e => setApplyExisting(e.target.checked)} />
              Apply to these {matches.length} existing transaction{matches.length === 1 ? '' : 's'} now (otherwise it only affects future imports)
            </label>
          )}
        </div>

        <div className="pending-actions">
          <button className="btn-soft on" disabled={!canSave} onClick={save}>{editing ? '✓ Save rule' : '✓ Create rule'}</button>
          <button className="btn-soft" onClick={onClose}>Cancel</button>
        </div>
        {!hasAction && d.contains.trim().length >= 2 && (
          <div className="rw-hint" style={{ marginTop: 8 }}>Pick at least one action — a category, House, or “Always ask me”.</div>
        )}
      </div>
    </div>
  );
}

function RuleRow({ b, rule, onEdit }) {
  const count = useMemo(
    () => b.transactions.filter(t => smartRuleMatches({ contains: rule.contains, enabled: true }, t)).length,
    [b.transactions, rule.contains]);
  const prop = b.properties.find(p => p.id === rule.propertyId);
  const off = rule.enabled === false;
  return (
    <div className={'rule-row' + (off ? ' off' : '')}>
      <label className="rule-toggle" title={off ? 'Disabled — click to enable' : 'Enabled — click to disable'}>
        <input type="checkbox" checked={!off} onChange={e => b.updateSmartRule(rule.id, { enabled: e.target.checked })} />
      </label>
      <div className="rule-main">
        <div className="rule-when">contains <strong>“{rule.contains}”</strong></div>
        <div className="rule-acts-row">
          {rule.category && <Chip tone="soft">{catById(rule.category).emoji} {catById(rule.category).name}</Chip>}
          {rule.review && <Chip tone="warn">🔍 Always review</Chip>}
          {rule.propertyId && <Chip tone="soft">🏡 {prop?.name || 'House'} · {scheduleEById(rule.scheduleE).name}</Chip>}
          {!rule.category && !rule.review && !rule.propertyId && <span className="rw-hint">no action</span>}
        </div>
      </div>
      <span className="rule-count mono" title="Transactions whose description matches right now">{count} match{count === 1 ? '' : 'es'}</span>
      <div className="rule-row-acts">
        <button className="btn-soft" title="Re-apply this rule to all matching transactions now"
          onClick={() => b.applySmartRule(rule.id)}>Apply now</button>
        <button className="btn-soft" onClick={onEdit}>Edit</button>
        <button className="hold-del" title="Delete this rule"
          onClick={() => { if (confirm('Delete this rule? Transactions it already changed keep their current values.')) b.removeSmartRule(rule.id); }}>✕</button>
      </div>
    </div>
  );
}

export default function Rules({ b }) {
  const [wizard, setWizard] = useState(null); // null | {} (new) | rule (edit)
  const rules = b.smartRules || [];
  return (
    <>
      <Card>
        <SectionLabel right={<button className="btn-soft on" onClick={() => setWizard({})}>✨ New rule</button>}>
          Smart rules 🧠
        </SectionLabel>
        <p className="reb-tip" style={{ marginBottom: 12 }}>
          Teach the budget your own logic. A rule reads in plain English — “when the description
          <strong> contains</strong> a phrase, sort it into a category, tag it to the house, or send it to review.”
          Rules run on every import and you can apply them to what’s already here. They’re checked
          before the built-in keywords, so your logic always wins.
        </p>
        {rules.length === 0 && (
          <div className="hold-empty">
            No rules yet. Tap <strong>✨ New rule</strong>, or hit <strong>✨ Rule</strong> on any transaction
            in Spending to build one from a real example (like a Zelle to your lawn guy → 🏠 Home / House).
          </div>
        )}
        {rules.length > 0 && (
          <div className="rules-list">
            {rules.map(r => <RuleRow key={r.id} b={b} rule={r} onEdit={() => setWizard(r)} />)}
          </div>
        )}
      </Card>
      {wizard && <RuleWizard b={b} seed={wizard} onClose={() => setWizard(null)} />}
    </>
  );
}
