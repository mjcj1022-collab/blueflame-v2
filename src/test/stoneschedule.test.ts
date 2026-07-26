import { describe, it, expect } from 'vitest'
import { stoneSchedule, stoneScheduleText } from '../lib/stoneSchedule'
import type { SculptObject } from '../state/modeler'

const gem = (carat: number, shapeId = 'rd', over: Partial<SculptObject> = {}): SculptObject => ({
  id: Math.random().toString(36).slice(2), kind: 'gem', name: 'g',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6,
  material: 'gem', color: 0, params: { shapeId, carat }, ...over,
})
const metal = (): SculptObject => ({
  id: Math.random().toString(36).slice(2), kind: 'box', name: 'm',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 4, material: 'metal', color: 0,
})

describe('stoneSchedule', () => {
  it('groups identical stones and sums their carats', () => {
    const objs = [gem(1), gem(0.03), gem(0.03), gem(0.03), metal()]
    const s = stoneSchedule(objs)
    expect(s.totalStones).toBe(4)
    expect(s.totalCarat).toBeCloseTo(1.09, 6)
    // two groups: the 1ct centre and the 0.03ct accents
    expect(s.rows).toHaveLength(2)
    // largest first
    expect(s.rows[0].carat).toBe(1)
    expect(s.rows[0].count).toBe(1)
    expect(s.rows[1].carat).toBe(0.03)
    expect(s.rows[1].count).toBe(3)
    expect(s.rows[1].totalCarat).toBeCloseTo(0.09, 6)
  })

  it('separates different shapes at the same carat', () => {
    const s = stoneSchedule([gem(0.5, 'rd'), gem(0.5, 'pr')])
    expect(s.rows).toHaveLength(2)
  })

  it('ignores metal parts and handles an empty scene', () => {
    expect(stoneSchedule([metal()]).totalStones).toBe(0)
    expect(stoneScheduleText(stoneSchedule([]))).toMatch(/No stones/)
  })

  it('text lists each group and a total', () => {
    const txt = stoneScheduleText(stoneSchedule([gem(1), gem(0.03), gem(0.03)]))
    expect(txt).toMatch(/1 × Round 1 ct/)
    expect(txt).toMatch(/2 × Round 0.03 ct/)
    expect(txt).toMatch(/Total: 3 stones/)
  })
})
