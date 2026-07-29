-- Run this ONCE in your Supabase SQL Editor
-- supabase.com → Portfolio Manager Project → SQL Editor → New query → paste → Run

create table if not exists portfolio_state (
  id          text primary key default 'shared',
  holdings    jsonb not null default '[]',
  targets     jsonb not null default '{}',
  fx_rate     numeric not null default 5.70,
  updated_at  timestamptz default now()
);

-- Allow anyone with the anon key to read/write (your app uses this)
alter table portfolio_state enable row level security;

create policy "allow all"
  on portfolio_state for all
  using (true) with check (true);

-- Seed the single shared row
insert into portfolio_state (id)
  values ('shared')
  on conflict do nothing;

-- Verify it worked:
select * from portfolio_state;

-- ── Review list + broker trade ledger (portfolio_state) ──
-- reviews: candidate investments waiting on a decision
--          [{ id, ticker, name, category, region, theme, groupPct, thesis, link, source }]
-- trades:  imported broker fills, oldest first — quantity and average cost are
--          DERIVED from this, so re-importing a confirmation is a no-op
--          [{ id, ticker, side, quantity, price, proceeds, commission, datetime,
--             exchange, region, name, source }]
-- The app self-heals if these columns are missing (they stay in localStorage),
-- so running this later is safe — it just turns cloud sync on for them.
alter table portfolio_state
  add column if not exists reviews jsonb not null default '[]',
  add column if not exists trades  jsonb not null default '[]';

-- ── Budget platform (applied 2026-06-12 as migration create_budget_state) ──
-- Single shared JSON-blob row, same pattern as portfolio_state.
create table if not exists budget_state (
  id           text primary key default 'shared',
  accounts     jsonb not null default '[]',
  statements   jsonb not null default '[]',
  transactions jsonb not null default '[]',
  budgets      jsonb not null default '{}',
  updated_at   timestamptz default now()
);

alter table budget_state enable row level security;

create policy "allow all"
  on budget_state for all
  using (true) with check (true);

insert into budget_state (id) values ('shared') on conflict do nothing;

-- ── Airbnb / property module (migration add_properties_to_budget_state) ──
-- properties:     [{ id, name, emoji, address, state, type, placedInService,
--                    purchasePrice, landPct, monthlyPayment, active, tax }]
-- property_rules: learned merchant→property memory [{ id, key, propertyId, scheduleE }]
-- Per-transaction attribution (propertyId, scheduleE) lives inside the transactions blob.
--
-- Phase 3 (tax engine) adds a `tax` sub-object INSIDE each property — no new column,
-- it rides along in the existing properties JSONB:
--   tax: { fmvAtConversion, landValue, buildingBasisOverride, businessUsePct,
--          capitalImprovements: [{ id, desc, amount, placedInService }],
--          form1098: { mortgageInterest, points },
--          escrow:   { propertyTax, insurance },
--          personalUseDays, fairRentalDays, avgStayDays,
--          filingStatus, marginalRatePct, magi, materiallyParticipates, confirmed }
alter table budget_state
  add column if not exists properties     jsonb not null default '[]',
  add column if not exists property_rules jsonb not null default '[]';

-- ── Smart rules (migration add_smart_rules_to_budget_state) ──
-- User-built "description contains <phrase> → action" rules, managed in-app on
-- the Budget → Rules tab. Checked before the built-in keyword categorizer.
-- smart_rules: [{ id, contains, enabled, category, propertyId, scheduleE, review }]
alter table budget_state
  add column if not exists smart_rules jsonb not null default '[]';
