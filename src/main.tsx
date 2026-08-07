import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Login } from './ui/Login'
import { Pricing } from './ui/Pricing'
import { ClientReview } from './ui/ClientReview'
import { useAuth } from './state/auth'
import { reviewFromUrl } from './lib/share'
import { captureRef } from './lib/referral'
import { PAYWALL_ENABLED } from './lib/plans'
import { apiConfigured } from './lib/api'
import './styles.css'

captureRef()                     // stash an affiliate ?ref= code before anything else
const review = reviewFromUrl()   // a ?review= link opens the client screen, no login

function Root() {
  const user = useAuth(s => s.user)
  const verifySession = useAuth(s => s.verifySession)

  // Confirm a restored token is still accepted. Signs out only if the server
  // rejects it — never because the server was merely unreachable.
  useEffect(() => { void verifySession() }, [verifySession])

  if (review) return <ClientReview spec={review.spec} shop={review.shop} />
  if (user) return <App />                              // App runs its own paywall gate
  // Not signed in. With the paywall on (and a backend), the pricing screen — which
  // has register + sign in + subscribe built in — is the entry point. Otherwise the
  // classic login for the internal/free mode.
  return (PAYWALL_ENABLED && apiConfigured()) ? <Pricing /> : <Login />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><Root /></StrictMode>
)
