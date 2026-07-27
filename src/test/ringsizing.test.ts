import { describe, it, expect, beforeEach } from 'vitest'
import { sizingReport, findShank, ringSizeOptions, RING_SIZE_MIN, RING_SIZE_MAX } from '../lib/ringSizing'
import { useModeler, type SculptObject } from '../state/modeler'

const shank = (size = 7): SculptObject => ({ id: 'sh', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0, params: { ringSize: size, width: 2.2, thickness: 1.8 } })

describe('ring sizing report', () => {
  it('sizing up adds metal and costs metal + labor', () => {
    const r = sizingReport([shank(7)], 'sh', 9, '14ky')!
    expect(r.fromSize).toBe(7)
    expect(r.toSize).toBe(9)
    expect(r.afterG).toBeGreaterThan(r.beforeG)   // bigger ring, more metal
    expect(r.deltaG).toBeGreaterThan(0)
    expect(r.metalCost).toBeGreaterThan(0)
    expect(r.laborCost).toBeGreaterThan(0)
  })

  it('sizing down removes metal and charges labor but no new metal', () => {
    const r = sizingReport([shank(9)], 'sh', 6, '14ky')!
    expect(r.deltaG).toBeLessThan(0)
    expect(r.metalCost).toBe(0)         // removed metal is scrap-recoverable
    expect(r.laborCost).toBeGreaterThan(0)
  })

  it('clamps the target size to the wearable range', () => {
    const r = sizingReport([shank(7)], 'sh', 99, '14ky')!
    expect(r.toSize).toBe(RING_SIZE_MAX)
  })

  it('offers quarter sizes across the range', () => {
    const opts = ringSizeOptions()
    expect(opts[0]).toBe(RING_SIZE_MIN)
    expect(opts[opts.length - 1]).toBe(RING_SIZE_MAX)
    expect(opts).toContain(7.25)
  })
})

describe('resizeRing store action', () => {
  beforeEach(() => useModeler.setState({ objects: [shank(7)], selectedId: null, past: [], future: [], placing: null, importedSig: null, explode: 0 }))
  it('applies the new size to the shank param (undoable)', () => {
    const before = useModeler.getState().past.length
    const to = useModeler.getState().resizeRing('sh', 8.5)
    expect(to).toBe(8.5)
    expect((useModeler.getState().objects[0].params!.ringSize)).toBe(8.5)
    expect(useModeler.getState().past.length).toBe(before + 1)
  })
  it('finds the resizable shank on the bench', () => {
    expect(findShank(useModeler.getState().objects)?.id).toBe('sh')
  })
})
