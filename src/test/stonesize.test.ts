import { describe, it, expect } from 'vitest'
import { caratForMm, mmForCarat, meleeOptions, sgOf, MELEE_MM } from '../lib/stoneSize'

describe('calibrated stone sizing', () => {
  it('a 1.00 ct round diamond is ~6.5 mm (trade calibration)', () => {
    const { width } = mmForCarat('rd', 'dia', 1)
    expect(width).toBeGreaterThan(6.3)
    expect(width).toBeLessThan(6.7)
  })

  it('mm→ct and ct→mm are inverses for diamond', () => {
    const ct = caratForMm('rd', 'dia', 3.0)
    const { width } = mmForCarat('rd', 'dia', ct)
    expect(width).toBeCloseTo(3.0, 4)
  })

  it('standard melee sizes match the trade chart (2 mm ≈ 0.03 ct, 3 mm ≈ 0.10 ct)', () => {
    expect(caratForMm('rd', 'dia', 2.0)).toBeCloseTo(0.03, 2)
    expect(caratForMm('rd', 'dia', 3.0)).toBeCloseTo(0.10, 2)
  })

  it('a denser stone weighs more at the same millimetre size', () => {
    // sapphire (corundum, sg 4.0) is denser than diamond (3.52)
    expect(sgOf('sap')).toBeGreaterThan(sgOf('dia'))
    const dia = caratForMm('rd', 'dia', 6.5)
    const sap = caratForMm('rd', 'sap', 6.5)
    expect(sap).toBeGreaterThan(dia)   // same 6.5 mm, more carats in sapphire
  })

  it('a denser stone is smaller at the same carat', () => {
    expect(mmForCarat('rd', 'sap', 1).width).toBeLessThan(mmForCarat('rd', 'dia', 1).width)
  })

  it('publishes the standard calibrated melee sizes with carats', () => {
    const opts = meleeOptions('dia', 'rd')
    expect(opts.length).toBe(MELEE_MM.length)
    expect(opts[0].mm).toBe(MELEE_MM[0])
    expect(opts.every(o => o.carat > 0)).toBe(true)
  })

  it('oval carats read length×width (lwRatio applied)', () => {
    const { width, length } = mmForCarat('ov', 'dia', 1)
    expect(length).toBeGreaterThan(width)
  })
})
