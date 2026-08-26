-- Run this ONCE in your Supabase SQL Editor
-- supabase.com → Portfolio Manager Project → SQL Editor → New query → paste → Run

create table if not exists portfolio_state (
  id          text primary key default 'shared',
  holdings    jsonb not null default '[]',
  targets     jsonb not null default '{}',
  fx_rate     numeric not null default 5.70,
  updated_at  timestamptz default now()
);

-- Signed-in access only. The anon key ships in the browser bundle and is
-- public, so it must NOT be able to reach this table on its own — the app
-- signs in first (see src/hooks/useAuth.js) and reads with that session.
-- Never widen this to `using (true)` without a role: that hands the whole
-- table to anyone who views source. See SECURITY.md.
alter table portfolio_state enable row level security;

create policy "household access"
  on portfolio_state for all
  to authenticated
  using (true) with check (true);

revoke all on portfolio_state from anon;
grant select, insert, update, delete on portfolio_state to authenticated;

-- Columns added after the original table: cash accounts, the Review shortlist,
-- and the ledger of broker trades already imported (used to stop a re-uploaded
-- statement from doubling a position).
--   reviews:       [{ id, ticker, name, category, region, theme, groupPct, thesis, link, source }]
--   imported_lots: [{ key, source, symbol, shares, unitCost, at }]
-- The app self-heals if these are missing (they stay in localStorage), so
-- running this later is safe — it just turns cloud sync on for them.
alter table portfolio_state
  add column if not exists accounts      jsonb not null default '[]',
  add column if not exists reviews       jsonb not null default '[]',
  add column if not exists imported_lots jsonb not null default '[]';

-- Seed the single shared row
insert into portfolio_state (id)
  values ('shared')
  on conflict do nothing;

-- Verify it worked:
select * from portfolio_state;

-- ── Rental platform (applied 2026-06-12 as migration create_budget_state) ──
-- Single shared JSON-blob row, same pattern as portfolio_state. The table keeps
-- its original name: it started life as a budgeting app, and in August 2026 the
-- spending side was dropped (Rocket Money does that) leaving the Texas-house
-- rental + Schedule E module. No column changes were needed — see below for how
-- `budgets` is used now.
create table if not exists budget_state (
  id           text primary key default 'shared',
  accounts     jsonb not null default '[]',
  statements   jsonb not null default '[]',
  transactions jsonb not null default '[]',
  budgets      jsonb not null default '{}',   -- now just { schema } — the migration stamp
  updated_at   timestamptz default now()
);

-- Same rule as portfolio_state, and this one matters more: budget_state holds
-- imported bank statements, transactions, balances and property/tax data.
--
-- What each column holds today:
--   accounts       [{ id, kind, last4, emoji, name, portfolioAccountId }]
--   statements     [{ id, key, accountId, periodStart, periodEnd, endingBalance, txCount }]
--   transactions   [{ id, accountId, statementId, date, desc, amount, kind,
--                     category, reviewFlag }] — `category` is either 'personal'
--                   or a House bucket, and a House bucket names its Schedule E line
--   budgets        { schema: n } — the client-side migration stamp, nothing else.
--                   Schema 4 collapsed every old personal spending category
--                   ('groceries', 'dining', …) into the single 'personal' bucket.
alter table budget_state enable row level security;

create policy "household access"
  on budget_state for all
  to authenticated
  using (true) with check (true);

revoke all on budget_state from anon;
grant select, insert, update, delete on budget_state to authenticated;

insert into budget_state (id) values ('shared') on conflict do nothing;

-- ── Airbnb / property module (migration add_properties_to_budget_state) ──
-- properties:     [{ id, name, emoji, address, state, type, placedInService,
--                    purchasePrice, landPct, monthlyPayment, active, tax }]
-- property_rules: learned merchant memory [{ id, key, category }] or
--                 [{ id, key, action: 'review' }] — the name predates the merge
--                 of property tagging into the category itself.
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
-- the Rental → Rules tab. Checked before the built-in keyword categorizer.
-- smart_rules: [{ id, contains, enabled, category, review }]
alter table budget_state
  add column if not exists smart_rules jsonb not null default '[]';
