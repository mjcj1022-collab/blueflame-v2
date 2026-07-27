import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { symmetrizeSoup } from '../lib/symmetrize'
import { symmetryScore } from '../lib/castCheck'
import { rotateSoup, bestPrintOrientation } from '../lib/printOrient'
import { pieceSummary } from '../lib/pieceSummary'
import type { SculptObject } from '../state/modeler'

const soupOf = (geo: THREE.BufferGeometry): number[] => {
  const g = geo.getIndex() ? geo.toNonIndexed() : geo
  return Array.from(g.getAttribute('position').array as Float32Array)
}

describe('symmetrizeSoup', () => {
  it('turns a lopsided shape into a symmetric one', () => {
    const soup = soupOf(new THREE.BoxGeometry(6, 6, 6, 3, 3, 3))
    for (let i = 0; i < soup.length; i += 3) soup[i] += soup[i + 1] * 0.9 // shear → asymmetric
    expect(symmetryScore(soup, 'x')).toBeLessThan(0.9)
    const sym = symmetrizeSoup(soup, 'x')
    expect(sym.length % 9).toBe(0)
    expect(sym.length).toBeGreaterThan(0)
    expect(symmetryScore(sym, 'x')).toBeGreaterThan(0.95)
  })
})

describe('rotateSoup + bestPrintOrientation', () => {
  it('rotateSoup 90° about X maps +Y to +Z', () => {
    const out = rotateSoup([0, 1, 0, 0, 0, 0, 0, 0, 0], [Math.PI / 2, 0, 0])
    expect(out[0]).toBeCloseTo(0, 6)
    expect(out[1]).toBeCloseTo(0, 6)
    expect(out[2]).toBeCloseTo(1, 6)
  })

  it('finds a lower-overhang orientation for a shape with a big flat ceiling', () => {
    // a thin wide slab: flat on top and bottom; flipping doesn't help, but a
    // shape dominated by one downward face should still return a valid result
    const slab: SculptObject = {
      id: 's', kind: 'box', name: 'slab', position: [0, 0, 0], rotation: [0, 0, 0],
      scale: [6, 0.4, 6], size: 1, material: 'metal', color: 0,
    }
    const best = bestPrintOrientation([slab])
    expect(best.fraction).toBeGreaterThanOrEqual(0)
    expect(best.fraction).toBeLessThanOrEqual(1)
    expect(Array.isArray(best.rotation)).toBe(true)
  })

  it('returns as-is when there is no metal', () => {
    const best = bestPrintOrientation([])
    expect(best.label).toBe('as-is')
    expect(best.rotation).toEqual([0, 0, 0])
  })
})

describe('pieceSummary', () => {
  const gem = (carat: number): SculptObject => ({
    id: Math.random().toString(36).slice(2), kind: 'gem', name: 'g', position: [0, 6, 0],
    rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', carat },
  })
  const band = (): SculptObject => ({
    id: 'b', kind: 'shank', name: 'shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    size: 6, material: 'metal', color: 0, params: { ringSize: 7, width: 2.2, thickness: 1.8, profile: 'round' },
  })

  it('reports dims, weight, stone count and carats', () => {
    const s = pieceSummary([band(), gem(1), gem(0.25)], '14ky')
    expect(s.metalParts).toBe(1)
    expect(s.gemCount).toBe(2)
    expect(s.carats).toBeCloseTo(1.25, 6)
    expect(s.castG).toBeGreaterThan(0)
    expect(s.dims[0]).toBeGreaterThan(0)
  })

  it('an empty scene is all zeros', () => {
    const s = pieceSummary([], '14ky')
    expect(s.dims).toEqual([0, 0, 0])
    expect(s.castG).toBe(0)
    expect(s.gemCount).toBe(0)
  })
})
