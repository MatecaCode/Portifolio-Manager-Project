import { Card, Chip, Donut, ProgressBar, SectionLabel, Term } from './ui';
import { fmt0 } from '../lib/format';

// Placeholder for the Budget platform — the spending-side sibling of the portfolio.
// Vision (see CONCEPT.md → "Budget Companion"): import Chase credit card / account
// statements, auto-sort every dollar into fun categories, show where the money goes,
// and coach us into spending less next month. Inspired by the best of YNAB
// (every dollar gets a job), Copilot Money (delightful auto-categorization),
// Monarch (built for couples), and Rocket Money (subscription hunting).
//
// Everything below is SAMPLE DATA so we can feel the layout before wiring it up.

const SAMPLE_CATEGORIES = [
  { id: 'home',     emoji: '🏠', name: 'Home & rent',     spent: 1450, budget: 1500, color: '#E8A03E' },
  { id: 'grocery',  emoji: '🛒', name: 'Groceries',       spent: 486,  budget: 550,  color: '#3E9B8F' },
  { id: 'dining',   emoji: '🌮', name: 'Dining out',      spent: 312,  budget: 250,  color: '#E07856' },
  { id: 'fun',      emoji: '🎢', name: 'Fun & travel',    spent: 264,  budget: 300,  color: '#9C8EC9' },
  { id: 'transit',  emoji: '🚗', name: 'Transport',       spent: 189,  budget: 220,  color: '#6FA8C9' },
  { id: 'subs',     emoji: '📺', name: 'Subscriptions',   spent: 87,   budget: 80,   color: '#E5B45E' },
  { id: 'other',    emoji: '🧺', name: 'Everything else', spent: 396,  budget: 600,  color: '#8FAE9B' },
];

const STEPS = [
  {
    emoji: '💳',
    title: '1 · Drop in a statement',
    text: 'Upload your Chase credit card or checking statement (CSV or PDF). No bank logins, no third parties — just the file.',
  },
  {
    emoji: '✨',
    title: '2 · Every dollar gets sorted',
    text: '"TST* TACO LOCO 0042" becomes 🌮 Dining out. Smart rules learn your merchants, and you can re-file anything with one tap.',
  },
  {
    emoji: '🧠',
    title: '3 · Get the monthly story',
    text: 'A fun recap of where the money went, which budgets held, and concrete ideas to spend less next month.',
  },
];

const COACH_TIPS = [
  { emoji: '🍳', text: 'Dining out ran $62 over budget — about three takeout nights. One cook-together night next month puts it back on track.' },
  { emoji: '🔎', text: '2 subscriptions haven’t been used in 60+ days. Cancelling both frees up $23/mo without feeling a thing.' },
  { emoji: '📈', text: 'Beat the budget by $316 and that’s ~$3.8k a year flowing straight into the portfolio next door.' },
];

export default function Budget() {
  const totalSpent = SAMPLE_CATEGORIES.reduce((a, c) => a + c.spent, 0);
  const totalBudget = SAMPLE_CATEGORIES.reduce((a, c) => a + c.budget, 0);
  const left = totalBudget - totalSpent;
  const slices = SAMPLE_CATEGORIES.map(c => ({ id: c.id, color: c.color, value: c.spent }));

  return (
    <div className="screen">
      <div className="import-hero">
        <h2>The other half of the money story 💸</h2>
        <p>
          The portfolio tracks what we keep — this tracks what we spend.
          Import a Chase statement and watch it turn into a clear, honest
          (and a little bit fun) picture of where the money actually goes.
        </p>
        <Chip tone="warn">COMING SOON — SAMPLE DATA BELOW</Chip>
      </div>

      {/* Month at a glance */}
      <Card className="hero">
        <div>
          <div className="hero-greeting">May, together 🤝 (sample month)</div>
          <div className="hero-networth">
            <Term tip="Everything that left the accounts this month, across every category.">Spent so far</Term>
            <div className="hero-amount">{fmt0(totalSpent)}</div>
          </div>
          <div>
            <div className="hero-goal-row">
              <span className="hero-goal-label">🎯 Monthly budget · {fmt0(totalBudget)}</span>
              <span className="hero-goal-pct">{Math.round((totalSpent / totalBudget) * 100)}%</span>
            </div>
            <ProgressBar pct={(totalSpent / totalBudget) * 100} height={10} />
            <div className="hero-goal-note">
              {fmt0(left)} still in the tank — finish under budget and it rolls toward the portfolio. 🏝️
            </div>
          </div>
        </div>
        <div className="hero-right budget-donut-wrap">
          <Donut
            slices={slices}
            size={170}
            centerTop={fmt0(totalSpent)}
            centerBottom="this month"
          />
        </div>
      </Card>

      {/* Category breakdown */}
      <Card>
        <SectionLabel right={<Chip tone="soft">drill into any category — soon</Chip>}>
          Where it went
        </SectionLabel>
        <div className="cat-list">
          {SAMPLE_CATEGORIES.map(c => {
            const pct = (c.spent / c.budget) * 100;
            const over = c.spent > c.budget;
            return (
              <div className="cat-row" key={c.id}>
                <span className="budget-cat-emoji">{c.emoji}</span>
                <div className="cat-name">
                  {c.name}
                  <span className="cat-sub">{over ? `${fmt0(c.spent - c.budget)} over budget` : `${fmt0(c.budget - c.spent)} left of ${fmt0(c.budget)}`}</span>
                </div>
                <div className="budget-cat-bar">
                  <ProgressBar pct={pct} height={8} tone={over ? 'down' : 'accent'} />
                </div>
                <div className="cat-vals">
                  <div className="cat-value">{fmt0(c.spent)}</div>
                  <div className={'cat-pl ' + (over ? 'down' : 'up')}>{Math.round(pct)}% of budget</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* How it will work */}
      <Card>
        <SectionLabel>How it will work</SectionLabel>
        <div className="story-grid">
          {STEPS.map(s => (
            <div className="story-cell" key={s.title}>
              <span className="story-emoji">{s.emoji}</span>
              <div>
                <div className="budget-step-title">{s.title}</div>
                <p className="story-text">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="two-col">
        {/* Coach's corner */}
        <Card>
          <SectionLabel right={<Chip tone="soft">sample insights</Chip>}>
            Coach&rsquo;s corner 🧢
          </SectionLabel>
          <div className="reb-advice">
            {COACH_TIPS.map((t, i) => (
              <div className="reb-advice-row" key={i}>
                <span className="story-emoji">{t.emoji}</span>
                <p>{t.text}</p>
              </div>
            ))}
          </div>
          <div className="explainer">
            <p>
              Each month the coach reads the numbers and suggests one or two
              painless ways to spend less next month — nudges, not lectures.
            </p>
          </div>
        </Card>

        {/* Budget goal setup teaser */}
        <Card>
          <SectionLabel>Set up a budget 🎯</SectionLabel>
          <p className="reb-tip" style={{ marginBottom: 14 }}>
            Pick a number for each category — or one big monthly cap — and
            we&rsquo;ll show live progress bars as statements come in. Goals can be
            playful too: &ldquo;keep dining under $250 and the difference funds
            taco night in Mexico City&rdquo;. 🌮✈️
          </p>
          <div className="budget-goal-teaser">
            <div className="dropzone budget-dropzone">
              <div className="dropzone-title">Drop a Chase statement here</div>
              <p>CSV or PDF. We&rsquo;ll preview every transaction and its category before anything is saved — no surprises.</p>
            </div>
          </div>
        </Card>
      </div>

      <p className="budget-credits">
        Borrowing the best ideas from <strong>YNAB</strong> (every dollar gets a job),{' '}
        <strong>Copilot Money</strong> (auto-categorization that&rsquo;s actually fun),{' '}
        <strong>Monarch</strong> (built for couples), and <strong>Rocket Money</strong>{' '}
        (subscription hunting) — remixed into the SunnyHeron way.
      </p>
    </div>
  );
}
