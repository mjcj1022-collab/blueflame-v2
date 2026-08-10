import { useState } from 'react'
import { useAuth } from '../state/auth'

/**
 * The entry gate. With a backend connected, it opens on a New member / Existing
 * member choice so a brand-new shop can create an account right here instead of
 * being stuck on a sign-in-only form. Without a backend (the offline desktop
 * build) there's no multi-tenant account system to register into, so it falls
 * back to the plain seeded sign-in.
 */
export function Login() {
  const login = useAuth(s => s.login)
  const loginRemote = useAuth(s => s.loginRemote)
  const registerRemote = useAuth(s => s.registerRemote)
  const backend = useAuth(s => s.backend)

  const [mode, setMode] = useState<'register' | 'login'>(backend ? 'register' : 'login')
  const [shop, setShop] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<null | 'credentials' | 'unreachable' | 'register'>(null)
  const [busy, setBusy] = useState(false)
  // A sleeping free host takes up to a minute to wake. Silence for that long
  // reads as "broken", so say what's happening once it's clearly not instant.
  const [waking, setWaking] = useState(false)

  const pickMode = (m: 'register' | 'login') => { setMode(m); setError(null) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (backend) {
      setBusy(true)
      const wakeHint = setTimeout(() => setWaking(true), 4000)
      const res = mode === 'register' ? await registerRemote(shop, username, password) : await loginRemote(username, password)
      clearTimeout(wakeHint)
      setBusy(false); setWaking(false)
      if (!res.ok) setError(res.reason === 'unreachable' ? 'unreachable' : mode === 'register' ? 'register' : 'credentials')
    } else if (!login(username, password)) {
      setError('credentials')
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">MAN<em>DREL</em></div>
        <p className="login-sub">Jewelry Design Studio</p>

        {backend && (
          <div className="pa-tabs">
            <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => pickMode('register')}>New member</button>
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => pickMode('login')}>Existing member</button>
          </div>
        )}

        {backend && mode === 'register' && (
          <label className="login-field">
            <span>Shop name</span>
            <input value={shop} autoComplete="organization" placeholder="Your studio"
              onChange={e => { setShop(e.target.value); setError(null) }} />
          </label>
        )}
        <label className="login-field">
          <span>{backend ? 'Email' : 'Username'}</span>
          <input value={username} autoFocus autoComplete={backend ? 'email' : 'username'} spellCheck={false}
            onChange={e => { setUsername(e.target.value); setError(null) }} />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input type="password" value={password} autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            onChange={e => { setPassword(e.target.value); setError(null) }} />
        </label>

        {error === 'credentials' && <div className="login-err">Wrong {backend ? 'email' : 'username'} or password.</div>}
        {error === 'register' && <div className="login-err">Couldn’t create the account — that email may already be registered.</div>}
        {error === 'unreachable' && (
          <div className="login-err">Couldn’t reach the server — it may be waking up. Try again in a moment.</div>
        )}
        <button className="login-btn" type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'register' ? 'Create account' : 'Sign in'}
        </button>
        {waking && (
          <p className="login-sub" style={{ margin: '4px 0 -4px', textTransform: 'none', letterSpacing: 0 }}>
            Waking the server — the free host sleeps when idle, this can take up to a minute.
          </p>
        )}
        {backend && <p className="login-sub" style={{ margin: '2px 0 -4px' }}>Connected to backend</p>}
      </form>
    </div>
  )
}
