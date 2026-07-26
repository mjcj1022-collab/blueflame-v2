import { describe, it, expect } from 'vitest'
import { bodyVolumeMm3, BODY_STYLES } from '../lib/body'
import { computeVolume } from '../lib/volume'
import { computeMetal } from '../lib/metal'
import { DEFAULT_SPEC, DEFAULT_BODY, type BodyStyle, type DesignSpec } from '../spec/types'

const geo = (style: BodyStyle) => ({ ...DEFAULT_BODY, style })

describe('body jewelry volume', () => {
  it('every style has positive metal volume', () => {
    for (const [style] of BODY_STYLES) {
      expect(bodyVolumeMm3(geo(style)), style).toBeGreaterThan(0)
    }
  })

  it('a heavier gauge weighs more', () => {
    const thin = bodyVolumeMm3({ ...DEFAULT_BODY, gauge: 1.0 })
    const thick = bodyVolumeMm3({ ...DEFAULT_BODY, gauge: 2.4 })
    expect(thick).toBeGreaterThan(thin)
  })

  it('a longer barbell weighs more', () => {
    const short = bodyVolumeMm3({ ...DEFAULT_BODY, style: 'barbell', size: 8 })
    const long = bodyVolumeMm3({ ...DEFAULT_BODY, style: 'barbell', size: 16 })
    expect(long).toBeGreaterThan(short)
  })

  it('distinct styles generally differ in volume', () => {
    const vols = BODY_STYLES.map(([s]) => bodyVolumeMm3(geo(s)))
    expect(new Set(vols.map(v => v.toFixed(2))).size).toBeGreaterThan(1)
  })

  it('flows through computeVolume for the body category', () => {
    const spec: DesignSpec = { ...DEFAULT_SPEC, category: 'body' }
    const v = computeVolume(spec)
    expect(v.total).toBeGreaterThan(0)
    expect(v.head).toBe(0)               // body jewelry carries no prong head
    expect(v.shank).toBeCloseTo(v.total, 5)
  })

  it('produces a sane castable weight in 14k gold', () => {
    const spec: DesignSpec = { ...DEFAULT_SPEC, category: 'body', metal: { alloyId: '14ky' } }
    const m = computeMetal(spec)
    expect(m.finished).toBeGreaterThan(0)
    expect(m.finished).toBeLessThan(20)  // a 14g barbell is a light piece, not a bangle
  })
})
