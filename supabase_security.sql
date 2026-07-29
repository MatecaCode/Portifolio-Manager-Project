-- ═══════════════════════════════════════════════════════════════════════════
--  SECURITY FIX — run this ONCE in the Supabase SQL Editor
--  supabase.com → Portfolio Manager Project → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════════════════
--
--  WHAT WAS WRONG
--  Both tables carried this policy:
--
--      create policy "allow all" on <table>
--        for all using (true) with check (true);
--
--  With no role restriction, that grants the `anon` role full access. The anon
--  key ships inside the browser bundle — it is public by design — so anyone
--  who found the deployed URL or the repo could read AND overwrite both
--  tables. budget_state holds imported bank statements, transactions, account
--  balances and property/tax data.
--
--  WHAT THIS DOES
--  Restricts both tables to the `authenticated` role, so a real signed-in
--  session is required. The app now shows a sign-in screen before it loads
--  anything, and the anon key on its own opens nothing.
--
--  ⚠ THIS SQL IS ONLY HALF THE FIX. Also do the manual steps in SECURITY.md —
--  most importantly: turn OFF public sign-ups, and rotate the API keys that
--  were committed to the public repo. Without the sign-up switch, a stranger
--  can still register themselves into the `authenticated` role.

begin;

-- ── Drop the wide-open policies ──────────────────────────────────────────
drop policy if exists "allow all" on portfolio_state;
drop policy if exists "allow all" on budget_state;

-- ── Signed-in access only ────────────────────────────────────────────────
-- One shared household row; both members sign in to the same account, so
-- there is no per-user filtering to do beyond "must be logged in".
create policy "household access" on portfolio_state
  for all to authenticated using (true) with check (true);

create policy "household access" on budget_state
  for all to authenticated using (true) with check (true);

-- ── Table grants ─────────────────────────────────────────────────────────
-- RLS alone already blocks anon, but PostgREST checks GRANTs too. Removing
-- them makes the intent explicit and keeps anon locked out even if a policy
-- is ever re-added by mistake.
revoke all on portfolio_state from anon;
revoke all on budget_state    from anon;

grant select, insert, update, delete on portfolio_state to authenticated;
grant select, insert, update, delete on budget_state    to authenticated;

-- Idempotent — safe if RLS was already on.
alter table portfolio_state enable row level security;
alter table budget_state    enable row level security;

commit;

-- ── Verify ───────────────────────────────────────────────────────────────
-- Expect exactly one policy per table, with roles = {authenticated}.
select tablename, policyname, roles, cmd
  from pg_policies
 where tablename in ('portfolio_state', 'budget_state')
 order by tablename;

-- Expect rowsecurity = true for both.
select relname, relrowsecurity
  from pg_class
 where relname in ('portfolio_state', 'budget_state');
