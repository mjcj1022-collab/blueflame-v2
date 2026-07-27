import { describe, it, expect } from 'vitest'
import { chainEstimate } from '../lib/chainCalc'
import { printEstimate } from '../lib/printEstimate'
import { profitability } from '../lib/profitability'
import { stoneOrder, stoneOrderText } from '../lib/stoneOrder'
import type { SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (id: string, ct: number, stone = 'dia', shape = 'rd'): SculptObject => ({ id, kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: shape, stoneTypeId: stone, carat: ct } })

describe('chain calculator', () => {
  it('weight scales with length and a chunkier style packs more metal', () => {
    const a = chainEstimate('cable', 18, 1.2, '14ky')
    const b = chainEstimate('cable', 36, 1.2, '14ky')
    expect(b.grams).toBeCloseTo(a.grams * 2, 4)
    const cuban = chainEstimate('cuban', 18, 1.2, '14ky')
    expect(cuban.grams).toBeGreaterThan(a.grams)     // cuban packs denser
    expect(a.clasp).toBeTruthy()
  })
  it('weight scales with the square of the gauge', () => {
    const thin = chainEstimate('cable', 18, 1, '14ky').grams
    const thick = chainEstimate('cable', 18, 2, '14ky').grams
    expect(thick / thin).toBeCloseTo(4, 1)
  })
})

describe('print estimate', () => {
  it('reports resin, supports, layers and cost', () => {
    const pe = printEstimate([shank()])
    expect(pe.resinMl).toBeGreaterThan(0)
    expect(pe.supportMl).toBeGreaterThan(0)
    expect(pe.layers).toBeGreaterThan(1)
    expect(pe.minutes).toBeGreaterThan(0)
    expect(pe.materialCost).toBeGreaterThan(0)
  })
})

describe('profitability', () => {
  it('retail exceeds cost and margin is a sane percentage', () => {
    const p = profitability([shank(), gem('g', 1)], '14ky')
    expect(p.retail).toBeGreaterThan(p.cost)
    expect(p.profit).toBeCloseTo(p.retail - p.cost, 6)
    expect(p.marginPct).toBeGreaterThan(0)
    expect(p.marginPct).toBeLessThan(100)
  })
})

describe('stones to order', () => {
  it('groups by type/shape/mm with qty, carats and cost', () => {
    const o = stoneOrder([gem('a', 0.05), gem('b', 0.05), gem('c', 1, 'sap', 'ov')])
    expect(o.totalStones).toBe(3)
    const melee = o.rows.find(r => r.qty === 2)!
    expect(melee.totalCarat).toBeCloseTo(0.10, 5)
    expect(o.rows.some(r => r.stone === 'Sapphire')).toBe(true)
    expect(stoneOrderText([gem('a', 0.05)])).toMatch(/STONES TO ORDER/)
  })
})
