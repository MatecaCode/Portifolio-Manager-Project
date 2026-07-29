# Security

This repository is **public**, and the app holds real personal financial data —
imported bank statements, transactions, account balances, holdings, and
property/tax figures. This file is the runbook for keeping that safe.

---

## What was wrong (found 2026-07-29)

Two separate problems, one serious:

**1. The cloud database was world-readable and world-writable.** 🔴

Both Supabase tables carried this policy:

```sql
create policy "allow all" on portfolio_state for all using (true) with check (true);
create policy "allow all" on budget_state    for all using (true) with check (true);
```

With no role restriction, `using (true)` grants access to the **`anon`** role.
The anon key is compiled into the browser bundle — it is public by design — so
anyone who found the deployed URL could read and overwrite both tables,
including every imported bank statement in `budget_state`.

**2. Live API keys were committed to the public repo.** 🟠

`HANDOFF.md` and `.env.example` contained working Finnhub, Brapi, and Supabase
keys.

## What was fixed in code

- The app is now gated behind Supabase Auth (`src/hooks/useAuth.js`,
  `src/components/Login.jsx`). The portfolio and budget hooks don't mount —
  and therefore never query Supabase — until there's a session.
- `supabase_security.sql` replaces the open policies with `to authenticated`
  ones and revokes the `anon` grants.
- `supabase_setup.sql` was corrected so a fresh setup is never insecure.
- Keys were removed from `HANDOFF.md` and `.env.example`.

## What you still have to do by hand

Code changes alone do **not** close this. Work through the list in order.

### 1. Rotate the three leaked keys 🔴

Scrubbing the files does not help: **the keys are in git history forever, and
the repo is public.** Assume they are compromised and roll them.

| Key | Where |
|---|---|
| Supabase anon/publishable | Supabase → Settings → API Keys → roll |
| Finnhub | finnhub.io/dashboard → revoke + create new |
| Brapi | brapi.dev → revoke + create new |

Then update the new values in **both** places: your local `.env.local`, and
Vercel → Project → Settings → Environment Variables. Redeploy.

### 2. Create the sign-in accounts

Supabase → **Authentication → Users → Add user**. One account each, or a single
shared login — either works, the data is one shared row.

### 3. Turn OFF public sign-ups 🔴

Supabase → **Authentication → Providers → Email** → disable sign-ups.

**This step is not optional.** The new policies grant access to anyone in the
`authenticated` role. If strangers can register themselves, they become
`authenticated`, and you're back where you started with extra steps.

### 4. Deploy this branch, then run the SQL

Order matters:

1. **Merge + deploy first.** The live site gets its login screen while the old
   permissive policies are still in place, so you can sign in and confirm your
   data loads.
2. **Then run `supabase_security.sql`** in the SQL Editor. It tightens the
   policies under the already-working app.

Doing it the other way round breaks the live site in between — the old
deployment has no way to authenticate.

Verify afterwards: open the site in a private window. You should get the login
screen and no data until you sign in.

### 5. Optional — purge the keys from git history

Rotation in step 1 makes the old keys worthless, so this is cleanup rather than
a fix. If you want it anyway, `git filter-repo` or BFG can strip them, but it
rewrites every commit hash and requires a force-push. Rotate first regardless.

---

## Known remaining limitation

**The price-API keys can't be secret in a client-side app.** Anything prefixed
`VITE_` is compiled into the JS bundle, so the Finnhub and Brapi keys are
readable in devtools by anyone visiting the site. Rotating them (step 1) fixes
the *committed-to-a-public-repo* problem, not this one.

The exposure is limited — those keys read public market quotes and carry no
personal data. Worst case is someone burning your free-tier rate limit.

Two ways to close it properly, when you want to:

1. **Restrict by domain** in the Finnhub/Brapi dashboards, where the plan
   supports it. Cheap, partial.
2. **Proxy through a Vercel serverless function** (`/api/prices`), keeping the
   keys server-side as non-`VITE_` env vars. This is the real fix. It wasn't
   done here because it changes how prices are fetched in production and
   couldn't be tested in the sandbox this work was done in — shipping it
   untested risked breaking the live price feed.

The Supabase anon key being public is **fine and expected** — that's what it's
for. RLS is the thing protecting the data, which is what step 4 puts right.

---

## Rules going forward

- Never commit real keys. `.env.local` only (gitignored via `*.local`).
- Never use the Supabase **`service_role`** key in frontend code — it bypasses
  RLS entirely.
- Never write an RLS policy as `using (true)` without a `to <role>` clause.
  That is the exact bug documented above.
- When adding a table, give it RLS and a `to authenticated` policy in the same
  migration that creates it.
