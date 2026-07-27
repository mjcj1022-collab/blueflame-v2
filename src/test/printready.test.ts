import { describe, it, expect, beforeEach } from 'vitest'
import { printReadiness } from '../lib/printReady'
import { minWallForAlloy } from '../lib/manufacture'
import { useModeler, type SculptObject } from '../state/modeler'

const base = (o: Partial<SculptObject>): SculptObject => ({
  id: Math.random().toString(36).slice(2), kind: 'box', name: 'x',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6,
  material: 'metal', color: 0xd8b36a, ...o,
})

describe('minWallForAlloy', () => {
  it('gives gold a thicker minimum than silver', () => {
    expect(minWallForAlloy('14ky')).toBeGreaterThan(minWallForAlloy('ag93'))
    expect(minWallForAlloy('14ky')).toBe(1.0)
  })
})

describe('printReadiness', () => {
  it('fails with no metal', () => {
    const r = printReadiness([base({ material: 'gem' })], '14ky')
    expect(r.verdict).toBe('fail')
    expect(r.metalParts).toBe(0)
  })

  it('passes a solid primitive shank and reports its metal parts', () => {
    const r = printReadiness([base({ kind: 'shank', params: { ringSize: 7, width: 2.2, thickness: 1.8 } })], '14ky')
    expect(r.metalParts).toBe(1)
    expect(['pass', 'warn']).toContain(r.verdict) // a solid primitive should not hard-fail
    expect(r.minWallLimit).toBe(1.0)
  })
})

describe('fixForPrint store action', () => {
  beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [], placing: null, importedSig: null }))

  it('reports nothing to weld when parts are parametric primitives', () => {
    useModeler.setState({ objects: [base({ kind: 'shank' })] })
    const s = useModeler.getState().fixForPrint()
    expect(s.parts).toBe(0)
    expect(s.watertight).toBe(true)
  })

  it('welds a duplicated-vertex mesh part and records one undo step', () => {
    // two identical triangles (a degenerate/duplicate soup) as a mesh part
    const tri = [0, 0, 0, 1, 0, 0, 0, 1, 0]
    const soup = [...tri, ...tri]
    useModeler.setState({ objects: [base({ kind: 'mesh', vertices: soup })] })
    const before = useModeler.getState().past.length
    const s = useModeler.getState().fixForPrint()
    expect(s.parts).toBe(1)
    expect(s.duplicate + s.welded).toBeGreaterThan(0)
    expect(useModeler.getState().past.length).toBe(before + 1)
  })
})
