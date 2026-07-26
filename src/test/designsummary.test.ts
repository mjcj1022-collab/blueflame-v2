import { describe, it, expect } from 'vitest'
import { summarizeDesign } from '../lib/designSummary'
import { DEFAULT_SPEC, NO_STONE, type DesignSpec } from '../spec/types'

describe('summarizeDesign', () => {
  it('describes a stone-set ring with metal, stone, setting and size', () => {
    const s = summarizeDesign(DEFAULT_SPEC)
    expect(s).toMatch(/ring/i)
    expect(s).toMatch(/1\.00ct/)         // carat, 2 decimals
    expect(s).toMatch(/setting/i)
    expect(s).toMatch(/size/i)           // rings report size
    expect(s).toMatch(/polish finish/i)
  })

  it('reports "no center stone" when the stone is removed', () => {
    const band: DesignSpec = { ...DEFAULT_SPEC, center: { ...DEFAULT_SPEC.center, stoneTypeId: NO_STONE } }
    const s = summarizeDesign(band)
    expect(s).toMatch(/no center stone/i)
    expect(s).not.toMatch(/setting/i)    // no stone → no setting phrase
  })

  it('omits ring size for non-ring categories', () => {
    const necklace: DesignSpec = { ...DEFAULT_SPEC, category: 'necklace' }
    const s = summarizeDesign(necklace)
    expect(s).toMatch(/necklace/i)
    expect(s).not.toMatch(/\bsize\b/i)   // only rings carry a size
  })

  it('is a single comma-joined line (no newlines)', () => {
    const s = summarizeDesign(DEFAULT_SPEC)
    expect(s).not.toContain('\n')
    expect(s.split(',').length).toBeGreaterThan(2)
  })
})
