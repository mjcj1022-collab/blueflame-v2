import { bakedVertices } from './sculpt'
import { overhangFraction } from './castCheck'
import type { SculptObject } from '../state/modeler'

/**
 * Find the print orientation that needs the least support. A resin/FDM print
 * fails on downward-facing surface; the same piece flipped or laid on its side
 * often prints far cleaner. We try a handful of 90° flips, measure the
 * downward-facing fraction of the combined metal for each, and return the best.
 */

export interface Orientation {
  rotation: [number, number, number]
  label: string
  fraction: number
}

const CANDIDATES: { rot: [number, number, number]; label: string }[] = [
  { rot: [0, 0, 0], label: 'as-is' },
  { rot: [Math.PI, 0, 0], label: 'upside-down' },
  { rot: [Math.PI / 2, 0, 0], label: 'on its face' },
  { rot: [-Math.PI / 2, 0, 0], label: 'on its back' },
  { rot: [0, 0, Math.PI / 2], label: 'on its right side' },
  { rot: [0, 0, -Math.PI / 2], label: 'on its left side' },
]

/** Rotate a triangle soup about the origin by an Euler XYZ rotation. */
export function rotateSoup(verts: number[], rot: [number, number, number]): number[] {
  const [rx, ry, rz] = rot
  const cx = Math.cos(rx), sx = Math.sin(rx)
  const cy = Math.cos(ry), sy = Math.sin(ry)
  const cz = Math.cos(rz), sz = Math.sin(rz)
  const out = new Array<number>(verts.length)
  for (let i = 0; i + 2 < verts.length; i += 3) {
    let x = verts[i], y = verts[i + 1], z = verts[i + 2]
    // X
    let ny = y * cx - z * sx, nz = y * sx + z * cx; y = ny; z = nz
    // Y
    let nx = x * cy + z * sy; nz = -x * sy + z * cy; x = nx; z = nz
    // Z
    nx = x * cz - y * sz; ny = x * sz + y * cz; x = nx; y = ny
    out[i] = x; out[i + 1] = y; out[i + 2] = z
  }
  return out
}

export function bestPrintOrientation(objects: SculptObject[]): Orientation {
  const soup: number[] = []
  for (const o of objects) if (o.material === 'metal') soup.push(...bakedVertices(o))
  let best: Orientation = { rotation: [0, 0, 0], label: 'as-is', fraction: overhangFraction(soup) }
  for (const cand of CANDIDATES) {
    const f = overhangFraction(cand.rot.every((r) => r === 0) ? soup : rotateSoup(soup, cand.rot))
    if (f < best.fraction - 1e-4) best = { rotation: cand.rot, label: cand.label, fraction: f }
  }
  return best
}
