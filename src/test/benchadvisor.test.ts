import { describe, it, expect } from 'vitest'
import { benchFacts, benchFactSheet, localBenchAnswer, burForStoneMm } from '../lib/benchAdvisor'
import type { SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (carat: number): SculptObject => ({ id: 'g', kind: 'gem', name: 'Gem', position: [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat } })
const head = (prongs: number): SculptObject => ({ id: 'h', kind: 'head', name: 'Head', position: [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0, params: { prongs, stoneW: 6.5, height: 4 } })

describe('burForStoneMm', () => {
  it('recommends a bur ≈ the stone diameter, floored at 0.8 mm', () => {
    expect(burForStoneMm(1.5)).toBeCloseTo(1.5, 5)
    expect(burForStoneMm(0.3)).toBe(0.8)
  })
})

describe('benchFacts + fact sheet', () => {
  it('computes stones with a setting bur and a fact sheet mentioning the metal', () => {
    const f = benchFacts([shank(), gem(1)], '14ky')
    expect(f.stones.length).toBe(1)
    expect(f.stones[0].bur).toBeGreaterThan(0)
    expect(f.castGrams).toBeGreaterThan(0)
    const sheet = benchFactSheet(f)
    expect(sheet).toMatch(/setting bur/)
    expect(sheet).toMatch(/14K/i)
  })
})

describe('localBenchAnswer (deterministic grounding)', () => {
  it('answers a bur question with the calibrated size', () => {
    const f = benchFacts([shank(), gem(1)], '14ky')
    const a = localBenchAnswer('what bur for this stone?', f)
    expect(a).toMatch(/setting bur/)
    expect(a).toMatch(/mm/)
  })
  it('answers castability from the wall check', () => {
    const f = benchFacts([shank()], '14ky')
    const a = localBenchAnswer('will this cast?', f)
    expect(a.toLowerCase()).toMatch(/cast|wall|watertight|minimum/)
  })
  it('suggests more prongs for a 4-prong head on request', () => {
    const f = benchFacts([shank(), gem(2), head(4)], '14ky')
    const a = localBenchAnswer('are the prongs enough?', f)
    expect(a.toLowerCase()).toMatch(/prong/)
  })
  it('reports weight when asked', () => {
    const f = benchFacts([shank()], '14ky')
    expect(localBenchAnswer('how heavy is it?', f)).toMatch(/g\b/)
  })
})
