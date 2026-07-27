import { ALLOYS } from '../catalog'
import { MARKET } from './market'
import { OZT } from './units'

/**
 * Weight and metal cost of a given metal volume in every alloy, so a maker can
 * see at a glance what the same piece costs cast in 14K vs. 18K vs. platinum vs.
 * silver. Uses the exact per-alloy formula the quote engine uses (cast grams ×
 * density, priced on fine troy ounces for precious metals or per gram for base),
 * so this table and the quote never disagree.
 */

export interface AlloyCostRow {
  id: string
  name: string
  grams: number
  cost: number
  precious: boolean
}

export function alloyCostTable(volumeMm3: number): AlloyCostRow[] {
  const vol = Math.max(0, volumeMm3)
  const rows = ALLOYS.map((a) => {
    const grams = (vol / 1000) * a.density
    const cost = a.precious
      ? ((grams * a.fine) / OZT) * (a.spot * MARKET.spotFactor) * (1 + a.premium)
      : grams * a.perGram * (1 + a.premium)
    return { id: a.id, name: a.name, grams, cost, precious: a.precious }
  })
  // cheapest first — the maker usually wants the lowest-cost option in view
  return rows.sort((x, y) => x.cost - y.cost)
}
