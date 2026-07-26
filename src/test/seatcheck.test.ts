import { describe, it, expect } from 'vitest'
import { seatReport } from '../lib/seatCheck'
import { stoneMm, shapeById } from '../catalog'
import type { SculptObject } from '../state/modeler'

// A ring of metal points at the girdle radius R around the origin, spanning up
// to `top` in height — mimics prong/bezel metal that wraps and locks the stone.
const metalRing = (R: number, heights: number[]): number[] => {
  const v: number[] = []
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2
    for (const y of heights) v.push(Math.cos(ang) * R, y, Math.sin(ang) * R)
  }
  return v
}

// Minimal object factory — only the fields seatReport reads.
const obj = (p: Partial<SculptObject>): SculptObject => ({
  id: Math.random().toString(36).slice(2),
  kind: 'mesh',
  name: 'part',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  size: 0,
  material: 'metal',
  color: 0,
  ...p,
})

const gem = (over: Partial<SculptObject> = {}) =>
  obj({ material: 'gem', kind: 'gem', position: [0, 0, 0], params: { shapeId: 'rd', carat: 1 }, ...over })

describe('seatReport', () => {
  it('reports none with no gem', () => {
    expect(seatReport([obj({})]).level).toBe('none')
  })

  it('reports none with a gem but no metal', () => {
    const r = seatReport([gem()])
    expect(r.level).toBe('none')
    expect(r.girdleR).toBe(0)
  })

  it('fails when metal sits below the girdle (nothing locks the stone in)', () => {
    // A box of metal entirely beneath the stone — no coverage at girdle height,
    // nothing rising above it.
    const g = gem()
    const metal = obj({ kind: 'box', size: 2, position: [0, -5, 0] })
    const r = seatReport([g, metal])
    expect(r.level).toBe('fail')
    expect(r.aboveGirdle).toBeLessThanOrEqual(0)
  })

  it('passes when metal wraps the girdle and rises above it', () => {
    // Metal points ring the girdle all the way around and rise well above it —
    // a secure hold.
    const g = gem()
    const R = stoneMm(shapeById('rd'), 1).width / 2
    const metal = obj({ kind: 'mesh', vertices: metalRing(R, [0, 0.8]) })
    const r = seatReport([g, metal])
    expect(r.girdleR).toBeCloseTo(R, 3)
    expect(r.aboveGirdle).toBeCloseTo(0.8, 3)
    expect(r.coverage).toBe(1)
    expect(r.level).toBe('pass')
  })
})
