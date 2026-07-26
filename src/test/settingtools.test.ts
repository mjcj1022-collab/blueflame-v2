import { describe, it, expect, beforeEach } from 'vitest'
import { useModeler, type SculptObject } from '../state/modeler'
import { gemDiameterMm } from '../lib/setting'

const s = () => useModeler.getState()
const part = (over: Partial<SculptObject>): Omit<SculptObject, 'id' | 'name'> => ({
  kind: 'box', size: 6, material: 'metal', color: 0xffffff,
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], ...over,
})
const gem = (over: Partial<SculptObject> = {}) =>
  part({ kind: 'gem', material: 'gem', position: [0, 5, 0], params: { shapeId: 'rd', carat: 1 }, ...over })

beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [] }))

describe('fitHead', () => {
  it('adds a prong head sized to the selected gem', () => {
    s().addObjects([gem()])
    const g = s().objects[0]
    expect(s().fitHead(g.id, 6)).toBe(true)
    const head = s().objects.find(o => o.kind === 'head')!
    expect(head).toBeTruthy()
    expect(head.params!.prongs).toBe(6)
    expect(head.params!.stoneW).toBeCloseTo(gemDiameterMm(g), 4)
    // centred on the gem in X/Z
    expect(head.position[0]).toBeCloseTo(g.position[0], 6)
    expect(head.position[2]).toBeCloseTo(g.position[2], 6)
  })
  it('refuses a non-gem and is undoable', () => {
    s().addObjects([part({})])
    expect(s().fitHead(s().objects[0].id, 4)).toBe(false)
    s().addObjects([gem()])
    s().fitHead(s().objects.find(o => o.kind === 'gem')!.id, 4)
    const before = s().objects.length
    s().undo()
    expect(s().objects.length).toBe(before - 1)
  })
})

describe('fitBezel', () => {
  it('wraps the gem in a bezel sized to its girdle', () => {
    s().addObjects([gem()])
    const g = s().objects[0]
    expect(s().fitBezel(g.id)).toBe(true)
    const bez = s().objects.find(o => o.kind === 'bezel')!
    expect(bez.params!.stoneW).toBeCloseTo(gemDiameterMm(g), 4)
    expect(bez.params!.wall).toBeGreaterThan(0)
  })
})

describe('drillHole', () => {
  it('subtracts a through-hole and leaves a valid mesh', () => {
    s().addObjects([part({ kind: 'box', size: 8 })])
    const id = s().objects[0].id
    expect(s().drillHole(id, 'y', 2)).toBe(true)
    const drilled = s().objects.find(o => o.id === id)!
    expect(drilled.kind).toBe('mesh')
    expect(drilled.vertices!.length % 9).toBe(0)
    expect(drilled.vertices!.length).toBeGreaterThan(0)
  })
  it('rejects a zero diameter', () => {
    s().addObjects([part({ kind: 'box', size: 8 })])
    expect(s().drillHole(s().objects[0].id, 'x', 0)).toBe(false)
  })
})

describe('addBail', () => {
  it('hangs a loop above the top of the part', () => {
    s().addObjects([part({ kind: 'box', size: 6, position: [0, 0, 0] })])
    const src = s().objects[0]
    expect(s().addBail(src.id)).toBe(true)
    const bail = s().objects.find(o => o.kind === 'torus')!
    expect(bail).toBeTruthy()
    // the loop sits above the box's top (~+3)
    expect(bail.position[1]).toBeGreaterThan(3)
  })
})

describe('paveFill snap-to-surface', () => {
  it('drops stones onto a metal part instead of the flat anchor height', () => {
    // a wide flat metal slab whose top sits at y≈+3
    s().addObjects([part({ kind: 'box', size: 6, position: [0, 0, 0] })])
    const base = s().objects[0]
    const n = s().paveFill({
      count: 3, mode: 'row', carat: 0.02, gap: 0.3,
      center: [0, 0, 0], baseId: base.id, snapToSurface: true, cutSeats: false,
    })
    expect(n).toBe(3)
    const gems = s().objects.filter(o => o.material === 'gem')
    expect(gems).toHaveLength(3)
    // every stone lifted up to the slab's top surface (well above the y=0 anchor)
    for (const g of gems) expect(g.position[1]).toBeGreaterThan(2)
  })
})
