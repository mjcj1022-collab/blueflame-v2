import type { SculptObject } from '../state/modeler'
import { sculptMetalVolume } from './sculpt'
import { alloyById } from '../catalog'

/**
 * Casting tree / pour plan. Turns a finished model into a caster's plan: how much
 * metal to actually pour for N copies on a sprue tree, accounting for the sprues
 * and button (the feed metal that never becomes jewelry) and the alloy's cast
 * shrinkage. "Grams finished" is not "grams to pour" — undershoot and the mould
 * starves; this closes that gap. Pure + deterministic.
 */

/** Cast shrinkage (linear %) by metal symbol — volume feed the sprue must supply. */
function shrinkPct(symbol: string): number {
  switch (symbol) {
    case 'Pt': return 2.2
    case 'Pd': return 1.8
    case 'Ag': return 1.6
    default: return 1.5   // gold family
  }
}

export interface CastingPlan {
  count: number
  pieceGrams: number     // one finished piece, cast
  sprueGrams: number     // sprue + gate feed per piece
  shrinkGrams: number    // extra to cover shrinkage across the tree
  buttonGrams: number    // the reservoir button at the base of the tree
  treeGrams: number      // metal in the parts + sprues (no button)
  pourGrams: number      // TOTAL metal to melt and pour
  alloyName: string
}

export function castingPlan(objects: SculptObject[], alloyId: string, count = 1): CastingPlan {
  const alloy = alloyById(alloyId)
  const n = Math.max(1, Math.round(count))
  const pieceGrams = (sculptMetalVolume(objects) / 1000) * alloy.density
  // Sprue feed scales with the piece — a chunky piece needs a fatter sprue.
  const sprueGrams = Math.max(0.3, pieceGrams * 0.18)
  const perPiece = pieceGrams + sprueGrams
  const treeGrams = perPiece * n
  const shrinkGrams = treeGrams * (shrinkPct(alloy.symbol) / 100)
  // Button: a reservoir at the base so the tree feeds under shrinkage — a base
  // plus a share of the tree, never below the alloy's own button minimum.
  const buttonGrams = Math.max(alloy.buttonMin, treeGrams * 0.15)
  const pourGrams = treeGrams + shrinkGrams + buttonGrams
  return { count: n, pieceGrams, sprueGrams, shrinkGrams, buttonGrams, treeGrams, pourGrams, alloyName: alloy.name }
}
