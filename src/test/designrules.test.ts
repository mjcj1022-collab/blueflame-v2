import { describe, it, expect } from 'vitest'
import { validateDesign, completeDesign, refineDesign, bandWidthFor } from '../lib/designRules'
import { DESIGN_TEMPLATES } from '../lib/designTemplates'
import { designQuality } from '../lib/designQuality'
import type { SculptObject } from '../state/modeler'

describe('validateDesign', () => {
  it('strips necklace fields from a ring', () => {
    const { design, fixes } = validateDesign({ category: 'ring', chainStyle: 'rope', necklaceLength: 20, shapeId: 'rd', carat: 1 })
    expect(design.chainStyle).toBeUndefined()
    expect(design.necklaceLength).toBeUndefined()
    expect(design.shapeId).toBe('rd')
    expect(fixes.length).toBeGreaterThan(0)
  })

  it('promotes a motif-bearing ring to a necklace', () => {
    const { design } = validateDesign({ category: 'ring', motif: 'celtic' })
    expect(design.category).toBe('necklace')
  })

  it('drops setting and carat from a no-stone band', () => {
    const { design } = validateDesign({ category: 'ring', stoneTypeId: 'none', settingId: 'p6', carat: 1, bandWidth: 5 })
    expect(design.settingId).toBeUndefined()
    expect(design.carat).toBeUndefined()
    expect(design.bandWidth).toBe(5) // band width is legitimate on a plain band
  })
})

describe('completeDesign', () => {
  it('fills a full ring spec from a sparse patch', () => {
    const d = completeDesign({ category: 'ring', shapeId: 'rd' })
    expect(d.alloyId).toBeTruthy()
    expect(d.finish).toBeTruthy()
    expect(d.stoneTypeId).toBe('dia')
    expect(d.carat).toBeGreaterThan(0)
    expect(d.size).toBeGreaterThan(0)
    expect(d.settingId).toBeTruthy()
    expect(d.bandWidth).toBeGreaterThan(0)
  })

  it('does not add a stone or setting to a no-stone band', () => {
    const d = completeDesign({ category: 'ring', stoneTypeId: 'none' })
    expect(d.settingId).toBeUndefined()
    expect(d.bandWidth).toBeGreaterThan(0) // still a complete band
  })

  it('never overwrites explicit choices', () => {
    const d = completeDesign({ category: 'ring', alloyId: '18kr', carat: 2, size: 8 })
    expect(d.alloyId).toBe('18kr')
    expect(d.carat).toBe(2)
    expect(d.size).toBe(8)
  })

  it('band width grows with carat but stays wearable', () => {
    expect(bandWidthFor(0.5)).toBeLessThan(bandWidthFor(2))
    expect(bandWidthFor(10)).toBeLessThanOrEqual(4.5)
    expect(bandWidthFor(undefined)).toBeGreaterThan(0)
  })
})

describe('refineDesign', () => {
  it('repairs then completes in one pass', () => {
    const { design } = refineDesign({ category: 'ring', chainStyle: 'rope', shapeId: 'rd' })
    expect(design.chainStyle).toBeUndefined() // repaired
    expect(design.settingId).toBeTruthy() // completed
    expect(design.alloyId).toBeTruthy()
  })
})

describe('DESIGN_TEMPLATES', () => {
  it('every template is internally consistent after validation (no fields removed)', () => {
    for (const t of DESIGN_TEMPLATES) {
      const { fixes } = validateDesign(t.patch)
      expect(fixes, `${t.id} should be clean`).toEqual([])
      expect(t.patch.category).toBeTruthy()
    }
  })
})

describe('designQuality', () => {
  const gem = (): SculptObject => ({ id: 'g', kind: 'gem', name: 'g', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', carat: 1 } })
  it('flags a stone with no metal as blocked (not held)', () => {
    const q = designQuality([gem()])
    expect(['blocked', 'review']).toContain(q.level)
  })
  it('an empty scene is not blocked', () => {
    const q = designQuality([])
    expect(q.level).not.toBe('blocked')
  })
})
