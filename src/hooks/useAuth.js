import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Sign-in state for the shared household account.
//
// The cloud tables (portfolio_state + budget_state) are protected by RLS
// policies that only grant access to the `authenticated` role, so every read
// and write needs a real session. The anon key shipped in the browser bundle
// no longer opens anything on its own.
//
// Sign-up is deliberately NOT offered here, and public sign-ups must stay
// disabled in the Supabase dashboard — otherwise anyone could register
// themselves into the `authenticated` role and reach the shared row. Accounts
// are created by hand: Supabase → Authentication → Users → Add user.
//
// With no Supabase env vars configured the app runs local-only (localStorage),
// so there's nothing to protect and no sign-in is asked for.
export function useAuth() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(!!supabase)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data?.session ?? null)
      setChecking(false)
    })
    // Fires on sign-in, sign-out, and token refresh — keeps the gate honest
    // if the session expires while the tab is open.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return
      setSession(next)
      setChecking(false)
    })
    return () => { alive = false; data?.subscription?.unsubscribe() }
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: 'Cloud sync is not configured on this device.' }
    const { error } = await supabase.auth.signInWithPassword({
      email: (email || '').trim(),
      password,
    })
    return { error: error ? error.message : null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
  }, [])

  // `required` is false in local-only mode, which is what lets the app still
  // run offline / unconfigured without inventing a login nobody can pass.
  return { session, checking, signIn, signOut, required: !!supabase }
}
