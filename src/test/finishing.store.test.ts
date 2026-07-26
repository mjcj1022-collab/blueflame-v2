import { describe, it, expect, beforeEach } from 'vitest'
import { useModeler, type SculptObject } from '../state/modeler'

const s = () => useModeler.getState()
const part = (over: Partial<SculptObject>): Omit<SculptObject, 'id' | 'name'> => ({
  kind: 'box', size: 8, material: 'metal', color: 0xffffff,
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], ...over,
})

beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [] }))

describe('textureMesh', () => {
  it('turns a primitive into a displaced mesh of the same triangle count', () => {
    s().addObjects([part({ kind: 'box', size: 8 })])
    const id = s().objects[0].id
    expect(s().textureMesh(id, 'hammered', 0.2, 1.2)).toBe(true)
    const o = s().objects[0]
    expect(o.kind).toBe('mesh')
    expect(o.vertices!.length % 9).toBe(0)
    expect(o.vertices!.length).toBeGreaterThan(0)
  })
})

describe('addMilgrain', () => {
  it('adds a ring of bead spheres', () => {
    const n = s().addMilgrain([0, 1, 0], 4, 0.5)
    expect(n).toBeGreaterThan(3)
    const beads = s().objects.filter(o => o.name.startsWith('Milgrain'))
    expect(beads).toHaveLength(n)
    expect(beads.every(b => b.kind === 'sphere' && b.material === 'metal')).toBe(true)
  })
})

describe('bridgeWire', () => {
  it('sweeps a tube between two parts', () => {
    s().addObjects([part({ position: [-5, 0, 0] }), part({ position: [5, 0, 0] })])
    const [a, b] = s().objects
    expect(s().bridgeWire(a.id, b.id, 1)).toBe(true)
    const tube = s().objects.find(o => o.name === 'Bridge wire')!
    expect(tube).toBeTruthy()
    expect(tube.vertices!.length % 9).toBe(0)
  })
  it('refuses to bridge a part to itself', () => {
    s().addObjects([part({})])
    const a = s().objects[0]
    expect(s().bridgeWire(a.id, a.id, 1)).toBe(false)
  })
})

describe('piercePattern', () => {
  it('cuts a ring of holes and leaves a valid mesh', () => {
    s().addObjects([part({ kind: 'cylinder', size: 12, position: [0, 0, 0] })])
    const id = s().objects[0].id
    const n = s().piercePattern(id, 6, 'ring', 4, 1, 'y')
    expect(n).toBeGreaterThan(0)
    const o = s().objects[0]
    expect(o.kind).toBe('mesh')
    expect(o.vertices!.length % 9).toBe(0)
  })
})

describe('addSignet', () => {
  it('adds a flat signet plate above the part', () => {
    s().addObjects([part({ kind: 'box', size: 6, position: [0, 0, 0] })])
    const src = s().objects[0]
    expect(s().addSignet(src.id, 10, 12, 1.5)).toBe(true)
    const sig = s().objects.find(o => o.name === 'Signet face')!
    expect(sig).toBeTruthy()
    expect(sig.position[1]).toBeGreaterThan(3) // above the box top (~+3)
    expect(sig.scale).toEqual([10, 1.5, 12])
  })
})
