import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { overhangReport, symmetryScore } from '../lib/castCheck'
import { alloyCostTable } from '../lib/alloyCost'
import { domeSoup } from '../lib/dome'
import type { SculptObject } from '../state/modeler'

const soupOf = (geo: THREE.BufferGeometry): number[] => {
  const g = geo.getIndex() ? geo.toNonIndexed() : geo
  return Array.from(g.getAttribute('position').array as Float32Array)
}
const boxObj = (over: Partial<SculptObject> = {}): SculptObject => ({
  id: 'b', kind: 'box', name: 'box', position: [0, 0, 0], rotation: [0, 0, 0],
  scale: [1, 1, 1], size: 6, material: 'metal', color: 0, ...over,
})

describe('overhangReport', () => {
  it('flags the downward face of a box as needing some support', () => {
    // A box: one of six faces (the bottom) points straight down → ~1/6 area.
    const r = overhangReport([boxObj()])
    expect(r.fraction).toBeGreaterThan(0.1)
    expect(r.fraction).toBeLessThan(0.25)
    expect(r.level).toBe('some')
  })
  it('ignores gems (you do not print the stones)', () => {
    const r = overhangReport([boxObj({ material: 'gem', kind: 'gem', params: { shapeId: 'rd', carat: 1 } })])
    expect(r.fraction).toBe(0)
    expect(r.level).toBe('good')
  })
})

describe('symmetryScore', () => {
  it('scores a symmetric box near 1 across any axis', () => {
    const soup = soupOf(new THREE.BoxGeometry(6, 6, 6))
    expect(symmetryScore(soup, 'x')).toBeGreaterThan(0.95)
    expect(symmetryScore(soup, 'y')).toBeGreaterThan(0.95)
  })
  it('scores a sheared (non-mirror-symmetric) shape lower', () => {
    // Shear X by Y: turns the box into a parallelepiped — point-symmetric but
    // NOT mirror-symmetric across the X plane, so the score must drop.
    const soup = soupOf(new THREE.BoxGeometry(6, 6, 6, 3, 3, 3))
    for (let i = 0; i < soup.length; i += 3) soup[i] += soup[i + 1] * 0.9
    expect(symmetryScore(soup, 'x')).toBeLessThan(0.9)
  })
})

describe('alloyCostTable', () => {
  it('returns a cost + weight per alloy, cheapest first', () => {
    const rows = alloyCostTable(1000) // 1 cm³
    expect(rows.length).toBeGreaterThan(3)
    expect(rows[0].cost).toBeLessThanOrEqual(rows[rows.length - 1].cost)
    // grams = volume(cm³) × density; every row positive
    expect(rows.every(r => r.grams > 0 && r.cost >= 0)).toBe(true)
  })
  it('zero volume yields zero cost', () => {
    expect(alloyCostTable(0).every(r => r.cost === 0 && r.grams === 0)).toBe(true)
  })
})

describe('domeSoup', () => {
  it('raises the top centre most and leaves the base untouched, staying welded', () => {
    // Segmented box → interior top vertices exist for the dome to lift.
    const soup = soupOf(new THREE.BoxGeometry(6, 6, 6, 4, 4, 4)) // spans y -3..3
    const out = domeSoup(soup, 2)
    expect(out.length).toBe(soup.length)
    let maxLift = 0, baseMoved = 0
    // track how much each unique top-centre position moved, to prove welding
    const liftAt = new Map<string, number>()
    for (let i = 0; i < soup.length; i += 3) {
      const lift = out[i + 1] - soup[i + 1]
      if (lift > maxLift) maxLift = lift
      if (soup[i + 1] <= 0) baseMoved += Math.abs(lift)
      const k = `${soup[i].toFixed(3)},${soup[i + 1].toFixed(3)},${soup[i + 2].toFixed(3)}`
      const prev = liftAt.get(k)
      if (prev !== undefined) expect(lift).toBeCloseTo(prev, 6) // same position → same lift
      liftAt.set(k, lift)
    }
    expect(maxLift).toBeGreaterThan(0.5) // centre of the top rose
    expect(baseMoved).toBeCloseTo(0, 6) // bottom half unchanged
  })
})
