import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'

/**
 * Wall-thickness heat-map. For each vertex we ray-cast inward along the surface
 * normal to the opposite wall; the distance is the local thickness. Thin metal
 * casts porous or snaps, so we colour it: red below the minimum, amber near it,
 * green with healthy margin — the maker sees fragile spots at a glance.
 */

export const HEATMAP_MIN_WALL = 0.8   // mm — casting/printing floor

/** Map a thickness (mm) to an RGB colour, written into `out`. */
export function thicknessColor(t: number, minWall: number, out: THREE.Color): THREE.Color {
  const good = minWall * 1.6
  if (!isFinite(t)) return out.setRGB(0.45, 0.62, 0.55)          // unmeasured → muted grey-green
  if (t >= good) return out.setRGB(0.30, 0.70, 0.42)             // green — healthy
  if (t >= minWall) {                                            // amber → green
    const f = (t - minWall) / (good - minWall)
    return out.setRGB(0.86 - 0.56 * f, 0.62 + 0.08 * f, 0.24 + 0.18 * f)
  }
  const f = Math.max(0, Math.min(1, t / minWall))                // red → amber
  return out.setRGB(0.84, 0.18 + 0.44 * f, 0.16)
}

/**
 * Per-vertex thickness colours for a geometry. Returns a Float32Array of RGB
 * (3 per vertex, same order as the position attribute), or null if it can't
 * build a BVH. Works on indexed or non-indexed geometry. Does not mutate input.
 */
export function wallThicknessColors(geometry: THREE.BufferGeometry, minWall = HEATMAP_MIN_WALL): Float32Array | null {
  const geo = geometry.clone()
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  const pos = geo.getAttribute('position')
  const nrm = geo.getAttribute('normal')
  if (!pos || pos.count < 3) { geo.dispose(); return null }

  let bvh: MeshBVH
  try { bvh = new MeshBVH(geo) } catch { geo.dispose(); return null }

  const colors = new Float32Array(pos.count * 3)
  const ray = new THREE.Ray()
  const dir = new THREE.Vector3()
  const col = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    dir.set(-nrm.getX(i), -nrm.getY(i), -nrm.getZ(i))
    if (dir.lengthSq() < 1e-9) { thicknessColor(Infinity, minWall, col) }
    else {
      dir.normalize()
      ray.origin.set(pos.getX(i), pos.getY(i), pos.getZ(i)).addScaledVector(dir, 1e-3)
      ray.direction.copy(dir)
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide)
      const t = hit && hit.distance > 1e-3 ? hit.distance + 1e-3 : Infinity
      thicknessColor(t, minWall, col)
    }
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b
  }
  geo.dispose()
  return colors
}
