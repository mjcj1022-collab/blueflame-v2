import { describe, it, expect } from 'vitest'
import { matchDesign, type GemStock } from '../lib/gemInventory'
import { durabilityCheck } from '../lib/durability'
import { careLines } from '../lib/careSheet'
import { jobTicketText } from '../lib/jobTicket'
import { paymentSchedule } from '../lib/deposit'
import type { SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (id: string, ct: number, stone = 'dia'): SculptObject => ({ id, kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: stone, carat: ct } })

describe('gem inventory match', () => {
  it('nets design need against stock on hand', () => {
    const design = [gem('a', 0.05), gem('b', 0.05), gem('c', 0.05)]
    const mm = matchDesign(design, [])[0].mm
    const stock: GemStock[] = [{ id: 's1', stoneId: 'dia', shapeId: 'rd', mm, qty: 2 }]
    const row = matchDesign(design, stock)[0]
    expect(row.need).toBe(3)
    expect(row.have).toBe(2)
    expect(row.toBuy).toBe(1)
  })
})

describe('durability / wear QA', () => {
  it('warns about a soft stone in a ring', () => {
    const d = durabilityCheck([shank(), gem('g', 1, 'opa')])   // opal, Mohs 5.5
    expect(d.some(f => f.level !== 'pass' && /opal/i.test(f.title))).toBe(true)
  })
  it('passes a diamond ring', () => {
    const d = durabilityCheck([shank(), gem('g', 1, 'dia')])
    expect(d.some(f => f.level === 'pass')).toBe(true)
  })
  it('flags mixed hardness', () => {
    const d = durabilityCheck([gem('a', 1, 'dia'), gem('b', 1, 'opa')], 'other')
    expect(d.some(f => /mixed hardness/i.test(f.title))).toBe(true)
  })
})

describe('care sheet lines', () => {
  it('flags ultrasonic-unsafe stones and lists per-stone care', () => {
    const { general, stones } = careLines([gem('g', 1, 'eme')], '14ky')  // emerald: never ultrasonic
    expect(general.some(g => /ultrasonic/i.test(g))).toBe(true)
    expect(stones.length).toBe(1)
  })
})

describe('job ticket', () => {
  it('lists build, parts, bench operations and sign-off', () => {
    const t = jobTicketText([shank(), gem('g', 1)], '14ky', 'Mandrel', { order: '1024' })
    expect(t).toMatch(/JOB TICKET/)
    expect(t).toMatch(/BENCH OPERATIONS/)
    expect(t).toMatch(/SIGN-OFF/)
    expect(t).toMatch(/1024/)
  })
})

describe('payment schedule', () => {
  it('splits a total into deposit + balance', () => {
    const s = paymentSchedule(1000, 0.5)
    expect(s.deposit).toBe(500)
    expect(s.balance).toBe(500)
    expect(s.milestones.length).toBe(2)
  })
  it('3-stage split sums to the total', () => {
    const s = paymentSchedule(1200, 0.4, true)
    expect(s.milestones.length).toBe(3)
    expect(s.milestones.reduce((a, m) => a + m.amount, 0)).toBeCloseTo(1200, 6)
  })
})
