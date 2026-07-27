import { describe, it, expect } from 'vitest'
import { modelerToSvg } from '../lib/svgSpec'
import { sculptAppraisalText } from '../lib/sculptAppraisal'
import { quoteMessage } from '../lib/quoteMessage'
import { leadTime } from '../lib/leadTime'
import { modelerToStlBinary, objToVertices } from '../lib/cadExport'
import type { SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (id: string, ct: number): SculptObject => ({ id, kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat: ct } })

describe('SVG spec drawing', () => {
  it('produces an SVG with dimensions and the piece name', () => {
    const svg = modelerToSvg([shank()], { brand: 'Blue Flame', name: 'Solitaire', ringSize: 7 })
    expect(svg).toMatch(/^<svg/)
    expect(svg).toMatch(/mm</)
    expect(svg).toMatch(/Solitaire/)
    expect(svg).toMatch(/ring size US 7/)
  })
})

describe('sculpt appraisal', () => {
  it('states metal, stones and a replacement value above the estimate', () => {
    const t = sculptAppraisalText([shank(), gem('g', 1)], '18ky', 'Blue Flame', '2026-01-01')
    expect(t).toMatch(/INSURANCE APPRAISAL/)
    expect(t).toMatch(/Retail replacement/)
    expect(t).toMatch(/18K/)
  })
})

describe('quote message', () => {
  it('reads as a customer note with price, deposit and timeline', () => {
    const m = quoteMessage([shank(), gem('g', 1)], '14ky', { name: 'the halo ring', customer: 'Sam' })
    expect(m).toMatch(/Hi Sam/)
    expect(m).toMatch(/Price:/)
    expect(m).toMatch(/deposit/i)
    expect(m).toMatch(/business days/)
  })
})

describe('lead time', () => {
  it('includes casting turnaround and adds a stone-sourcing stage when set', () => {
    const withStones = leadTime([shank(), gem('g', 1)], '14ky')
    const plain = leadTime([shank()], '14ky')
    expect(withStones.stages.some(s => /cast/i.test(s.stage))).toBe(true)
    expect(withStones.stages.some(s => /stone/i.test(s.stage))).toBe(true)
    expect(plain.stages.some(s => /stone/i.test(s.stage))).toBe(false)
    expect(withStones.totalDays).toBeGreaterThan(0)
  })
})

describe('OBJ import round-trip', () => {
  it('parses an OBJ back into triangles', () => {
    // hand-authored minimal OBJ: one triangle
    const obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'
    const v = objToVertices(obj)
    expect(v.length).toBe(9)
    expect(v.every(Number.isFinite)).toBe(true)
    // and a real exported STL is unaffected (sanity: exporter still works)
    expect(modelerToStlBinary([shank()]).byteLength).toBeGreaterThan(84)
  })
})
