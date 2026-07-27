import { alloyById } from '../catalog'
import { MARKET } from './market'
import { OZT } from './units'

/**
 * Scrap refining value. Sprues, buttons, filings and old pieces carry real metal
 * value, but a refiner returns only a fraction (recovery) and takes a fee. This
 * tells a maker what a scrap lot is actually worth back — so it's booked as an
 * asset, not swept off the bench. Precious metals value on fine content; base
 * metals per gram.
 */

export interface RefineValue {
  scrapGrams: number
  fineGrams: number       // fine precious content in the scrap
  recoveredGrams: number  // fine metal the refiner returns
  grossValue: number      // at market
  fee: number
  netValue: number
  alloyName: string
  precious: boolean
}

/** `recovery` = fraction of fine content returned (default 0.98); `feePct` refiner fee. */
export function refineValue(alloyId: string, scrapGrams: number, recovery = 0.98, feePct = 0.05): RefineValue {
  const a = alloyById(alloyId)
  const grams = Math.max(0, scrapGrams)
  const rec = Math.min(1, Math.max(0, recovery))
  const fee = Math.min(1, Math.max(0, feePct))
  if (a.precious) {
    const fineGrams = grams * a.fine
    const recoveredGrams = fineGrams * rec
    const grossValue = (recoveredGrams / OZT) * (a.spot * MARKET.spotFactor)
    const feeAmt = grossValue * fee
    return { scrapGrams: grams, fineGrams, recoveredGrams, grossValue, fee: feeAmt, netValue: grossValue - feeAmt, alloyName: a.name, precious: true }
  }
  const grossValue = grams * a.perGram * rec
  const feeAmt = grossValue * fee
  return { scrapGrams: grams, fineGrams: 0, recoveredGrams: grams * rec, grossValue, fee: feeAmt, netValue: grossValue - feeAmt, alloyName: a.name, precious: false }
}
