import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Login } from './ui/Login'
import { ClientReview } from './ui/ClientReview'
import { useAuth } from './state/auth'
import { reviewFromUrl } from './lib/share'
import { captureRef } from './lib/referral'
import { migrateLegacyStorage } from './lib/brandMigration'
import './styles.css'

migrateLegacyStorage()           // Blue Flame → Mandrel: carry over old localStorage keys once
captureRef()                     // stash an affiliate ?ref= code before anything else
const review = reviewFromUrl()   // a ?review= link opens the client screen, no login

function Root() {
  const user = useAuth(s => s.user)
  const verifySession = useAuth(s => s.verifySession)

  // Confirm a restored token is still accepted. Signs out only if the server
  // rejects it — never because the server was merely unreachable.
  useEffect(() => { void verifySession() }, [verifySession])

  if (review) return <ClientReview spec={review.spec} shop={review.shop} />
  if (user) return <App />   // App runs its own paywall gate (shows Pricing if unsubscribed)
  // Not signed in: the New member / Existing member gate is always the first screen.
  // A new member registers here, then lands on App's paywall gate — which shows the
  // pricing tiers and Stripe checkout automatically since a fresh account has no
  // active subscription yet. An existing member with a live subscription sails
  // straight into the studio; one without gets the same tiers screen.
  return <Login />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><Root /></StrictMode>
)
