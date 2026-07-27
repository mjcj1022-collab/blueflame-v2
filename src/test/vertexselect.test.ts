import { describe, it, expect, beforeEach } from 'vitest'
import { pointInPolygon, moveVertsBy, deleteVerticesFromSoup, groupCentroid } from '../lib/vertexSelect'
import { useModeler, type SculptObject } from '../state/modeler'

describe('pointInPolygon', () => {
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]
  it('detects inside and outside', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true)
    expect(pointInPolygon(15, 5, square)).toBe(false)
    expect(pointInPolygon(-1, -1, square)).toBe(false)
  })
})

describe('moveVertsBy', () => {
  it('translates only the selected vertices', () => {
    // two vertices (soup indices 0 and 1)
    const v = [0, 0, 0, 5, 5, 5]
    const out = moveVertsBy(v, [1], [1, 2, 3])
    expect(out.slice(0, 3)).toEqual([0, 0, 0])       // vertex 0 untouched
    expect(out.slice(3)).toEqual([6, 7, 8])          // vertex 1 moved
  })
})

describe('deleteVerticesFromSoup', () => {
  it('removes triangles that use any selected vertex', () => {
    // two triangles: tri0 = verts 0,1,2 ; tri1 = verts 3,4,5
    const v = [
      0, 0, 0, 1, 0, 0, 0, 1, 0, // tri 0
      2, 0, 0, 3, 0, 0, 2, 1, 0, // tri 1
    ]
    // deleting vertex 4 (inside tri 1) drops tri 1, keeps tri 0
    const out = deleteVerticesFromSoup(v, [4])
    expect(out.length).toBe(9)
    expect(out).toEqual(v.slice(0, 9))
  })
})

describe('groupCentroid', () => {
  it('averages the selected vertices', () => {
    const v = [0, 0, 0, 4, 0, 0, 0, 6, 0]
    expect(groupCentroid(v, [0, 1])).toEqual([2, 0, 0])
  })
})

describe('modeler group actions', () => {
  const mesh = (verts: number[]): Omit<SculptObject, 'id' | 'name'> => ({
    kind: 'mesh', size: 0, material: 'metal', color: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], vertices: verts,
  })
  beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [], selectedVerts: [] }))

  it('moveVertsGroup shifts the group and is undoable', () => {
    const s = useModeler.getState()
    s.addObjects([mesh([0, 0, 0, 1, 0, 0, 0, 1, 0])])
    const id = useModeler.getState().objects[0].id
    s.moveVertsGroup(id, [0], [10, 0, 0])
    expect(useModeler.getState().objects[0].vertices!.slice(0, 3)).toEqual([10, 0, 0])
    useModeler.getState().undo()
    expect(useModeler.getState().objects[0].vertices!.slice(0, 3)).toEqual([0, 0, 0])
  })

  it('deleteVertsGroup drops triangles and clears the selection', () => {
    const s = useModeler.getState()
    s.addObjects([mesh([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0])])
    const id = useModeler.getState().objects[0].id
    useModeler.setState({ selectedVerts: [4] })
    s.deleteVertsGroup(id, [4])
    expect(useModeler.getState().objects[0].vertices!.length).toBe(9)
    expect(useModeler.getState().selectedVerts).toEqual([])
  })
})
