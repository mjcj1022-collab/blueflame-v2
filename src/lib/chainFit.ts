/**
 * Chain length & drape advisor. A maker sizing a necklace or bracelet needs the
 * trade's standard lengths, where a given length actually sits on the body, the
 * right clasp for the chain's weight, and — for a layered look — the gap between
 * stacked pieces so they don't tangle. This turns a length in inches into that
 * advice. Bracelet sizing works from the wrist plus a fit allowance.
 */

export interface NecklaceLength {
  inches: number
  name: string
  sits: string      // where it falls on an average adult
}

/** Standard necklace lengths, the names a jeweler and a customer both use. */
export const NECKLACE_LENGTHS: NecklaceLength[] = [
  { inches: 14, name: 'Collar', sits: 'Tight around the base of the neck' },
  { inches: 16, name: 'Choker', sits: 'At the base of the throat' },
  { inches: 18, name: 'Princess', sits: 'On the collarbone — the default for pendants' },
  { inches: 20, name: 'Matinee', sits: 'Just below the collarbone' },
  { inches: 22, name: 'Matinee (long)', sits: 'At the top of the bust' },
  { inches: 24, name: 'Opera', sits: 'On the breastbone' },
  { inches: 30, name: 'Opera (long)', sits: 'Below the bust' },
  { inches: 36, name: 'Rope', sits: 'At the waist — can be doubled' },
]

/** Nearest standard length name + where a given length sits. */
export function pendantSit(lengthIn: number): NecklaceLength {
  return NECKLACE_LENGTHS.reduce((best, l) =>
    Math.abs(l.inches - lengthIn) < Math.abs(best.inches - lengthIn) ? l : best, NECKLACE_LENGTHS[0])
}

export type BraceletFitKind = 'snug' | 'comfort' | 'loose'

/** Fit allowance (inches) added to the wrist circumference for the desired fit. */
const FIT_ALLOWANCE: Record<BraceletFitKind, number> = { snug: 0.25, comfort: 0.5, loose: 0.85 }

export interface BraceletFit {
  wristIn: number
  kind: BraceletFitKind
  allowanceIn: number
  lengthIn: number
}

/** Finished bracelet length from the wrist measurement and the desired fit. */
export function braceletFit(wristIn: number, kind: BraceletFitKind = 'comfort'): BraceletFit {
  const allowance = FIT_ALLOWANCE[kind]
  return { wristIn, kind, allowanceIn: allowance, lengthIn: Math.round((wristIn + allowance) * 4) / 4 }
}

/**
 * Suggested lengths for a stack of layered necklaces so each shows above the
 * next. Starts at `baseIn` and steps by ~2 inches, the gap that reads as
 * deliberate layering rather than tangle.
 */
export function layeringLengths(baseIn: number, count: number): number[] {
  const out: number[] = []
  for (let i = 0; i < Math.max(0, count); i++) out.push(baseIn + i * 2)
  return out
}

/** Clasp suited to a chain of this weight and use. Heavier chains need a positive,
 *  self-locking clasp; light ones can take a spring ring. */
export function suggestClaspFor(grams: number, bracelet = false): string {
  if (grams > 15) return 'Box clasp with figure-8 safety'
  if (grams > 8) return bracelet ? 'Box clasp with safety catch' : 'Lobster clasp (large)'
  if (grams > 4) return 'Lobster clasp'
  return 'Spring-ring clasp'
}

export interface ChainFitReport {
  lengthIn: number
  nearest: NecklaceLength
  clasp: string
  exactStandard: boolean
}

/** Advice for a necklace of a given length and weight. */
export function chainFitReport(lengthIn: number, grams: number): ChainFitReport {
  const nearest = pendantSit(lengthIn)
  return {
    lengthIn,
    nearest,
    clasp: suggestClaspFor(grams, false),
    exactStandard: NECKLACE_LENGTHS.some(l => l.inches === lengthIn),
  }
}
