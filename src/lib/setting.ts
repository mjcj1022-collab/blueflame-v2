import { bakedVertices } from './sculpt'
import { stoneMm, shapeById } from '../catalog'
import type { SculptObject } from '../state/modeler'

/**
 * Shared geometry helpers for the stone-setting toolkit: how wide a gem actually
 * is once placed, and where the top surface of a part sits at a given (x,z).
 * Both read the same baked, true-millimetre geometry the DFM and seat checks use,
 * so a generated head, bezel or pavé run lands on the real stone/metal — not a
 * nominal guess.
 */

/** The placed girdle diameter of a gem in mm (catalog size × its X scale). */
export function gemDiameterMm(gem: SculptObject): number {
  const shapeId = gem.params?.shapeId ?? 'rd'
  const carat = gem.params?.carat ?? 1
  return stoneMm(shapeById(shapeId), carat).width * (gem.scale?.[0] ?? 1)
}

/**
 * Cast a ray straight down from high above (x,z) and return the Y of the topmost
 * surface it hits — the point a stone dropped there would rest on. Möller–Trumbore
 * against the raw triangle soup; no BVH needed for the small parts this runs on.
 * Returns null if the column misses the part entirely.
 */
export function surfaceTopAt(x: number, z: number, verts: number[], fromY = 1e4): number | null {
  let best: number | null = null
  // vertical ray: origin (x, fromY, z), direction (0,-1,0)
  for (let i = 0; i + 8 < verts.length; i += 9) {
    const ax = verts[i], ay = verts[i + 1], az = verts[i + 2]
    const bx = verts[i + 3], by = verts[i + 4], bz = verts[i + 5]
    const cx = verts[i + 6], cy = verts[i + 7], cz = verts[i + 8]
    // edges
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az
    // p = dir × e2, dir = (0,-1,0) → p = (-1*e2z - 0, 0 - 0, 0 - -1*e2x) = (-e2z, 0, e2x)
    const px = -e2z, py = 0, pz = e2x
    const det = e1x * px + e1y * py + e1z * pz
    if (Math.abs(det) < 1e-9) continue
    const inv = 1 / det
    const tx = x - ax, ty = fromY - ay, tz = z - az
    const u = (tx * px + ty * py + tz * pz) * inv
    if (u < -1e-6 || u > 1 + 1e-6) continue
    // q = t × e1
    const qx = ty * e1z - tz * e1y
    const qy = tz * e1x - tx * e1z
    const qz = tx * e1y - ty * e1x
    // v = dir · q = (0,-1,0)·q = -qy
    const v = -qy * inv
    if (v < -1e-6 || u + v > 1 + 1e-6) continue
    // hit distance along dir: t = e2 · q * inv
    const dist = (e2x * qx + e2y * qy + e2z * qz) * inv
    if (dist < 0) continue
    const hitY = fromY - dist
    if (best === null || hitY > best) best = hitY
  }
  return best
}

/** Convenience: top surface of a whole object's placed geometry at (x,z). */
export function objectTopAt(o: SculptObject, x: number, z: number): number | null {
  return surfaceTopAt(x, z, bakedVertices(o))
}

/** The highest point of a part (baked), used to hang a bail off the top. */
export function objectTop(o: SculptObject): [number, number, number] {
  const v = bakedVertices(o)
  let top = -Infinity, tx = 0, tz = 0
  for (let i = 0; i + 2 < v.length; i += 3) {
    if (v[i + 1] > top) { top = v[i + 1]; tx = v[i]; tz = v[i + 2] }
  }
  return isFinite(top) ? [tx, top, tz] : [0, 0, 0]
}
