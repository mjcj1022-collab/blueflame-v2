import { describe, it, expect } from 'vitest'
import { textureSoup } from '../lib/texture'
import { milgrainSpots, milgrainCount, bridgePath } from '../lib/finishing'

// one unit triangle in the XZ plane (normal +Y)
const tri = [0, 0, 0, 1, 0, 0, 0, 0, 1]

describe('textureSoup', () => {
  it('keeps the vertex count and displaces within the amplitude', () => {
    const out = textureSoup(tri, 'hammered', 0.2, 1)
    expect(out.length).toBe(tri.length)
    // displacement is along +/-Y (triangle normal); bounded by amp
    for (let i = 0; i < out.length; i += 3) {
      expect(Math.abs(out[i + 1] - tri[i + 1])).toBeLessThanOrEqual(0.2 + 1e-9)
      expect(out[i]).toBeCloseTo(tri[i], 6)     // no X drift
      expect(out[i + 2]).toBeCloseTo(tri[i + 2], 6) // no Z drift
    }
  })

  it('welds shared corners: two triangles sharing a vertex move it identically', () => {
    // two triangles sharing corner (0,0,0)
    const soup = [
      0, 0, 0, 1, 0, 0, 0, 0, 1,
      0, 0, 0, 0, 0, 1, -1, 0, 0,
    ]
    const out = textureSoup(soup, 'stipple', 0.3, 1)
    // the shared (0,0,0) is verts index 0 and index 9
    expect(out.slice(0, 3)).toEqual(out.slice(9, 12))
  })

  it('is deterministic', () => {
    expect(textureSoup(tri, 'florentine', 0.2, 1)).toEqual(textureSoup(tri, 'florentine', 0.2, 1))
  })
})

describe('milgrain', () => {
  it('places count beads evenly on a circle', () => {
    const spots = milgrainSpots(5, 8, 2)
    expect(spots).toHaveLength(8)
    for (const s of spots) {
      expect(Math.hypot(s.position[0], s.position[2])).toBeCloseTo(5, 6)
      expect(s.position[1]).toBe(2)
    }
  })
  it('auto-counts beads from circumference', () => {
    // circumference 2π·5 ≈ 31.4, /0.5 ≈ 63
    expect(milgrainCount(5, 0.5)).toBe(63)
    expect(milgrainCount(0, 0.5)).toBe(0)
  })
})

describe('bridgePath', () => {
  it('returns start, bowed middle, end', () => {
    const p = bridgePath([4, 0, 0], [0, 0, 4], 0.25)
    expect(p).toHaveLength(3)
    expect(p[0]).toEqual([4, 0, 0])
    expect(p[2]).toEqual([0, 0, 4])
    // midpoint pushed radially outward from the Y axis
    const mid = p[1]
    expect(Math.hypot(mid[0], mid[2])).toBeGreaterThan(Math.hypot(2, 2))
  })
})
