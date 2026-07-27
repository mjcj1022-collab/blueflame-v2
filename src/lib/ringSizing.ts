import type { SculptObject } from '../state/modeler'
import { alloyById } from '../catalog'
import { sculptMetalVolume } from './sculpt'
import { sizeToCircumference } from './sizing'
import { MARKET } from './market'
import { OZT } from './units'

/**
 * Ring sizing engine. Resizing a finished ring is the most common bench job, and
 * it isn't free: going up adds metal (and cost), going down means cutting,
 * removing metal and re-soldering. This computes the real metal added/removed by
 * regenerating the shank at the target finger size and re-weighing the piece, then
 * prices the metal delta and the bench time — so a maker quotes a sizing job from
 * the actual geometry, not a guess. Pure + deterministic.
 */

export const RING_SIZE_MIN = 3
export const RING_SIZE_MAX = 16

/** Metal cost for a given cast weight in an alloy — the quote-engine formula. */
function metalCostForGrams(alloyId: string, grams: number): number {
  const a = alloyById(alloyId)
  return a.precious
    ? ((grams * a.fine) / OZT) * (a.spot * MARKET.spotFactor) * (1 + a.premium)
    : grams * a.perGram * (1 + a.premium)
}

export interface SizingReport {
  fromSize: number
  toSize: number
  steps: number          // signed quarter-size steps (+ up, − down)
  beforeG: number
  afterG: number
  deltaG: number         // + metal added, − metal removed
  metalCost: number      // cost of the metal delta (added metal; removed is scrap-recoverable)
  laborMinutes: number
  laborCost: number
  total: number
  note?: string
}

/** The shank (a parametric ring band) on the bench, if any. */
export function findShank(objects: SculptObject[]): SculptObject | undefined {
  return objects.find(o => o.kind === 'shank' && typeof o.params?.ringSize === 'number')
}

/** Re-weigh the whole piece with the shank regenerated at `toSize`, and price the
 *  metal change + the sizing labor. Does not mutate anything. */
export function sizingReport(objects: SculptObject[], shankId: string, toSize: number, alloyId: string): SizingReport | null {
  const shank = objects.find(o => o.id === shankId && o.kind === 'shank')
  if (!shank || typeof shank.params?.ringSize !== 'number') return null
  const fromSize = shank.params.ringSize
  const to = Math.min(RING_SIZE_MAX, Math.max(RING_SIZE_MIN, toSize))

  const beforeG = weigh(objects, alloyId)
  const swapped = objects.map(o => o.id === shankId ? { ...o, params: { ...o.params, ringSize: to } } : o)
  const afterG = weigh(swapped, alloyId)
  const deltaG = afterG - beforeG

  const steps = (to - fromSize) / 0.25
  // Going up: pay for the added metal. Going down: metal is removed (scrap
  // recovered), so metal cost is ~0 but the labor is the same order.
  const metalCost = deltaG > 0 ? metalCostForGrams(alloyId, deltaG) : 0
  const laborMinutes = 20 + 8 * Math.abs(steps)
  const laborCost = (laborMinutes / 60) * (MARKET.laborRate > 0 ? MARKET.laborRate : 0)
  const total = metalCost + laborCost

  const gemsNearBand = objects.filter(o => o.kind === 'gem').length
  const note = gemsNearBand >= 5 && Math.abs(steps) > 4
    ? 'Stones set around the band — sizing more than ±1 size risks the seats; consider adding/removing a sizing section instead.'
    : undefined

  return { fromSize, toSize: to, steps, beforeG, afterG, deltaG, metalCost, laborMinutes, laborCost, total, note }
}

function weigh(objects: SculptObject[], alloyId: string): number {
  return (sculptMetalVolume(objects) / 1000) * alloyById(alloyId).density
}

/** Quarter-size options across the wearable range, for a picker. */
export function ringSizeOptions(): number[] {
  const out: number[] = []
  for (let s = RING_SIZE_MIN; s <= RING_SIZE_MAX; s += 0.25) out.push(Math.round(s * 100) / 100)
  return out
}

/** EU (mm circumference) label for a US size, for the picker. */
export const euForSize = (usSize: number): number => Math.round(sizeToCircumference(usSize) * 10) / 10
