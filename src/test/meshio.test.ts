import { describe, it, expect, beforeEach } from 'vitest'
import { modelerToStlBinary, modelerTo3mf, stlToVertices } from '../lib/cadExport'
import { useModeler, type SculptObject } from '../state/modeler'

const cube = (): SculptObject => ({
  id: 'c', kind: 'box', name: 'Cube', position: [0, 5, 0], rotation: [0, 0, 0],
  scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a,
})

describe('binary STL export + import round-trips', () => {
  it('exports a non-empty binary STL and re-imports it as triangles', () => {
    const buf = modelerToStlBinary([cube()])
    expect(buf.byteLength).toBeGreaterThan(84)         // header(80)+count(4)+…
    const v = stlToVertices(buf)
    expect(v.length).toBeGreaterThan(0)
    expect(v.length % 9).toBe(0)                        // whole triangles
    expect(v.every(Number.isFinite)).toBe(true)
  })
})

describe('3MF export', () => {
  it('produces a zip package (PK header) with content', () => {
    const z = modelerTo3mf([cube()])
    expect(z.length).toBeGreaterThan(100)
    expect(z[0]).toBe(0x50) // 'P'
    expect(z[1]).toBe(0x4b) // 'K' — zip signature
  })
})

describe('importMesh store action', () => {
  beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [], placing: null, importedSig: null }))
  it('drops an imported soup onto the bench, recentred to the floor', () => {
    const buf = modelerToStlBinary([cube()])
    const v = stlToVertices(buf)
    const id = useModeler.getState().importMesh(v, 'ring.stl')
    expect(id).toBeTruthy()
    const o = useModeler.getState().objects.find(x => x.id === id)!
    expect(o.kind).toBe('mesh')
    expect(o.material).toBe('metal')
    // lowest vertex dropped to y≈0
    const ys = o.vertices!.filter((_, i) => i % 3 === 1)
    expect(Math.min(...ys)).toBeCloseTo(0, 3)
  })
})
