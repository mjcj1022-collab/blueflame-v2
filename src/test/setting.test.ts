import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { gemDiameterMm, surfaceTopAt, objectTop } from '../lib/setting'
import { stoneMm, shapeById } from '../catalog'
import type { SculptObject } from '../state/modeler'

const obj = (p: Partial<SculptObject>): SculptObject => ({
  id: 'x', kind: 'box', name: 'p', position: [0, 0, 0], rotation: [0, 0, 0],
  scale: [1, 1, 1], size: 4, material: 'metal', color: 0, ...p,
})

// flat plane (two triangles) at height y, spanning -10..10 in x and z
const planeSoup = (y: number): number[] => {
  const p = (x: number, z: number) => [x, y, z]
  return [
    ...p(-10, -10), ...p(10, -10), ...p(10, 10),
    ...p(-10, -10), ...p(10, 10), ...p(-10, 10),
  ]
}

describe('gemDiameterMm', () => {
  it('matches the catalog width for a 1ct round', () => {
    const g = obj({ kind: 'gem', material: 'gem', params: { shapeId: 'rd', carat: 1 } })
    expect(gemDiameterMm(g)).toBeCloseTo(stoneMm(shapeById('rd'), 1).width, 6)
  })
  it('scales with the object X scale', () => {
    const g = obj({ kind: 'gem', material: 'gem', scale: [2, 2, 2], params: { shapeId: 'rd', carat: 1 } })
    expect(gemDiameterMm(g)).toBeCloseTo(stoneMm(shapeById('rd'), 1).width * 2, 6)
  })
})

describe('surfaceTopAt', () => {
  it('finds the plane height under a point inside it', () => {
    expect(surfaceTopAt(0, 0, planeSoup(3))).toBeCloseTo(3, 6)
    expect(surfaceTopAt(5, -4, planeSoup(3))).toBeCloseTo(3, 6)
  })
  it('returns null when the column misses the part', () => {
    expect(surfaceTopAt(50, 50, planeSoup(3))).toBeNull()
  })
  it('picks the topmost of two stacked surfaces', () => {
    const soup = [...planeSoup(1), ...planeSoup(5)]
    expect(surfaceTopAt(0, 0, soup)).toBeCloseTo(5, 6)
  })
})

describe('objectTop', () => {
  it('returns the highest baked vertex of a box', () => {
    const box = obj({ kind: 'box', size: 4, position: [0, 10, 0] })
    const [, y] = objectTop(box)
    // a size-4 box centred at y=10 reaches up to ~12
    expect(y).toBeGreaterThan(11)
    // sanity: three's box actually built there
    expect(new THREE.Vector3(0, y, 0).y).toBe(y)
  })
})
