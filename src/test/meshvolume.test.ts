import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { isClosedManifold, meshVolume, metalVolumeReport, sculptMetalVolume, bakedGeometry } from '../lib/sculpt'
import type { SculptObject } from '../state/modeler'

const obj = (over: Partial<SculptObject> & { kind: SculptObject['kind'] }): SculptObject => ({
  id: 'x', name: 'o', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  size: 6, material: 'metal', color: 0xffffff, ...over,
})

describe('isClosedManifold', () => {
  it('a box is a closed solid', () => {
    expect(isClosedManifold(bakedGeometry(obj({ kind: 'box', size: 8 })))).toBe(true)
  })
  it('a single open triangle is not closed', () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 8, 0, 0, 0, 8, 0]), 3))
    expect(isClosedManifold(g)).toBe(false)
  })
  it('a flat two-triangle sheet (a quad with a boundary) is not closed', () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0, 0, 8, 0, 0, 8, 8, 0,   // t1
      0, 0, 0, 8, 8, 0, 0, 8, 0,   // t2
    ]), 3))
    expect(isClosedManifold(g)).toBe(false)   // perimeter edges are used once
  })
})

describe('metal volume — overlap is not double-counted', () => {
  it('two fully-overlapping boxes count as one, not two', () => {
    const a = obj({ id: 'a', kind: 'box', size: 8, position: [0, 0, 0] })
    const b = obj({ id: 'b', kind: 'box', size: 8, position: [0, 0, 0] })   // identical, fully coincident
    const single = sculptMetalVolume([a])
    const both = sculptMetalVolume([a, b])
    expect(both).toBeCloseTo(single, 0)              // union ≈ one box
    expect(both).toBeLessThan(single * 1.6)          // definitely not ~2×
    const rep = metalVolumeReport([a, b])
    expect(rep.method).toBe('union')
    expect(rep.overlap).toBe(true)
  })
  it('two separated boxes are both counted', () => {
    const a = obj({ id: 'a', kind: 'box', size: 8, position: [0, 0, 0] })
    const b = obj({ id: 'b', kind: 'box', size: 8, position: [40, 0, 0] })  // far apart, no overlap
    const single = sculptMetalVolume([a])
    const both = sculptMetalVolume([a, b])
    expect(both).toBeCloseTo(single * 2, 0)
    const rep = metalVolumeReport([a, b])
    expect(rep.overlap).toBe(false)
  })
})

describe('metal volume — open meshes are flagged, not silently trusted', () => {
  it('reports an open imported mesh as approximate', () => {
    // a single open triangle "mesh" part
    const soup = [0, 0, 0, 10, 0, 0, 0, 10, 0]
    const mesh = obj({ id: 'm', kind: 'mesh', vertices: soup })
    const rep = metalVolumeReport([mesh])
    expect(rep.closed).toBe(false)
    expect(rep.note).toMatch(/approximate/i)
  })
  it('a clean single closed part reports exact with no warning', () => {
    const rep = metalVolumeReport([obj({ kind: 'box', size: 8 })])
    expect(rep.closed).toBe(true)
    expect(rep.method).toBe('exact')
    expect(rep.note).toBeUndefined()
  })
})

describe('regression — gems still excluded, single part unchanged', () => {
  it('adding a gem does not change metal volume', () => {
    const shank = obj({ kind: 'shank', material: 'metal', params: { ringSize: 7 } })
    const gem = obj({ id: 'g', kind: 'gem', material: 'gem', position: [0, 6, 0], params: { shapeId: 'rd', carat: 1.5 } })
    expect(sculptMetalVolume([shank, gem])).toBeCloseTo(sculptMetalVolume([shank]), 3)
  })
  it('meshVolume of a box matches its edge cubed', () => {
    expect(meshVolume(bakedGeometry(obj({ kind: 'box', size: 8 })))).toBeCloseTo(512, 0)
  })
})
