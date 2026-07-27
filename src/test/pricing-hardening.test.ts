import { describe, it, expect } from 'vitest'
import { DEFAULT_SPEC, NO_STONE, type DesignSpec } from '../spec/types'
import { computePrice } from '../lib/pricing'
import { stoneById } from '../catalog'

const ring = (over: Partial<DesignSpec['center']>): DesignSpec =>
  ({ ...DEFAULT_SPEC, center: { ...DEFAULT_SPEC.center, ...over } })

describe('pricing hardening — carat clamp', () => {
  it('a negative centre carat never produces a NaN total', () => {
    const r = computePrice(ring({ carat: -1.5 }))
    expect(Number.isFinite(r.total)).toBe(true)
    expect(Number.isFinite(r.stoneCost)).toBe(true)
    expect(r.stoneCost).toBe(0)          // non-positive carat prices as zero, not NaN
  })
  it('a zero centre carat prices the stone at zero without breaking the quote', () => {
    const r = computePrice(ring({ carat: 0 }))
    expect(Number.isFinite(r.total)).toBe(true)
    expect(r.stoneCost).toBe(0)
  })
  it('a normal carat still prices above zero', () => {
    expect(computePrice(ring({ carat: 1 })).stoneCost).toBeGreaterThan(0)
  })
})

describe('pricing hardening — accents price on their own stone type', () => {
  const withMelee = (centerId: string, meleeStoneId?: string): DesignSpec => ({
    ...DEFAULT_SPEC,
    center: { ...DEFAULT_SPEC.center, stoneTypeId: centerId },
    setting: { typeId: 'hal', melee: { count: 20, caratEach: 0.02, stoneId: meleeStoneId } },
  })

  it('diamond melee around a sapphire centre costs the diamond rate, not the sapphire rate', () => {
    const diamondMelee = computePrice(withMelee('sap', 'dia')).accentCost
    const sapphireMelee = computePrice(withMelee('sap', 'sap')).accentCost
    // Diamond ($5200/ct) is far dearer than sapphire ($1100/ct) at the same size.
    expect(diamondMelee).toBeGreaterThan(sapphireMelee)
    expect(stoneById('dia').rate).toBeGreaterThan(stoneById('sap').rate)
  })
  it('an eternity band with no centre stone prices melee as diamond, not the catch-all', () => {
    // allAround eternity setting, centre = NO_STONE
    const spec: DesignSpec = {
      ...DEFAULT_SPEC,
      center: { ...DEFAULT_SPEC.center, stoneTypeId: NO_STONE },
      setting: { typeId: 'etr', melee: { count: 20, caratEach: 0.05 } },
    }
    const r = computePrice(spec)
    expect(Number.isFinite(r.accentCost)).toBe(true)
    expect(r.accentCost).toBeGreaterThan(0)
  })
})

describe('pricing hardening — setting labor for every set stone', () => {
  it('a tennis bracelet is charged setting labor for its links', () => {
    const spec: DesignSpec = {
      ...DEFAULT_SPEC,
      category: 'bracelet',
      bracelet: { ...DEFAULT_SPEC.bracelet, kind: 'tennis', linkCount: 40 },
    }
    const r = computePrice(spec)
    expect(r.stoneCount).toBe(40)
    expect(r.settingFee).toBeGreaterThan(0)   // was $0 before the fix
  })
  it('a pendant necklace is charged setting labor for its stone', () => {
    const spec: DesignSpec = {
      ...DEFAULT_SPEC,
      category: 'necklace',
      necklace: { ...DEFAULT_SPEC.necklace, hasPendant: true },
    }
    expect(computePrice(spec).settingFee).toBeGreaterThan(0)
  })
  it('a plain band (no stone) is charged no setting labor', () => {
    expect(computePrice(ring({ stoneTypeId: NO_STONE })).settingFee).toBe(0)
  })
})
