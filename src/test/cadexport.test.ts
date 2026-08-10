import { describe, it, expect } from 'vitest'
import { modelerToObj, mandrelMtl } from '../lib/cadExport'
import type { SculptObject } from '../state/modeler'

const obj = (p: Partial<SculptObject>): SculptObject => ({
  id: Math.random().toString(36).slice(2),
  kind: 'box',
  name: 'part',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  size: 4,
  material: 'metal',
  color: 0,
  ...p,
})

// Count how many triangles/verts an OBJ text actually declares.
const count = (text: string) => {
  const v = (text.match(/^v /gm) || []).length
  const f = (text.match(/^f /gm) || []).length
  return { v, f }
}

describe('modelerToObj', () => {
  it('emits three vertices per face and every face index is in range', () => {
    const text = modelerToObj([obj({ kind: 'box', name: 'Shank' })])
    const { v, f } = count(text)
    expect(f).toBeGreaterThan(0)
    expect(v).toBe(f * 3) // one unshared triangle soup: 3 verts per face

    // Every face index resolves to a declared vertex.
    const idx = [...text.matchAll(/^f (\d+) (\d+) (\d+)$/gm)].flatMap((m) => [+m[1], +m[2], +m[3]])
    expect(Math.min(...idx)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...idx)).toBeLessThanOrEqual(v)
  })

  it('keeps parts separate with unique object names and per-material groups', () => {
    const text = modelerToObj([
      obj({ kind: 'box', name: 'Ring', material: 'metal' }),
      obj({ kind: 'box', name: 'Ring', material: 'metal', position: [10, 0, 0] }),
      obj({ kind: 'gem', name: 'Stone', material: 'gem', position: [0, 6, 0], params: { shapeId: 'rd', carat: 1 } }),
    ])
    const names = [...text.matchAll(/^o (.+)$/gm)].map((m) => m[1])
    expect(names).toHaveLength(3)
    expect(new Set(names).size).toBe(3) // duplicate "Ring" got disambiguated
    expect(text).toContain('usemtl Mandrel_Metal')
    expect(text).toContain('usemtl Mandrel_Gem')
  })

  it('metalOnly drops the stones', () => {
    const withGem = [
      obj({ kind: 'box', material: 'metal' }),
      obj({ kind: 'gem', material: 'gem', params: { shapeId: 'rd', carat: 1 } }),
    ]
    const all = modelerToObj(withGem)
    const metal = modelerToObj(withGem, { metalOnly: true })
    expect(all).toContain('Mandrel_Gem')
    expect(metal).not.toContain('Mandrel_Gem')
    expect(count(metal).f).toBeGreaterThan(0)
  })

  it('face indices are continuous across multiple parts (global offset)', () => {
    const two = modelerToObj([obj({ kind: 'box' }), obj({ kind: 'box', position: [20, 0, 0] })])
    const { v, f } = count(two)
    expect(v).toBe(f * 3)
    const idx = [...two.matchAll(/^f (\d+) (\d+) (\d+)$/gm)].flatMap((m) => [+m[1], +m[2], +m[3]])
    // no index exceeds the total vertex count — the second part's faces are offset
    expect(Math.max(...idx)).toBe(v)
  })

  it('mtl defines both materials', () => {
    const m = mandrelMtl()
    expect(m).toContain('newmtl Mandrel_Metal')
    expect(m).toContain('newmtl Mandrel_Gem')
  })
})
