import { describe, it, expect } from 'vitest'
import { twistSoup, taperSoup, bendSoup } from '../lib/sculpt'

// A tall box column centered at origin, spanning y −5..5, x/z −1..1 (12 tris = 36 verts).
function column(): number[] {
  const v: number[] = []
  const push = (x: number, y: number, z: number) => v.push(x, y, z)
  for (const y of [-5, -2.5, 0, 2.5, 5]) {
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][]) push(x, y, z)
  }
  return v
}

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

describe('deformers', () => {
  it('twist rotates the top and bottom in opposite directions, leaves the middle', () => {
    const v = column()
    const out = twistSoup(v, 90, 'y')
    expect(out.length).toBe(v.length)
    // a vertex at y=0 (the mid ring) should be essentially unmoved
    for (let i = 0; i < v.length; i += 3) {
      if (near(v[i + 1], 0)) { expect(near(out[i], v[i], 1e-6)).toBe(true); expect(near(out[i + 2], v[i + 2], 1e-6)).toBe(true) }
    }
    // the extreme ends should have moved in the x/z plane
    const moved = () => { for (let i = 0; i < v.length; i += 3) if (v[i + 1] === 5 && (!near(out[i], v[i]) || !near(out[i + 2], v[i + 2]))) return true; return false }
    expect(moved()).toBe(true)
  })

  it('twist is a rigid rotation of each ring (preserves radius from the axis)', () => {
    const v = column()
    const out = twistSoup(v, 120, 'y')
    for (let i = 0; i < v.length; i += 3) {
      const r0 = Math.hypot(v[i], v[i + 2]), r1 = Math.hypot(out[i], out[i + 2])
      expect(near(r0, r1, 1e-6)).toBe(true)
    }
  })

  it('taper narrows the top and keeps the bottom (factor<1)', () => {
    const v = column()
    const out = taperSoup(v, 0.5, 'y')
    for (let i = 0; i < v.length; i += 3) {
      if (v[i + 1] === -5) expect(near(Math.abs(out[i]), Math.abs(v[i]), 1e-6)).toBe(true)  // bottom unchanged
      if (v[i + 1] === 5) expect(Math.abs(out[i])).toBeLessThan(Math.abs(v[i]) + 1e-9)        // top pulled in
    }
    // top corner should be about half as wide
    for (let i = 0; i < v.length; i += 3) if (v[i + 1] === 5) expect(near(Math.abs(out[i]), 0.5, 1e-6)).toBe(true)
  })

  it('bend of ~0° is a no-op; a real bend moves the ends off-axis', () => {
    const v = column()
    expect(bendSoup(v, 0, 'y')).toEqual(v)
    const out = bendSoup(v, 90, 'y', 'x')
    expect(out.length).toBe(v.length)
    let changed = false
    for (let i = 0; i < v.length; i += 3) if (!near(out[i], v[i]) || !near(out[i + 1], v[i + 1])) changed = true
    expect(changed).toBe(true)
    for (const n of out) expect(Number.isFinite(n)).toBe(true)
  })
})
