import { describe, it, expect, afterEach } from 'vitest'
import { laborBreakdown, formatMinutes } from '../lib/laborTime'
import { setMarket, DEFAULT_MARKET } from '../lib/market'
import type { SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (carat: number): SculptObject => ({ id: 'g' + carat, kind: 'gem', name: 'Gem', position: [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat } })

afterEach(() => setMarket({ laborRate: DEFAULT_MARKET.laborRate }))

describe('laborBreakdown', () => {
  it('lists cast + finish for a plain metal piece and a nonzero time', () => {
    const lb = laborBreakdown([shank()], '14ky')
    const ops = lb.lines.map(l => l.op)
    expect(ops).toContain('Cast & clean-up')
    expect(ops).toContain('Finish & polish')
    expect(lb.totalMinutes).toBeGreaterThan(0)
    expect(lb.laborCost).toBeGreaterThan(0)
  })

  it('adds setting time that scales with stone size', () => {
    const small = laborBreakdown([shank(), gem(0.05)], '14ky')  // melee
    const big = laborBreakdown([shank(), gem(2.5)], '14ky')      // statement
    const setSmall = small.lines.find(l => l.op === 'Stone setting')!.minutes
    const setBig = big.lines.find(l => l.op === 'Stone setting')!.minutes
    expect(setBig).toBeGreaterThan(setSmall)
  })

  it('adds an assembly join per metal part beyond the first', () => {
    const two = laborBreakdown([shank(), { ...shank(), id: 's2' }], '14ky')
    expect(two.lines.some(l => l.op === 'Assembly')).toBe(true)
  })

  it('labor cost scales with the shop hourly rate', () => {
    setMarket({ laborRate: 60 })
    const a = laborBreakdown([shank(), gem(1)], '14ky').laborCost
    setMarket({ laborRate: 120 })
    const b = laborBreakdown([shank(), gem(1)], '14ky').laborCost
    expect(b).toBeCloseTo(a * 2, 1)
  })

  it('formats minutes as hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45 m')
    expect(formatMinutes(85)).toBe('1 h 25 m')
    expect(formatMinutes(120)).toBe('2 h')
  })
})
