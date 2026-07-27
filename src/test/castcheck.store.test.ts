import { describe, it, expect, beforeEach } from 'vitest'
import { useModeler, type SculptObject } from '../state/modeler'

const s = () => useModeler.getState()
const part = (over: Partial<SculptObject>): Omit<SculptObject, 'id' | 'name'> => ({
  kind: 'box', size: 8, material: 'metal', color: 0xffffff,
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], ...over,
})

beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [] }))

describe('domeTop', () => {
  it('converts a part to a domed mesh', () => {
    s().addObjects([part({ kind: 'box', size: 8 })])
    const id = s().objects[0].id
    expect(s().domeTop(id, 1.5)).toBe(true)
    const o = s().objects[0]
    expect(o.kind).toBe('mesh')
    expect(o.vertices!.length % 9).toBe(0)
  })
  it('is a no-op at zero height', () => {
    s().addObjects([part({})])
    expect(s().domeTop(s().objects[0].id, 0)).toBe(false)
  })
})

describe('addSizingBeads', () => {
  it('adds two beads on the inner bottom, symmetric across X', () => {
    s().addObjects([part({ kind: 'shank', size: 6, params: { ringSize: 7, width: 2.2, thickness: 1.8, profile: 'round' } })])
    const id = s().objects[0].id
    expect(s().addSizingBeads(id)).toBe(true)
    const beads = s().objects.filter(o => o.name.startsWith('Sizing bead'))
    expect(beads).toHaveLength(2)
    expect(beads[0].kind).toBe('sphere')
    // mirrored across X about the band centre (their midpoint ≈ the centroid ≈ 0)
    expect(beads[0].position[0] + beads[1].position[0]).toBeCloseTo(0, 2)
    expect(beads[0].position[0]).toBeLessThan(0)
    expect(beads[1].position[0]).toBeGreaterThan(0)
    // both near the bottom (below centre)
    expect(beads[0].position[1]).toBeLessThan(0)
  })
  it('is undoable', () => {
    s().addObjects([part({ kind: 'shank' })])
    const before = s().objects.length
    s().addSizingBeads(s().objects[0].id)
    expect(s().objects.length).toBe(before + 2)
    s().undo()
    expect(s().objects.length).toBe(before)
  })
})
