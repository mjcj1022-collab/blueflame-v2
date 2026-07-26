/**
 * Pavé / channel auto-fill layout.
 *
 * Placing a run of small stones by hand — even spacing, straight line, no drift —
 * is one of the most tedious things a maker does. This computes the placements
 * for a row (a channel or pavé strip) or a ring (an eternity band) from a stone
 * size and a metal gap, so the tool drops the whole run at once. Pure geometry:
 * the store turns these spots into gem parts and seat cutters.
 *
 * All distances are millimetres; the coordinate frame is the modeler's (Y up).
 */

export interface PaveSpot {
  position: [number, number, number]
  rotation: [number, number, number]
}

export type PaveMode = 'row' | 'ring'

export interface PaveOptions {
  count: number
  diameter: number // stone girdle diameter (mm)
  gap: number // metal left between adjacent stones (mm)
  mode: PaveMode
  center?: [number, number, number] // anchor; default origin
  /** ring: circle radius (mm). If omitted, derived so the run just fits. */
  radius?: number
  /** ring: sweep in degrees. 360 = full eternity (evenly closed). Default 360. */
  arcDeg?: number
}

/** Centre-to-centre spacing for a run of stones. */
export const paveSpacing = (diameter: number, gap: number) => Math.max(0.01, diameter + Math.max(0, gap))

/**
 * The radius a ring needs so `count` stones at this spacing sit evenly around the
 * given sweep. For a full circle the arc between centres is 360/count; for a
 * partial arc it's arcDeg/(count-1). radius = spacing / (2·sin(halfArc)).
 */
export function ringRadiusFor(count: number, diameter: number, gap: number, arcDeg = 360): number {
  const s = paveSpacing(diameter, gap)
  const n = Math.max(1, count)
  const full = arcDeg >= 359.999
  const stepDeg = full ? 360 / n : arcDeg / Math.max(1, n - 1)
  const half = (stepDeg * Math.PI) / 360 // half the angular step, in radians
  if (half <= 1e-6) return (s * n) / (2 * Math.PI)
  return s / (2 * Math.sin(half))
}

export function paveSpots(o: PaveOptions): PaveSpot[] {
  const count = Math.max(0, Math.floor(o.count))
  if (count === 0) return []
  const [cx, cy, cz] = o.center ?? [0, 0, 0]
  const s = paveSpacing(o.diameter, o.gap)

  if (o.mode === 'row') {
    const total = (count - 1) * s
    const spots: PaveSpot[] = []
    for (let i = 0; i < count; i++) {
      spots.push({ position: [cx - total / 2 + i * s, cy, cz], rotation: [0, 0, 0] })
    }
    return spots
  }

  // ring
  const arcDeg = o.arcDeg ?? 360
  const full = arcDeg >= 359.999
  const r = o.radius && o.radius > 0 ? o.radius : ringRadiusFor(count, o.diameter, o.gap, arcDeg)
  const spots: PaveSpot[] = []
  const startRad = full ? 0 : -(arcDeg * Math.PI) / 360 // centre a partial arc on +X
  const stepRad = full
    ? (2 * Math.PI) / count
    : count > 1
      ? (arcDeg * Math.PI) / 180 / (count - 1)
      : 0
  for (let i = 0; i < count; i++) {
    const a = startRad + i * stepRad
    spots.push({
      position: [cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r],
      // yaw each stone to follow the band tangent (table stays up)
      rotation: [0, -a, 0],
    })
  }
  return spots
}
