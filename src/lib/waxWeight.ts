import { ALLOYS, alloyById } from '../catalog'

/**
 * Wax/resin → metal weight converter. A maker weighs the wax or resin model on a
 * scale and needs the cast metal weight before pouring. Metal weight = wax weight
 * × (metal density ÷ pattern density). Injection wax ≈ 0.9 g/cm³, castable resin
 * ≈ 1.15. Works for any alloy so the same pattern can be priced across metals.
 */

export const PATTERN_SG = { wax: 0.9, resin: 1.15 }

/** Cast metal weight for a pattern of `patternGrams` in the given alloy. */
export function metalFromPattern(patternGrams: number, alloyId: string, patternSg = PATTERN_SG.wax): number {
  const a = alloyById(alloyId)
  const sg = patternSg > 0 ? patternSg : PATTERN_SG.wax
  return Math.max(0, patternGrams) * (a.density / sg)
}

export interface WaxRow { id: string; name: string; grams: number }

/** The same pattern cast in every alloy — cheapest metal first isn't meaningful
 *  here, so keep catalog order. */
export function metalFromPatternTable(patternGrams: number, patternSg = PATTERN_SG.wax): WaxRow[] {
  return ALLOYS.map(a => ({ id: a.id, name: a.name, grams: metalFromPattern(patternGrams, a.id, patternSg) }))
}
