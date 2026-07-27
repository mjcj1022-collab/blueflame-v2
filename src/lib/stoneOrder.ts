import type { SculptObject } from '../state/modeler'
import { stoneById } from '../catalog'
import { mmForCarat } from './stoneSize'

/**
 * Stones-to-order list — the purchasing side of the stone schedule. Groups every
 * gem in the piece by type + shape + millimetre size (how stones are actually
 * bought), with the quantity, total carats and an estimated cost, so a maker can
 * hand a supplier an exact order instead of eyeballing it.
 */

export interface StoneOrderRow {
  stone: string
  shape: string
  mm: number
  caratEach: number
  qty: number
  totalCarat: number
  cost: number
}

const SHAPE_NAME: Record<string, string> = {
  rd: 'Round', ov: 'Oval', cu: 'Cushion', pr: 'Princess', em: 'Emerald', as: 'Asscher',
  ra: 'Radiant', pe: 'Pear', ma: 'Marquise', he: 'Heart', tr: 'Trillion', bg: 'Baguette',
  oe: 'Old European', ro: 'Rose cut', ca: 'Cabochon', br: 'Briolette',
}

export function stoneOrder(objects: SculptObject[]): { rows: StoneOrderRow[]; totalCost: number; totalStones: number } {
  const map = new Map<string, StoneOrderRow>()
  for (const o of objects) {
    if (o.kind !== 'gem') continue
    const stoneId = o.params?.stoneTypeId ?? 'dia'
    const shapeId = o.params?.shapeId ?? 'rd'
    const ct = o.params?.carat ?? 0
    const st = stoneById(stoneId)
    const mm = Math.round(mmForCarat(shapeId, stoneId, ct).width * 100) / 100
    const key = `${stoneId}:${shapeId}:${mm}`
    const each = st.rate * Math.pow(Math.max(ct, 0.001), st.exponent)
    const row = map.get(key) ?? { stone: st.name, shape: SHAPE_NAME[shapeId] ?? shapeId, mm, caratEach: ct, qty: 0, totalCarat: 0, cost: 0 }
    row.qty++; row.totalCarat += ct; row.cost += each
    map.set(key, row)
  }
  const rows = [...map.values()].sort((a, b) => b.cost - a.cost)
  return { rows, totalCost: rows.reduce((s, r) => s + r.cost, 0), totalStones: rows.reduce((s, r) => s + r.qty, 0) }
}

/** Plain-text order list for copy/paste to a supplier. */
export function stoneOrderText(objects: SculptObject[], brand = 'Blue Flame'): string {
  const o = stoneOrder(objects)
  const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))
  const lines = o.rows.map(r => `  ${pad(`${r.qty}×`, 4)}${pad(`${r.mm.toFixed(2)} mm ${r.shape} ${r.stone}`, 34)}${r.totalCarat.toFixed(2)} ct`)
  return [
    `${brand.toUpperCase()} — STONES TO ORDER`, '',
    ...lines, '',
    `  ${o.totalStones} stone${o.totalStones === 1 ? '' : 's'} total`,
  ].join('\n')
}
