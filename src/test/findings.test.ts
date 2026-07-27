import { describe, it, expect, beforeEach } from 'vitest'
import { FINDINGS, findingVertices, findingById } from '../lib/findings'
import { sculptBom, sculptBomText } from '../lib/sculptBom'
import { useModeler, type SculptObject } from '../state/modeler'

describe('findings library', () => {
  it('every catalog finding bakes a valid non-empty soup', () => {
    for (const f of FINDINGS) {
      const v = findingVertices(f.id)
      expect(v.length, f.id).toBeGreaterThan(0)
      expect(v.length % 9, f.id).toBe(0)
      expect(v.every(Number.isFinite), f.id).toBe(true)
    }
  })
  it('covers the core clasp/ring/bail/ear/pin categories', () => {
    const cats = new Set(FINDINGS.map(f => f.category))
    for (const c of ['clasp', 'ring', 'bail', 'ear', 'pin']) expect(cats.has(c as never)).toBe(true)
    expect(findingById('lobster')?.name).toMatch(/lobster/i)
  })
})

describe('addFinding store action', () => {
  beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [], placing: null, importedSig: null, explode: 0 }))
  it('adds a finding as a selected metal mesh part', () => {
    const id = useModeler.getState().addFinding('lobster')
    expect(id).toBeTruthy()
    const o = useModeler.getState().objects.find(x => x.id === id)!
    expect(o.material).toBe('metal')
    expect(o.kind).toBe('mesh')
    expect(useModeler.getState().selectedId).toBe(id)
  })
})

describe('sculpt bill of materials', () => {
  const gem = (ct: number): SculptObject => ({ id: 'g' + ct, kind: 'gem', name: 'Gem', position: [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat: ct } })
  const shank = (id: string): SculptObject => ({ id, kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })

  it('groups identical stones into a single quantity row', () => {
    const b = sculptBom([gem(0.05), gem(0.05), gem(0.05)], '14ky')
    const row = b.rows.find(r => r.carat === 0.05)!
    expect(row.qty).toBe(3)
    expect(b.gemCount).toBe(3)
  })
  it('totals metal grams across parts and renders text', () => {
    const b = sculptBom([shank('a'), gem(1)], '14ky')
    expect(b.metalParts).toBe(1)
    expect(b.metalGrams).toBeGreaterThan(0)
    expect(sculptBomText([shank('a'), gem(1)], '14ky')).toMatch(/BILL OF MATERIALS/)
  })
})
