import { useState } from 'react'
import { PLANS, type Plan } from '../lib/plans'
import { useAuth } from '../state/auth'
import { api, apiConfigured } from '../lib/api'

/**
 * The pricing / paywall screen. Shown by the gate when the paywall is on and the
 * shop has no active access. A new customer can create their shop account (or
 * sign in) right here, then subscribe or buy the offline build — the whole
 * sign-up → pay funnel in one screen. Checkout is handled by Stripe.
 */
export function Pricing() {
  const user = useAuth(s => s.user)
  const loginRemote = useAuth(s => s.loginRemote)
  const registerRemote = useAuth(s => s.registerRemote)

  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [shop, setShop] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authErr, setAuthErr] = useState<string | null>(null)

  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthErr(null)
    if (!apiConfigured()) { setAuthErr('Accounts need the backend connected.'); return }
    setAuthBusy(true)
    const res = mode === 'register'
      ? await registerRemote(shop, email, password)
      : await loginRemote(email, password)
    setAuthBusy(false)
    if (!res.ok) {
      setAuthErr(res.reason === 'unreachable'
        ? 'Couldn’t reach the server — it may be waking up (up to a minute on the free plan). Try again.'
        : mode === 'register' ? 'Couldn’t create the account — that email may already be registered.' : 'Wrong email or password.')
    }
  }

  const choose = async (plan: Plan) => {
    setErr(null)
    if (!user) { setErr('Create your account or sign in first.'); return }
    setBusy(plan.id)
    try {
      const { url } = await api.startCheckout(plan.id)
      window.location.href = url            // hand off to Stripe Checkout
    } catch {
      setErr('Couldn’t start checkout. Try again in a moment.')
      setBusy(null)
    }
  }

  return (
    <div className="pricing">
      <div className="pricing-head">
        <h1>Blue Flame — Maker Studio</h1>
        <p>The complete jewelry design, quoting and production studio. Choose how you want to work.</p>
      </div>

      {!user && (
        <form className="pricing-auth" onSubmit={submitAuth}>
          <div className="pa-tabs">
            <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setAuthErr(null) }}>Create account</button>
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setAuthErr(null) }}>Sign in</button>
          </div>
          {mode === 'register' && (
            <label className="pa-field"><span>Shop name</span>
              <input value={shop} onChange={e => setShop(e.target.value)} autoComplete="organization" placeholder="Your studio" required />
            </label>
          )}
          <label className="pa-field"><span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="pa-field"><span>Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={6} required />
          </label>
          {authErr && <p className="pricing-err">{authErr}</p>}
          <button className="primary" type="submit" disabled={authBusy}>
            {authBusy ? 'Working…' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      )}

      {user && <p className="pricing-signed">Signed in as <b>{user}</b> — pick a plan to unlock the studio.</p>}

      <div className="pricing-grid">
        {PLANS.map(p => (
          <div key={p.id} className={`price-card${p.highlight ? ' featured' : ''}`}>
            {p.highlight && <span className="price-tag">Most popular</span>}
            <h2>{p.name}</h2>
            <div className="price-amt"><b>${p.price}</b><span>{p.cadence === 'month' ? '/ month' : ' one-time'}</span></div>
            <p className="price-blurb">{p.blurb}</p>
            <ul className="price-feats">{p.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
            <button className={p.highlight ? 'primary' : 'ghost'} disabled={busy !== null || !user} title={!user ? 'Create your account above first' : ''} onClick={() => choose(p)}>
              {busy === p.id ? 'Starting checkout…' : p.cta}
            </button>
          </div>
        ))}
      </div>
      {err && <p className="pricing-err">{err}</p>}
      <p className="pricing-foot">
        Secure payment by Stripe. No card details ever touch our servers.<br />
        By continuing you agree to our <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> and <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
      </p>
    </div>
  )
}
