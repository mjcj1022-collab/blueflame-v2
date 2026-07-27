import type { SculptObject } from '../state/modeler'
import { sculptEstimate } from './sculpt'
import { laborBreakdown } from './laborTime'

/**
 * Pricing tiers. A maker who sells both to shops and to the public needs more than
 * one number: the shop cost, a wholesale price for stockists, keystone (the classic
 * 2× cost), and the retail the estimate already charges. Laid out together so the
 * maker can quote whichever channel is on the phone without re-deriving anything.
 */

export interface PricingTiers {
  cost: number
  wholesale: number
  keystone: number
  retail: number
}

export function pricingTiers(objects: SculptObject[], alloyId: string): PricingTiers {
  const est = sculptEstimate(objects, alloyId)
  const lb = laborBreakdown(objects, alloyId)
  // True cost = materials + bench labor at the shop rate.
  const cost = est.metalCost + est.stoneCost + lb.laborCost
  return {
    cost,
    wholesale: cost * 1.6,
    keystone: cost * 2,
    retail: est.total,
  }
}
