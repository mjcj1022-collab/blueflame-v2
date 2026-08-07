/**
 * Subscription & purchase plans for Blue Flame, plus the pure access-control
 * logic that decides whether a shop may use the studio. Kept free of any UI or
 * network code so the gate is deterministic and testable. Prices are the shop's
 * to set in Stripe; the numbers here are the launch defaults shown on the
 * pricing screen and must match the Stripe products.
 */

export type PlanKind = 'subscription' | 'oneoff'

export interface Plan {
  id: string
  name: string
  price: number          // USD
  cadence: 'month' | 'once'
  kind: PlanKind
  blurb: string
  features: string[]
  cta: string
  highlight?: boolean
}

/** The two ways to get Blue Flame: a hosted monthly seat, or a one-time offline buy. */
export const PLANS: Plan[] = [
  {
    id: 'studio-monthly',
    name: 'Studio — Online',
    price: 40,
    cadence: 'month',
    kind: 'subscription',
    blurb: 'The full hosted studio, always up to date, with cloud sync and your team.',
    features: [
      'Full design + sculpt studio',
      'Live quoting, casting & production tools',
      'All exports (STL, STEP, PDFs, client sheets)',
      'Cloud library, team accounts & roles',
      'New features the moment they ship',
    ],
    cta: 'Subscribe — $40/mo',
    highlight: true,
  },
  {
    id: 'offline-lifetime',
    name: 'Offline — Download',
    price: 450,
    cadence: 'once',
    kind: 'oneoff',
    blurb: 'Own it outright. A downloadable build that runs on your bench machine, no monthly fee.',
    features: [
      'One-time purchase, no subscription',
      'Runs offline on your own computer',
      'Full design + sculpt studio & exports',
      'Yours to keep for this major version',
      'Cloud sync & team accounts not included',
    ],
    cta: 'Buy offline — $450',
  },
]

export const planById = (id: string): Plan | undefined => PLANS.find(p => p.id === id)

/** Stripe subscription lifecycle statuses we care about, plus our own sentinels. */
export type SubStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none'

export interface Subscription {
  status: SubStatus
  planId?: string
  currentPeriodEnd?: number   // epoch ms the paid period runs through
  offline?: boolean           // a one-time offline purchase — access never lapses
}

/** How long a failed payment (past_due) keeps access before the studio locks. */
export const GRACE_MS = 3 * 24 * 60 * 60 * 1000   // 3 days

export type AccessReason = 'ok' | 'offline' | 'grace' | 'period-remaining' | 'no-subscription' | 'expired' | 'past-due'

export interface Access { allowed: boolean; reason: AccessReason }

/**
 * Decide whether a subscription grants studio access right now.
 * - a one-time offline purchase always passes
 * - active / trialing pass
 * - canceled still passes until the paid period actually ends (they paid for it)
 * - past_due passes only within the grace window after the period end
 * - anything else is locked
 */
export function accessFromSubscription(sub: Subscription | null | undefined, now: number): Access {
  if (!sub) return { allowed: false, reason: 'no-subscription' }
  if (sub.offline) return { allowed: true, reason: 'offline' }   // one-time buy — checked before status
  if (sub.status === 'none') return { allowed: false, reason: 'no-subscription' }

  const end = sub.currentPeriodEnd ?? 0
  switch (sub.status) {
    case 'active':
    case 'trialing':
      return { allowed: true, reason: 'ok' }
    case 'canceled':
      return end > now ? { allowed: true, reason: 'period-remaining' } : { allowed: false, reason: 'expired' }
    case 'past_due':
      return now <= end + GRACE_MS ? { allowed: true, reason: 'grace' } : { allowed: false, reason: 'past-due' }
    default:
      return { allowed: false, reason: 'no-subscription' }
  }
}

/**
 * Is the paywall switched on for this build? Pay-to-play is the default: the
 * hosted studio gates access unless the build explicitly sets VITE_PAYWALL=off.
 * Note the gate itself (in App/main) only engages when a backend is configured,
 * so the offline desktop build — which ships with no API — is never gated.
 */
export const PAYWALL_ENABLED: boolean = (() => {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PAYWALL
    return String(v ?? 'on').toLowerCase() !== 'off'
  } catch { return true }
})()
