import { describe, it, expect } from 'vitest'
import { alloyMix } from '../lib/alloyMix'
import { metalFromPattern, metalFromPatternTable, PATTERN_SG } from '../lib/waxWeight'
import { refineValue } from '../lib/refining'
import { toolList } from '../lib/toolList'
import { qcChecklist } from '../lib/qcChecklist'
import { alloyById } from '../catalog'
import type { SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (id: string, ct: number, stone = 'dia'): SculptObject => ({ id, kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: stone, carat: ct } })
const head = (): SculptObject => ({ id: 'h', kind: 'head', name: 'Head', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0, params: { prongs: 6, stoneW: 6.5, height: 4 } })

describe('alloy mixing', () => {
  it('splits the melt into fine + master at the alloy fineness', () => {
    const m = alloyMix('14ky', 100)
    expect(m.fineness).toBeCloseTo(alloyById('14ky').fine, 5)
    expect(m.meltGrams).toBeGreaterThanOrEqual(100)   // includes melt loss
    expect(m.fineGrams + m.masterGrams).toBeCloseTo(m.meltGrams, 4)
    expect(m.fineGrams / m.meltGrams).toBeCloseTo(m.fineness, 5)
    expect(m.fineMetal).toMatch(/gold/i)
  })
})

describe('wax → metal', () => {
  it('metal weight = pattern × density ÷ pattern SG, and resin is denser than wax', () => {
    const g = metalFromPattern(2, '14ky', PATTERN_SG.wax)
    expect(g).toBeCloseTo(2 * alloyById('14ky').density / PATTERN_SG.wax, 4)
    const wax = metalFromPattern(2, '14ky', PATTERN_SG.wax)
    const resin = metalFromPattern(2, '14ky', PATTERN_SG.resin)
    expect(resin).toBeLessThan(wax)   // denser pattern → less metal per gram of pattern
    expect(metalFromPatternTable(2).length).toBeGreaterThan(5)
  })
})

describe('refining value', () => {
  it('precious scrap values on recovered fine content, net of fee', () => {
    const r = refineValue('18ky', 10)
    expect(r.fineGrams).toBeCloseTo(10 * alloyById('18ky').fine, 4)
    expect(r.recoveredGrams).toBeLessThan(r.fineGrams)   // recovery < 100%
    expect(r.netValue).toBeLessThan(r.grossValue)        // fee taken
    expect(r.netValue).toBeGreaterThan(0)
  })
})

describe('tool & bur list', () => {
  it('lists a setting bur per stone size and prong tools for heads', () => {
    const t = toolList([shank(), gem('g', 1), head()])
    expect(t.some(x => /setting bur/i.test(x.tool))).toBe(true)
    expect(t.some(x => /prong/i.test(x.tool))).toBe(true)
    expect(t.some(x => /polish/i.test(x.tool))).toBe(true)
  })
})

describe('QC checklist', () => {
  it('is context-aware: stone count, prongs, hallmark', () => {
    const q = qcChecklist([shank(), gem('a', 1), gem('b', 1), head()], '18ky')
    expect(q.some(i => /2 stones/.test(i.check))).toBe(true)
    expect(q.some(i => /Prongs/i.test(i.check))).toBe(true)
    expect(q.some(i => /18K/.test(i.check))).toBe(true)
  })
})
