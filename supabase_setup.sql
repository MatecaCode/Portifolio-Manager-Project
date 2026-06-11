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
