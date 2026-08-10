import type { SculptObject } from '../state/modeler'
import { alloyById, stoneById } from '../catalog'
import { sculptMetalVolume } from './sculpt'

/**
 * Bill of materials for a MODELER assembly (the spec-side BOM lives in bom.ts).
 * Lists every component the shop makes or buys, grouped and counted: metal parts
 * with cast weight in the chosen alloy, gems with type + carat, findings by name.
 * Identical parts collapse into a quantity, so "3× jump ring" is one line.
 */

export interface SculptBomRow {
  qty: number
  item: string
  material: string
  detail: string
  grams?: number
  carat?: number
}

export interface SculptBom {
  rows: SculptBomRow[]
  metalGrams: number
  metalParts: number
  gemCount: number
  carats: number
}

export function sculptBom(objects: SculptObject[], alloyId: string): SculptBom {
  const alloy = alloyById(alloyId)
  const map = new Map<string, SculptBomRow>()
  let metalGrams = 0, gemCount = 0, carats = 0, metalParts = 0

  for (const o of objects) {
    if (o.material === 'gem') {
      const st = stoneById(o.params?.stoneTypeId ?? 'dia')
      const ct = o.params?.carat ?? 0
      const key = `gem:${st.id}:${ct.toFixed(2)}`
      const row = map.get(key) ?? { qty: 0, item: o.name || st.name, material: st.name, detail: `${ct.toFixed(2)} ct`, carat: ct }
      row.qty++; map.set(key, row)
      gemCount++; carats += ct
    } else {
      const grams = (sculptMetalVolume([o]) / 1000) * alloy.density
      const key = `metal:${o.name}:${grams.toFixed(2)}`
      const row = map.get(key) ?? { qty: 0, item: o.name || 'Metal part', material: alloy.name, detail: `${grams.toFixed(2)} g`, grams }
      row.qty++; map.set(key, row)
      metalGrams += grams; metalParts++
    }
  }

  const rows = [...map.values()].sort((a, b) =>
    (a.grams ? 0 : 1) - (b.grams ? 0 : 1) || (b.grams ?? b.carat ?? 0) - (a.grams ?? a.carat ?? 0))

  return { rows, metalGrams, metalParts, gemCount, carats }
}

/** Plain-text BOM for copy/paste. */
export function sculptBomText(objects: SculptObject[], alloyId: string, brand = 'Mandrel'): string {
  const b = sculptBom(objects, alloyId)
  const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))
  const lines = b.rows.map(r => `  ${pad(`${r.qty}×`, 4)}${pad(r.item, 22)}${pad(r.material, 16)}${r.detail}`)
  return [
    `${brand.toUpperCase()} — BILL OF MATERIALS`, '',
    ...lines, '',
    `  Metal: ${b.metalParts} part${b.metalParts === 1 ? '' : 's'}, ${b.metalGrams.toFixed(2)} g cast`,
    b.gemCount ? `  Stones: ${b.gemCount}, ${b.carats.toFixed(2)} ct total` : '',
  ].filter(Boolean).join('\n')
}
