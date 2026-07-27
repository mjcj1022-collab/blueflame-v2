import { alloyById } from '../catalog'
import { NECKLACE_STYLES, type NecklaceStyle } from './necklaceChain'

/**
 * Chain weight calculator. A maker quoting a chain needs its weight before it
 * exists — driven by the wire gauge, the length, and how much wire each style
 * packs per inch (a Cuban link swallows far more metal than a fine cable). This
 * estimates grams and cost from those three, plus a sensible clasp, so a chain
 * can be priced from a spec sheet. Estimate, clearly labelled as one.
 */

/** Wire packed per mm of finished chain, by style — the density of the pattern. */
const PACK: Record<NecklaceStyle, number> = {
  cable: 2.2, rolo: 2.4, curb: 2.6, cuban: 3.4, figaro: 2.2, rope: 3.6,
  box: 2.8, snake: 3.2, herringbone: 3.6, mariner: 2.5, bead: 2.0,
}

const MM_PER_INCH = 25.4

export interface ChainEstimate {
  style: NecklaceStyle
  lengthIn: number
  gauge: number
  gramsPerInch: number
  grams: number
  clasp: string
  alloyName: string
}

/** Suggested clasp for a chain of this weight/style. */
function suggestClasp(style: NecklaceStyle, grams: number): string {
  if (style === 'cuban' || style === 'herringbone' || grams > 12) return 'Box clasp with safety'
  if (grams > 5) return 'Lobster clasp'
  return 'Spring-ring clasp'
}

export function chainEstimate(style: NecklaceStyle, lengthIn: number, gauge: number, alloyId: string): ChainEstimate {
  const alloy = alloyById(alloyId)
  const pack = PACK[style] ?? 2.4
  const wireAreaMm2 = Math.PI * (gauge / 2) ** 2          // cross-section of the wire
  const massPerMm = (wireAreaMm2 * pack) * (alloy.density / 1000)  // g per mm of chain
  const gramsPerInch = massPerMm * MM_PER_INCH
  const grams = gramsPerInch * lengthIn
  return { style, lengthIn, gauge, gramsPerInch, grams, clasp: suggestClasp(style, grams), alloyName: alloy.name }
}

export const CHAIN_STYLE_OPTIONS = NECKLACE_STYLES
