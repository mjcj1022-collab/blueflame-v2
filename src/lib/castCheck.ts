import { bakedVertices } from './sculpt'
import type { SculptObject } from '../state/modeler'

/**
 * Two maker QA checks over the real placed geometry:
 *  - overhang/support: how much downward-facing surface a resin/FDM print would
 *    need supports under — the maker sees before slicing whether a piece prints
 *    clean or needs a forest of supports through a polished face.
 *  - symmetry: how mirror-symmetric a part is across a plane, so a band or a
 *    pair of shoulders that should match can be checked objectively.
 */

export interface OverhangReport {
  level: 'good' | 'some' | 'heavy'
  fraction: number // 0..1 of metal surface area that is a steep downward overhang
  note: string
}

const cross = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
  [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx] as const

/** Area-weighted fraction of a triangle soup that faces downward more steeply
 *  than `angleDeg` below horizontal (a flat ceiling = 90°, a vertical wall = 0). */
export function overhangFraction(verts: number[], angleDeg = 45): number {
  const cosT = Math.cos((angleDeg * Math.PI) / 180)
  let total = 0, over = 0
  for (let i = 0; i + 8 < verts.length; i += 9) {
    const e1x = verts[i + 3] - verts[i], e1y = verts[i + 4] - verts[i + 1], e1z = verts[i + 5] - verts[i + 2]
    const e2x = verts[i + 6] - verts[i], e2y = verts[i + 7] - verts[i + 1], e2z = verts[i + 8] - verts[i + 2]
    const [nx, ny, nz] = cross(e1x, e1y, e1z, e2x, e2y, e2z)
    const len = Math.hypot(nx, ny, nz)
    if (len < 1e-9) continue
    const area = len / 2
    total += area
    if (-ny / len > cosT) over += area
  }
  return total > 0 ? over / total : 0
}

/** Area-weighted fraction of downward-facing surface steeper than `angleDeg`
 *  below horizontal (a ceiling = 90°). Metal only — you don't print the stones. */
export function overhangReport(objects: SculptObject[], angleDeg = 45): OverhangReport {
  const soup: number[] = []
  for (const o of objects) if (o.material === 'metal') soup.push(...bakedVertices(o))
  const fraction = overhangFraction(soup, angleDeg)
  let level: OverhangReport['level']
  let note: string
  if (fraction < 0.08) { level = 'good'; note = `Prints clean — only ${Math.round(fraction * 100)}% of the surface faces down. Minimal supports.` }
  else if (fraction < 0.25) { level = 'some'; note = `${Math.round(fraction * 100)}% faces down — some supports needed; orient so they land off polished faces.` }
  else { level = 'heavy'; note = `${Math.round(fraction * 100)}% faces down — heavy supports. Re-orient the part or split it before printing.` }
  return { level, fraction, note }
}

export type Axis = 'x' | 'y' | 'z'

/**
 * Symmetry score across a plane through the part's centroid: 1 = perfectly
 * mirror-symmetric, →0 as the two halves diverge. For each sampled vertex we
 * mirror it and find the nearest real vertex; the average gap, normalised by the
 * part size, becomes the score. Sampling caps the cost on dense meshes.
 */
export function symmetryScore(verts: number[], axis: Axis): number {
  const n = verts.length / 3
  if (n < 3) return 1
  const ai = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  // centroid + bounding diagonal for the plane position and normalisation
  let cx = 0, cy = 0, cz = 0
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let i = 0; i < verts.length; i += 3) {
    cx += verts[i]; cy += verts[i + 1]; cz += verts[i + 2]
    minX = Math.min(minX, verts[i]); maxX = Math.max(maxX, verts[i])
    minY = Math.min(minY, verts[i + 1]); maxY = Math.max(maxY, verts[i + 1])
    minZ = Math.min(minZ, verts[i + 2]); maxZ = Math.max(maxZ, verts[i + 2])
  }
  cx /= n; cy /= n; cz /= n
  const centroid = [cx, cy, cz]
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1

  const step = Math.max(1, Math.floor(n / 400)) // sample up to ~400 verts
  let sum = 0, count = 0
  for (let s = 0; s < n; s += step) {
    const i = s * 3
    const mx = [verts[i], verts[i + 1], verts[i + 2]]
    mx[ai] = 2 * centroid[ai] - mx[ai] // reflect across the plane
    // nearest real vertex to the mirrored point
    let best = Infinity
    for (let j = 0; j < verts.length; j += 3) {
      const dx = verts[j] - mx[0], dy = verts[j + 1] - mx[1], dz = verts[j + 2] - mx[2]
      const d = dx * dx + dy * dy + dz * dz
      if (d < best) best = d
      if (best === 0) break
    }
    sum += Math.sqrt(best)
    count++
  }
  const avgGap = count ? sum / count : 0
  return Math.max(0, 1 - avgGap / (diag * 0.25)) // 25% of the diagonal → score 0
}
