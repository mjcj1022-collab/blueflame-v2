import { describe, it, expect, beforeEach } from 'vitest'
import { searchSculpts, allTags, parseTags, type SavedSculpt } from '../lib/sculptLibrary'
import { settingSecurity } from '../lib/settingSecurity'
import { modelerToDxf } from '../lib/dxfExport'
import { stockPlan } from '../lib/stock'
import { useModeler, type SculptObject } from '../state/modeler'

const rec = (name: string, tags: string[]): SavedSculpt => ({ id: name, name, at: 0, objects: [], tags })

describe('design library tags + search', () => {
  it('parses and dedupes tags', () => {
    expect(parseTags('Halo, halo, Client-Smith')).toEqual(['halo', 'client-smith'])
  })
  it('searches by name and tag, and filters by a chosen tag', () => {
    const list = [rec('Halo ring', ['engagement', 'halo']), rec('Plain band', ['wedding'])]
    expect(searchSculpts(list, 'halo').length).toBe(1)
    expect(searchSculpts(list, 'wedding').length).toBe(1)
    expect(searchSculpts(list, '', 'engagement').length).toBe(1)
    expect(allTags(list)).toEqual(['engagement', 'halo', 'wedding'])
  })
})

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (id: string, ct: number, x = 0): SculptObject => ({ id, kind: 'gem', name: 'Gem', position: [x, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat: ct } })
const head = (prongs: number, x = 0): SculptObject => ({ id: 'h' + prongs, kind: 'head', name: 'Head', position: [x, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0, params: { prongs, stoneW: 6.5, height: 4 } })

describe('setting security', () => {
  it('flags too few prongs for a big stone', () => {
    const s = settingSecurity([gem('g', 2.5), head(4)])
    expect(s.some(f => f.level === 'fail' && /prong/i.test(f.title))).toBe(true)
  })
  it('flags overlapping stones', () => {
    const s = settingSecurity([gem('a', 1, 0), gem('b', 1, 0.5)])  // centres 0.5mm apart, ~6.5mm stones
    expect(s.some(f => /overlap/i.test(f.title))).toBe(true)
  })
  it('passes a well-set stone', () => {
    const s = settingSecurity([gem('g', 1), head(6)])
    expect(s.some(f => f.level === 'pass')).toBe(true)
  })
})

describe('DXF export', () => {
  it('emits a valid DXF with LINE entities', () => {
    const dxf = modelerToDxf([shank()])
    expect(dxf).toMatch(/SECTION\n2\nENTITIES/)
    expect(dxf).toMatch(/\nLINE\n/)
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true)
  })
})

describe('metal stock & scrap', () => {
  it('orders at least the pour weight and reports a recovery %', () => {
    const sk = stockPlan([shank()], '14ky', 1)
    expect(sk.orderGrams).toBeGreaterThanOrEqual(sk.pourGrams)
    expect(sk.finishedGrams).toBeLessThan(sk.pourGrams)     // some is scrap
    expect(sk.recoveryPct).toBeGreaterThan(0)
    expect(sk.recoveryPct).toBeLessThanOrEqual(100)
    expect(sk.stockCost).toBeGreaterThan(0)
  })
})

describe('matched pair', () => {
  beforeEach(() => useModeler.setState({ objects: [shank()], selectedId: null, past: [], future: [], placing: null, importedSig: null, explode: 0, snapshots: [] }))
  it('mirrors the whole assembly into a second piece offset to the side', () => {
    const n = useModeler.getState().makeMatchedPair()
    expect(n).toBe(1)
    const objs = useModeler.getState().objects
    expect(objs.length).toBe(2)
    expect(objs[1].scale[0]).toBeLessThan(0)   // mirrored across X
    expect(objs[1].name).toMatch(/\(R\)/)
  })
})
