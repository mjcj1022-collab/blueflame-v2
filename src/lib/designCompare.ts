import type { SculptObject } from '../state/modeler'
import { sculptEstimate } from './sculpt'

/**
 * Design compare. Custom work spins off variants — with pavé and without, this
 * stone versus that, one metal or another — and a maker needs to weigh them
 * against each other. This reduces two designs to the numbers that decide it:
 * parts, metal weight, stones, and price, with the deltas called out.
 */

export interface DesignStat {
  parts: number
  metalGrams: number
  gemCount: number
  carats: number
  price: number
}

export function statOf(objects: SculptObject[], alloyId: string): DesignStat {
  const est = sculptEstimate(objects, alloyId)
  return {
    parts: objects.length,
    metalGrams: est.castG,
    gemCount: est.gemCount,
    carats: est.carats,
    price: est.total,
  }
}

export interface Comparison {
  a: DesignStat
  b: DesignStat
  delta: { parts: number; metalGrams: number; gemCount: number; carats: number; price: number }
}

export function compareDesigns(aObjects: SculptObject[], bObjects: SculptObject[], alloyId: string): Comparison {
  const a = statOf(aObjects, alloyId)
  const b = statOf(bObjects, alloyId)
  return {
    a, b,
    delta: {
      parts: b.parts - a.parts,
      metalGrams: b.metalGrams - a.metalGrams,
      gemCount: b.gemCount - a.gemCount,
      carats: b.carats - a.carats,
      price: b.price - a.price,
    },
  }
}
