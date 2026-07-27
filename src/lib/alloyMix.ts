import { alloyById } from '../catalog'

/**
 * Alloy mixing calculator. A shop that alloys its own metal needs to know, for a
 * given pour weight, how much FINE metal (24K gold, fine silver, fine platinum)
 * to combine with master alloy to hit the target karat/fineness. From the alloy's
 * fine fraction and a melt-loss buffer so the crucible yields the pour weight.
 */

export interface AlloyMix {
  alloyName: string
  fineness: number       // fraction, e.g. 0.585 for 14K
  meltGrams: number      // charge to melt (pour + loss)
  fineGrams: number      // fine metal to add
  masterGrams: number    // master alloy to add
  fineMetal: string      // what the fine part is
}

function fineMetalName(symbol: string): string {
  switch (symbol) {
    case 'Au': return '24K fine gold'
    case 'Ag': return 'fine silver (.999)'
    case 'Pt': return 'fine platinum'
    case 'Pd': return 'fine palladium'
    default: return 'fine metal'
  }
}

/** Charge to melt for a target pour weight, split into fine + master alloy. */
export function alloyMix(alloyId: string, pourGrams: number): AlloyMix {
  const a = alloyById(alloyId)
  const pour = Math.max(0, pourGrams)
  const meltGrams = pour * (1 + (a.meltLoss || 0))   // add oxidation/fines loss so the yield hits pour
  const fineGrams = meltGrams * a.fine
  const masterGrams = meltGrams - fineGrams
  return { alloyName: a.name, fineness: a.fine, meltGrams, fineGrams, masterGrams, fineMetal: fineMetalName(a.symbol) }
}
