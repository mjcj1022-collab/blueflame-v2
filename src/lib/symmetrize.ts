import type { Axis } from './castCheck'

/**
 * Force a triangle soup perfectly symmetric across the plane through its centre
 * on `axis`: keep the triangles on the chosen side and append a mirrored copy of
 * each (reflected across the plane, winding reversed so normals stay outward).
 * The companion to the symmetry *check* — when the two halves should match, this
 * makes them match exactly.
 */
export function symmetrizeSoup(verts: number[], axis: Axis, keepPositive = true): number[] {
  if (verts.length < 9) return verts.slice()
  const ai = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  let mn = Infinity, mx = -Infinity
  for (let i = ai; i < verts.length; i += 3) { mn = Math.min(mn, verts[i]); mx = Math.max(mx, verts[i]) }
  const c = (mn + mx) / 2
  const sign = keepPositive ? 1 : -1

  const out: number[] = []
  for (let i = 0; i + 8 < verts.length; i += 9) {
    const cc = (verts[i + ai] + verts[i + 3 + ai] + verts[i + 6 + ai]) / 3
    if ((cc - c) * sign < 0) continue // drop the discarded half
    const t = verts.slice(i, i + 9)
    out.push(...t)
    // mirror across the plane, then reverse winding (swap 2nd & 3rd vertex)
    const m = t.slice()
    m[ai] = 2 * c - m[ai]; m[3 + ai] = 2 * c - m[3 + ai]; m[6 + ai] = 2 * c - m[6 + ai]
    out.push(m[0], m[1], m[2], m[6], m[7], m[8], m[3], m[4], m[5])
  }
  return out
}
