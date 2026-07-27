import { describe, it, expect, beforeEach } from 'vitest'
import { measurements } from '../lib/measure'
import { castingPlan } from '../lib/casting'
import { useModeler, type SculptObject } from '../state/modeler'

const shank = (size = 7): SculptObject => ({ id: 'sh', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: size, width: 2.2, thickness: 1.8, profile: 'round' } })
const gem = (ct: number): SculptObject => ({ id: 'g', kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat: ct } })

const reset = (objs: SculptObject[] = []) => useModeler.setState({ objects: objs, selectedId: null, past: [], future: [], placing: null, importedSig: null, explode: 0, snapshots: [] })

describe('measurements', () => {
  it('reports overall size, ring size and cast weight', () => {
    const m = measurements([shank(7), gem(1)], '14ky')
    expect(m.overall[0]).toBeGreaterThan(0)
    expect(m.ringSize).toBe(7)
    expect(m.ringInnerMm).toBeGreaterThan(0)
    expect(m.bandWidth).toBe(2.2)
    expect(m.castGrams).toBeGreaterThan(0)
    expect(m.stoneCount).toBe(1)
  })
})

describe('casting plan', () => {
  it('pour weight exceeds finished weight and scales with copies', () => {
    const one = castingPlan([shank()], '14ky', 1)
    const ten = castingPlan([shank()], '14ky', 10)
    expect(one.pourGrams).toBeGreaterThan(one.pieceGrams)   // sprue+shrink+button
    expect(ten.treeGrams).toBeCloseTo((one.pieceGrams + one.sprueGrams) * 10, 4)
    expect(ten.pourGrams).toBeGreaterThan(one.pourGrams)
  })
  it('platinum shrinks more than gold', () => {
    const au = castingPlan([shank()], '14ky', 1)
    const pt = castingPlan([shank()], 'pt95', 1)
    expect(pt.shrinkGrams / pt.treeGrams).toBeGreaterThan(au.shrinkGrams / au.treeGrams)
  })
})

describe('mount builder', () => {
  beforeEach(() => reset())
  it('adds a 6-prong head sized to a stone', () => {
    const id = useModeler.getState().addMount('p6')
    const o = useModeler.getState().objects.find(x => x.id === id)!
    expect(o.kind).toBe('head')
    expect(o.params!.prongs).toBe(6)
  })
  it('adds a bezel', () => {
    const id = useModeler.getState().addMount('bz')
    expect(useModeler.getState().objects.find(x => x.id === id)!.kind).toBe('bezel')
  })
})

describe('repair mode', () => {
  beforeEach(() => reset())
  it('retips a head with one bead per prong', () => {
    const id = useModeler.getState().addMount('p6')!
    const n = useModeler.getState().retipProngs(id)
    expect(n).toBe(6)
    expect(useModeler.getState().objects.filter(o => o.name === 'Retip').length).toBe(6)
  })
  it('replaces a shank with a fresh parametric band at the same size', () => {
    reset([{ ...shank(8), kind: 'mesh', vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0] }])
    const ok = useModeler.getState().replaceShank('sh')
    expect(ok).toBe(true)
    const fresh = useModeler.getState().objects[0]
    expect(fresh.kind).toBe('shank')
    expect(fresh.params!.ringSize).toBe(8)
  })
})

describe('version history', () => {
  beforeEach(() => reset([shank(7)]))
  it('saves, restores and deletes snapshots', () => {
    const id = useModeler.getState().saveSnapshot('base')
    expect(useModeler.getState().snapshots.length).toBe(1)
    // mutate the bench, then restore
    useModeler.setState({ objects: [] })
    expect(useModeler.getState().restoreSnapshot(id)).toBe(true)
    expect(useModeler.getState().objects.length).toBe(1)
    useModeler.getState().deleteSnapshot(id)
    expect(useModeler.getState().snapshots.length).toBe(0)
  })
})
