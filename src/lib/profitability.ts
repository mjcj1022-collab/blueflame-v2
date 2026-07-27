import type { SculptObject } from '../state/modeler'
import { sculptEstimate } from './sculpt'
import { laborBreakdown } from './laborTime'

/**
 * Profitability view. The estimate shows a retail total; this splits it into what
 * the piece COSTS the shop (metal, stones, and labor at bench time) versus what it
 * SELLS for, so a maker sees the actual margin and profit on a job — the number
 * that keeps the lights on — not just the sticker price.
 */

export interface Profitability {
  metal: number
  stones: number
  laborCost: number     // bench time × rate
  cost: number          // total cost to the shop
  retail: number        // what the estimate charges
  profit: number
  marginPct: number     // profit ÷ retail
  laborMinutes: number
}

export function profitability(objects: SculptObject[], alloyId: string): Profitability {
  const est = sculptEstimate(objects, alloyId)
  const lb = laborBreakdown(objects, alloyId)
  const metal = est.metalCost
  const stones = est.stoneCost
  const laborCost = lb.laborCost
  const cost = metal + stones + laborCost
  const retail = est.total
  const profit = retail - cost
  const marginPct = retail > 0 ? (profit / retail) * 100 : 0
  return { metal, stones, laborCost, cost, retail, profit, marginPct, laborMinutes: lb.totalMinutes }
}
