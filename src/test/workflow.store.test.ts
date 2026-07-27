import { describe, it, expect, beforeEach } from 'vitest'
import { useModeler, type SculptObject } from '../state/modeler'
import { symmetryScore } from '../lib/castCheck'

const s = () => useModeler.getState()
const part = (over: Partial<SculptObject>): Omit<SculptObject, 'id' | 'name'> => ({
  kind: 'box', size: 8, material: 'metal', color: 0xffffff,
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], ...over,
})

beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [] }))

describe('symmetrizeMesh', () => {
  it('makes a selected part symmetric and is undoable', () => {
    s().addObjects([part({ kind: 'box', size: 6, position: [3, 0, 0] })]) // off-centre
    const id = s().objects[0].id
    expect(s().symmetrizeMesh(id, 'x')).toBe(true)
    const o = s().objects[0]
    expect(o.kind).toBe('mesh')
    expect(symmetryScore(o.vertices!, 'x')).toBeGreaterThan(0.95)
    s().undo()
    expect(s().objects[0].kind).toBe('box')
  })
})

describe('addGallery', () => {
  it('adds a gallery ring beneath a stone', () => {
    s().addObjects([part({ kind: 'gem', material: 'gem', position: [0, 6, 0], params: { shapeId: 'rd', carat: 1 } })])
    const gem = s().objects[0]
    expect(s().addGallery(gem.id)).toBe(true)
    const g = s().objects.find(o => o.name === 'Gallery')!
    expect(g.kind).toBe('torus')
    expect(g.position[1]).toBeLessThan(gem.position[1]) // sits below the stone
  })
})

describe('subtractFromAll', () => {
  it('cuts every other metal part with the selected cutter', () => {
    // a central cutter overlapping two flanking boxes
    s().addObjects([
      part({ kind: 'box', size: 6, position: [-4, 0, 0] }),
      part({ kind: 'box', size: 6, position: [4, 0, 0] }),
      part({ kind: 'cylinder', size: 4, position: [0, 0, 0] }), // thin rod: notches each box, doesn't engulf
    ])
    const cutter = s().objects[2].id
    const n = s().subtractFromAll(cutter)
    expect(n).toBe(2)
    // the two targets became meshes; the cutter is untouched
    const targets = s().objects.filter(o => o.id !== cutter)
    expect(targets.every(o => o.kind === 'mesh')).toBe(true)
    expect(s().objects.find(o => o.id === cutter)!.kind).toBe('cylinder')
  })

  it('returns 0 when there is no other metal part', () => {
    s().addObjects([part({})])
    expect(s().subtractFromAll(s().objects[0].id)).toBe(0)
  })
})

describe('autoOrientForPrint', () => {
  it('is a no-op (returns -1) on an empty scene', () => {
    expect(s().autoOrientForPrint()).toBe(-1)
  })
  it('runs on a scene and either improves or reports already-optimal', () => {
    s().addObjects([part({ kind: 'cone', size: 8, position: [0, 0, 0] })])
    const r = s().autoOrientForPrint()
    // either it re-oriented (0..1 fraction) or it was already best (-1)
    expect(r === -1 || (r >= 0 && r <= 1)).toBe(true)
  })
})
