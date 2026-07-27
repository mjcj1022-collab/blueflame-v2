import { describe, it, expect, beforeEach } from 'vitest'
import { useModeler, type SculptObject } from '../state/modeler'

const obj = (o: Partial<SculptObject>): SculptObject => ({
  id: Math.random().toString(36).slice(2), kind: 'box', name: 'x',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6,
  material: 'metal', color: 0xd8b36a, ...o,
})

describe('seatStone — carves a bearing under a stone', () => {
  beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [], placing: null, importedSig: null }))

  it('returns false when the gem sits over no metal', () => {
    const gem = obj({ material: 'gem', kind: 'gem', position: [0, 5, 0], params: { shapeId: 'rd', carat: 0.5 } })
    useModeler.setState({ objects: [gem] })
    expect(useModeler.getState().seatStone(gem.id)).toBe(false)
  })

  it('carves the metal (turns it into a mesh) when a stone sits above it', () => {
    // a flat slab of metal at the origin, a gem sitting just above its top
    const slab = obj({ kind: 'box', size: 10, position: [0, 0, 0], scale: [1, 0.3, 1] })
    const gem = obj({ material: 'gem', kind: 'gem', position: [0, 1.6, 0], params: { shapeId: 'rd', carat: 0.5 } })
    useModeler.setState({ objects: [slab, gem] })
    const ok = useModeler.getState().seatStone(gem.id)
    expect(ok).toBe(true)
    const carved = useModeler.getState().objects.find(o => o.id === slab.id)!
    expect(carved.kind).toBe('mesh')            // boolean result is a baked mesh
    expect(carved.vertices && carved.vertices.length).toBeGreaterThan(0)
    // the stone is NOT sunk — it stays where it was placed (unlike flush-set)
    expect(useModeler.getState().objects.find(o => o.id === gem.id)!.position[1]).toBe(1.6)
  })
})
