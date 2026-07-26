import { describe, it, expect } from 'vitest'
import { paveSpots, paveSpacing, ringRadiusFor } from '../lib/pave'

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('paveSpacing', () => {
  it('is diameter plus gap', () => {
    expect(paveSpacing(2, 0.3)).toBeCloseTo(2.3, 6)
  })
  it('never goes to zero or negative', () => {
    expect(paveSpacing(0, -5)).toBeGreaterThan(0)
  })
})

describe('row pavé', () => {
  it('places count stones, evenly spaced, centred on the anchor', () => {
    const spots = paveSpots({ count: 5, diameter: 2, gap: 0.3, mode: 'row' })
    expect(spots).toHaveLength(5)
    // even centre-to-centre spacing
    for (let i = 1; i < spots.length; i++) {
      expect(dist(spots[i].position, spots[i - 1].position)).toBeCloseTo(2.3, 6)
    }
    // symmetric about x=0 (odd count → middle stone at origin)
    expect(spots[2].position[0]).toBeCloseTo(0, 6)
    expect(spots[0].position[0]).toBeCloseTo(-spots[4].position[0], 6)
  })

  it('honours the anchor centre', () => {
    const [s] = paveSpots({ count: 1, diameter: 2, gap: 0.3, mode: 'row', center: [3, 4, 5] })
    expect(s.position).toEqual([3, 4, 5])
  })
})

describe('ring pavé', () => {
  it('spaces a full eternity band so adjacent stones sit one spacing apart', () => {
    const count = 12
    const spots = paveSpots({ count, diameter: 2, gap: 0.3, mode: 'ring' })
    expect(spots).toHaveLength(count)
    // chord between neighbours ≈ the spacing that sized the ring
    const chord = dist(spots[0].position, spots[1].position)
    expect(chord).toBeCloseTo(paveSpacing(2, 0.3), 4)
    // all stones lie on one circle (equal radius from centre)
    const r0 = Math.hypot(spots[0].position[0], spots[0].position[2])
    for (const s of spots) expect(Math.hypot(s.position[0], s.position[2])).toBeCloseTo(r0, 4)
  })

  it('uses an explicit radius when given', () => {
    const spots = paveSpots({ count: 6, diameter: 2, gap: 0.3, mode: 'ring', radius: 9 })
    for (const s of spots) expect(Math.hypot(s.position[0], s.position[2])).toBeCloseTo(9, 4)
  })

  it('derived radius matches the closed-form helper', () => {
    const r = ringRadiusFor(20, 1.5, 0.2, 360)
    const spots = paveSpots({ count: 20, diameter: 1.5, gap: 0.2, mode: 'ring' })
    expect(Math.hypot(spots[0].position[0], spots[0].position[2])).toBeCloseTo(r, 4)
  })

  it('yaws each stone to follow the band tangent', () => {
    const spots = paveSpots({ count: 4, diameter: 2, gap: 0.3, mode: 'ring' })
    // first stone at angle 0 → no yaw; quarter-way round → -90°
    expect(spots[0].rotation[1]).toBeCloseTo(0, 6)
    expect(spots[1].rotation[1]).toBeCloseTo(-Math.PI / 2, 6)
  })
})
