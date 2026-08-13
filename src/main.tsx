import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Login } from './ui/Login'
import { Landing } from './ui/Landing'
import { ClientReview } from './ui/ClientReview'
import { OrderTrack } from './ui/OrderTrack'
import { useAuth } from './state/auth'
import { reviewFromUrl, orderIdFromUrl } from './lib/share'
import { captureRef } from './lib/referral'
import { migrateLegacyStorage } from './lib/brandMigration'
import './styles.css'

migrateLegacyStorage()           // Blue Flame → Mandrel: carry over old localStorage keys once
captureRef()                     // stash an affiliate ?ref= code before anything else
const review = reviewFromUrl()   // a ?review= link opens the client screen, no login
const orderId = orderIdFromUrl() // a ?order= link opens the buyer's order-status page, no login

function Root() {
  const user = useAuth(s => s.user)
  const verifySession = useAuth(s => s.verifySession)
  // The landing page is the very first screen for anyone not already signed
  // in — a marketing page describing Mandrel, with one CTA into Login. Once
  // dismissed it stays dismissed for the rest of this page load (e.g. after
  // signing out), so someone bouncing between accounts isn't shown the ad
  // again; a fresh page load starts over.
  const [entered, setEntered] = useState(false)

  // Confirm a restored token is still accepted. Signs out only if the server
  // rejects it — never because the server was merely unreachable.
  useEffect(() => { void verifySession() }, [verifySession])

  if (review) return <ClientReview spec={review.spec} shop={review.shop} />
  if (orderId) return <OrderTrack id={orderId} />
  if (user) return <App />   // App runs its own paywall gate (shows Pricing if unsubscribed)
  if (!entered) return <Landing onEnter={() => setEntered(true)} />
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
