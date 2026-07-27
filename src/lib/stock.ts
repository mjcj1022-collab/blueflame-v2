import { alloyById } from '../catalog'
import { MARKET } from './market'
import { OZT } from './units'
import { castingPlan } from './casting'
import type { SculptObject } from '../state/modeler'

/**
 * Metal stock & scrap calculator. From the casting pour plan, tells a maker what
 * to actually buy: raw stock rounded up to a purchase increment, the metal that
 * ends up as sprue/button scrap (recoverable, but not free the first cast), and
 * the cost to lay in that stock at the shop's spot factor. Closes the loop between
 * "grams to pour" and "what do I order".
 */

function metalCostForGrams(alloyId: string, grams: number): number {
  const a = alloyById(alloyId)
  return a.precious
    ? ((grams * a.fine) / OZT) * (a.spot * MARKET.spotFactor) * (1 + a.premium)
    : grams * a.perGram * (1 + a.premium)
}

export interface StockPlan {
  count: number
  finishedGrams: number   // metal that becomes jewelry (all copies)
  pourGrams: number       // total to melt
  scrapGrams: number      // sprue + button + shrink feed — recoverable
  recoveryPct: number     // finished ÷ pour
  orderGrams: number      // stock to buy, rounded up to the increment
  stockCost: number       // cost of that stock at spot factor
  alloyName: string
}

/** `increment` = purchase step in grams (default 1 g); real casters order round amounts. */
export function stockPlan(objects: SculptObject[], alloyId: string, count = 1, increment = 1): StockPlan {
  const plan = castingPlan(objects, alloyId, count)
  const finishedGrams = plan.pieceGrams * plan.count
  const pourGrams = plan.pourGrams
  const scrapGrams = Math.max(0, pourGrams - finishedGrams)
  const recoveryPct = pourGrams > 0 ? (finishedGrams / pourGrams) * 100 : 0
  const inc = increment > 0 ? increment : 1
  const orderGrams = Math.ceil(pourGrams / inc) * inc
  return {
    count: plan.count, finishedGrams, pourGrams, scrapGrams, recoveryPct,
    orderGrams, stockCost: metalCostForGrams(alloyId, orderGrams), alloyName: plan.alloyName,
  }
}
