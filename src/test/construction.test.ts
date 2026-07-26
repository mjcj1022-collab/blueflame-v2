import { describe, it, expect } from 'vitest'
import { haloRadius, channelRailSpots } from '../lib/construction'

describe('haloRadius', () => {
  it('sits the accents just outside the centre stone', () => {
    // centre 6mm (r=3), accents 1.5mm (r=0.75), gap 0.15 → 3 + 0.75 + 0.15
    expect(haloRadius(6, 1.5, 0.15)).toBeCloseTo(3.9, 6)
  })
  it('ignores a negative gap', () => {
    expect(haloRadius(6, 1.5, -1)).toBeCloseTo(3.75, 6)
  })
})

describe('channelRailSpots', () => {
  it('offsets a pair of rails symmetrically across an X run', () => {
    const [a, b] = channelRailSpots({ center: [0, 1, 0], length: 12, innerGap: 2, height: 2, thickness: 0.8, along: 'x' })
    // offset = innerGap/2 + thickness/2 = 1 + 0.4 = 1.4, applied on Z
    expect(a.position).toEqual([0, 1, -1.4])
    expect(b.position).toEqual([0, 1, 1.4])
    // rail spans the run length in X, thickness in Z
    expect(a.scale).toEqual([12, 2, 0.8])
  })

  it('offsets across X for a Z run and orients the box the other way', () => {
    const [a, b] = channelRailSpots({ center: [5, 0, 5], length: 10, innerGap: 3, height: 1.5, thickness: 1, along: 'z' })
    // offset = 1.5 + 0.5 = 2 on X
    expect(a.position).toEqual([3, 0, 5])
    expect(b.position).toEqual([7, 0, 5])
    expect(a.scale).toEqual([1, 1.5, 10]) // length now runs along Z
  })
})
