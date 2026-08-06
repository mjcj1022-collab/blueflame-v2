import { useState } from 'react'
import { PLANS, type Plan } from '../lib/plans'
import { useAuth } from '../state/auth'
import { api, apiConfigured } from '../lib/api'

/**
 * The pricing / paywall screen. Shown by the gate when the paywall is switched
 * on and the shop has no active access. Presents the two ways to get Blue Flame
 * — the $40/mo hosted studio and the $450 one-time offline build — and starts a
 * Stripe checkout for the chosen one. Requires a signed-in account so the
 * purchase can attach to the shop.
 */
export function Pricing({ onClose }: { onClose?: () => void }) {
  const user = useAuth(s => s.user)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const choose = async (plan: Plan) => {
    setErr(null)
    if (!apiConfigured()) { setErr('Billing isn’t connected yet. (Set the backend + Stripe keys to enable checkout.)'); return }
    if (!user) { setErr('Sign in first — your plan attaches to your shop account.'); return }
    setBusy(plan.id)
    try {
      const { url } = await api.startCheckout(plan.id)
      window.location.href = url            // hand off to Stripe Checkout
    } catch {
      setErr('Couldn’t start checkout. Check your connection and try again.')
      setBusy(null)
    }
  }

  return (
    <div className="pricing">
      <div className="pricing-head">
        <h1>Blue Flame — Maker Studio</h1>
        <p>Choose how you want to work. Prices in USD.</p>
      </div>
      <div className="pricing-grid">
        {PLANS.map(p => (
          <div key={p.id} className={`price-card${p.highlight ? ' featured' : ''}`}>
            {p.highlight && <span className="price-tag">Most popular</span>}
            <h2>{p.name}</h2>
            <div className="price-amt"><b>${p.price}</b><span>{p.cadence === 'month' ? '/ month' : ' one-time'}</span></div>
            <p className="price-blurb">{p.blurb}</p>
            <ul className="price-feats">{p.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
            <button className={p.highlight ? 'primary' : 'ghost'} disabled={busy !== null} onClick={() => choose(p)}>
              {busy === p.id ? 'Starting checkout…' : p.cta}
            </button>
          </div>
        ))}
      </div>
      {err && <p className="pricing-err">{err}</p>}
      <p className="pricing-foot">
        Secure payment by Stripe. No card details ever touch our servers.{' '}
        {onClose && <button className="linky" onClick={onClose}>Back</button>}
      </p>
    </div>
  )
}
