import { describe, it, expect } from 'vitest'
import { PLANS, planById, accessFromSubscription, GRACE_MS, type Subscription } from '../lib/plans'

const NOW = 1_760_000_000_000

describe('plans catalog', () => {
  it('offers a $40 monthly online plan and a $450 one-time offline plan', () => {
    const online = PLANS.find(p => p.kind === 'subscription')
    const offline = PLANS.find(p => p.kind === 'oneoff')
    expect(online?.price).toBe(40)
    expect(online?.cadence).toBe('month')
    expect(offline?.price).toBe(450)
    expect(offline?.cadence).toBe('once')
  })
  it('looks a plan up by id', () => {
    expect(planById('studio-monthly')?.price).toBe(40)
    expect(planById('nope')).toBeUndefined()
  })
})

describe('access control', () => {
  const sub = (over: Partial<Subscription>): Subscription => ({ status: 'active', ...over })

  it('no subscription is locked out', () => {
    expect(accessFromSubscription(null, NOW).allowed).toBe(false)
    expect(accessFromSubscription({ status: 'none' }, NOW).allowed).toBe(false)
  })
  it('active and trialing get in', () => {
    expect(accessFromSubscription(sub({ status: 'active' }), NOW).allowed).toBe(true)
    expect(accessFromSubscription(sub({ status: 'trialing' }), NOW).allowed).toBe(true)
  })
  it('a one-time offline purchase does NOT unlock the hosted studio on its own', () => {
    expect(accessFromSubscription({ status: 'none', offline: true }, NOW).allowed).toBe(false)
    expect(accessFromSubscription({ status: 'none', offline: true }, NOW).reason).toBe('offline-only')
    expect(accessFromSubscription({ status: 'canceled', offline: true, currentPeriodEnd: 0 }, NOW).reason).toBe('offline-only')
  })
  it('an offline purchase plus an active subscription still gets hosted access', () => {
    expect(accessFromSubscription(sub({ status: 'active', offline: true }), NOW).allowed).toBe(true)
  })
  it('canceled keeps access until the paid period actually ends', () => {
    expect(accessFromSubscription(sub({ status: 'canceled', currentPeriodEnd: NOW + 5_000 }), NOW).allowed).toBe(true)
    expect(accessFromSubscription(sub({ status: 'canceled', currentPeriodEnd: NOW - 5_000 }), NOW).allowed).toBe(false)
  })
  it('past_due gets a grace window, then locks', () => {
    expect(accessFromSubscription(sub({ status: 'past_due', currentPeriodEnd: NOW }), NOW).reason).toBe('grace')
    expect(accessFromSubscription(sub({ status: 'past_due', currentPeriodEnd: NOW - GRACE_MS - 1 }), NOW).allowed).toBe(false)
  })
})
