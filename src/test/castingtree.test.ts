import { describe, it, expect, beforeEach } from 'vitest'
import { useModeler, type SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (): SculptObject => ({ id: 'g', kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1 } })

describe('buildCastingTree', () => {
  beforeEach(() => useModeler.setState({ objects: [shank(), gem()], selectedId: null, past: [], future: [], placing: null, importedSig: null, explode: 0, snapshots: [] }))

  it('adds a rod, a button, N copies and N sprues (metal only)', () => {
    const before = useModeler.getState().objects.length
    const n = useModeler.getState().buildCastingTree(3)
    // 1 rod + 1 button + 3 copies (of the 1 metal part) + 3 sprues = 8
    expect(n).toBe(8)
    const objs = useModeler.getState().objects
    expect(objs.length).toBe(before + 8)
    expect(objs.some(o => o.name === 'Sprue rod')).toBe(true)
    expect(objs.some(o => o.name === 'Button')).toBe(true)
    expect(objs.filter(o => /^Sprue \d/.test(o.name)).length).toBe(3)
  })

  it('is undoable in one step and returns 0 with no metal', () => {
    const past = useModeler.getState().past.length
    useModeler.getState().buildCastingTree(2)
    expect(useModeler.getState().past.length).toBe(past + 1)
    useModeler.setState({ objects: [gem()] })   // gem only, no metal
    expect(useModeler.getState().buildCastingTree(3)).toBe(0)
  })
})
