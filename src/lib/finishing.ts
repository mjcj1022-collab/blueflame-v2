/**
 * Placement math for finishing details: a milgrain bead ring, and a bridged wire
 * path between two points. Pure — the store turns spots into small spheres and a
 * swept tube. Millimetres, modeler frame (Y up).
 */

export interface BeadSpot {
  position: [number, number, number]
}

/** Evenly-spaced beads around a circle at a height — a milgrain rim. */
export function milgrainSpots(radius: number, count: number, y = 0, cx = 0, cz = 0): BeadSpot[] {
  const n = Math.max(0, Math.floor(count))
  const spots: BeadSpot[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    spots.push({ position: [cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius] })
  }
  return spots
}

/** How many beads of a given size fit around a circle without crowding. */
export function milgrainCount(radius: number, beadDiameter: number): number {
  if (radius <= 0 || beadDiameter <= 0) return 0
  return Math.max(3, Math.round((2 * Math.PI * radius) / beadDiameter))
}

/**
 * A gently-arced path between two points, bowed outward from the origin so a
 * bridge wire reads as a curve rather than a straight strut. Returns 3 control
 * points suitable for a Catmull-Rom sweep.
 */
export function bridgePath(
  a: [number, number, number],
  b: [number, number, number],
  bow = 0.25
): [number, number, number][] {
  const mid: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  // push the midpoint radially outward from the Y axis (or straight up if central)
  const rad = Math.hypot(mid[0], mid[2])
  let ox = 0, oz = 0, oy = 0
  if (rad > 1e-3) { ox = (mid[0] / rad) * len * bow; oz = (mid[2] / rad) * len * bow }
  else oy = len * bow
  return [a, [mid[0] + ox, mid[1] + oy, mid[2] + oz], b]
}
