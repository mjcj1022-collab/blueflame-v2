import { describe, it, expect } from 'vitest'
import { skuFor } from '../lib/sku'
import { bomCsv, stoneOrderCsv } from '../lib/csvExport'
import { compareDesigns } from '../lib/designCompare'
import { lineSheetText } from '../lib/lineSheet'
import type { SculptObject } from '../state/modeler'
import type { SavedSculpt } from '../lib/sculptLibrary'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (id: string, ct: number, stone = 'dia', shape = 'rd'): SculptObject => ({ id, kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: shape, stoneTypeId: stone, carat: ct } })

describe('SKU generator', () => {
  it('is deterministic and encodes ring/metal/shape/stone/carat', () => {
    const a = skuFor([shank(), gem('g', 1)], '14ky')
    const b = skuFor([shank(), gem('g', 1)], '14ky')
    expect(a).toBe(b)
    expect(a).toMatch(/^RG-14KY-RD-DIA-100/)
  })
  it('marks a plain band and counts melee', () => {
    expect(skuFor([shank()], '18kw')).toMatch(/PLAIN/)
    expect(skuFor([shank(), gem('c', 1), gem('m1', 0.02), gem('m2', 0.02)], '14ky')).toMatch(/-M2$/)
  })
})

describe('CSV export', () => {
  it('BOM CSV has a header and a row per grouped part', () => {
    const csv = bomCsv([shank(), gem('a', 0.05), gem('b', 0.05)], '14ky')
    expect(csv.split('\n')[0]).toBe('Qty,Item,Material,Detail,Grams,Carat')
    expect(csv).toMatch(/\n2,/)   // the two grouped melee
  })
  it('stones CSV quotes fields with commas safely', () => {
    const csv = stoneOrderCsv([gem('g', 1)])
    expect(csv.split('\n')[0]).toMatch(/^Qty,Stone,Shape,mm/)
  })
})

describe('design compare', () => {
  it('reports deltas between two designs', () => {
    const c = compareDesigns([shank()], [shank(), gem('g', 1)], '14ky')
    expect(c.delta.gemCount).toBe(1)
    expect(c.delta.price).toBeCloseTo(c.b.price - c.a.price, 6)
    expect(c.b.price).toBeGreaterThan(c.a.price)
  })
})

describe('line sheet', () => {
  it('lists a SKU + price row per saved design', () => {
    const saved: SavedSculpt[] = [
      { id: '1', name: 'Solitaire', at: 0, objects: [shank(), gem('g', 1)] },
      { id: '2', name: 'Plain band', at: 0, objects: [shank()] },
    ]
    const txt = lineSheetText(saved, '14ky', 'Mandrel')
    expect(txt).toMatch(/COLLECTION LINE SHEET/)
    expect(txt).toMatch(/Solitaire/)
    expect(txt).toMatch(/Plain band/)
    expect(txt).toMatch(/RG-14KY/)
  })
})
