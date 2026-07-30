import { useState } from 'react'

// The gate in front of the shared household data. There is no sign-up link on
// purpose — accounts are created by hand in the Supabase dashboard, so a
// stranger who finds the deployed URL has nothing to do here.
export default function Login({ signIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await signIn(email, password)
    // On success the auth listener swaps this screen out from under us, so we
    // only need to recover the form when it failed.
    if (res?.error) {
      setError(res.error)
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-mark">
            <div className="brand-sun"></div>
            <div className="brand-wing"></div>
          </div>
          <div>
            <div className="brand-name">SunnyHeron</div>
            <div className="brand-sub">Matheus &amp; Melanie</div>
          </div>
        </div>

        <p className="login-intro">Sign in to see your portfolio and budget.</p>

        <label className="login-field">
          <span className="login-label">Email</span>
          <input className="login-input" type="email" value={email} autoComplete="username"
            required autoFocus onChange={e => setEmail(e.target.value)} />
        </label>

        <label className="login-field">
          <span className="login-label">Password</span>
          <input className="login-input" type="password" value={password} autoComplete="current-password"
            required onChange={e => setPassword(e.target.value)} />
        </label>

        {error && <p className="login-error" role="alert">{error}</p>}

        <button className="login-btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="login-foot">
          Accounts are created by hand in Supabase — there's no public sign-up.
        </p>
      </form>
    </div>
  )
}
