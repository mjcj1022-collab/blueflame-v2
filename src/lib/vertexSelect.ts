/**
 * Geometry for ArcGIS-style vertex editing on a flat triangle soup:
 *   pointInPolygon      — hit-test a screen point against a lasso outline
 *   moveVertsBy         — translate a selected group of vertices together
 *   deleteVerticesFromSoup — drop every triangle that uses a selected vertex
 *   groupCentroid       — the centre of a vertex group (gizmo anchor)
 * All pure and independently testable; the viewer does the screen projection and
 * feeds indices in.
 */

/** Ray-cast point-in-polygon. `poly` is a list of [x,y] screen points. */
export function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Translate the given vertex indices by (dx,dy,dz); returns a new soup. */
export function moveVertsBy(vertices: number[], indices: number[], d: [number, number, number]): number[] {
  const out = vertices.slice()
  for (const i of indices) {
    const b = i * 3
    if (b + 2 >= out.length || b < 0) continue
    out[b] += d[0]; out[b + 1] += d[1]; out[b + 2] += d[2]
  }
  return out
}

/**
 * Delete selected vertices from a triangle soup by removing every triangle that
 * references any of them (a soup has no shared topology, so a "vertex" delete is
 * a triangle cull). Returns a new soup.
 */
export function deleteVerticesFromSoup(vertices: number[], indices: number[]): number[] {
  const kill = new Set(indices)
  const out: number[] = []
  const triCount = Math.floor(vertices.length / 9)
  for (let t = 0; t < triCount; t++) {
    const a = t * 3, b = t * 3 + 1, c = t * 3 + 2
    if (kill.has(a) || kill.has(b) || kill.has(c)) continue
    out.push(...vertices.slice(t * 9, t * 9 + 9))
  }
  return out
}

/** Centroid of a vertex group, the natural anchor for a move gizmo. */
export function groupCentroid(vertices: number[], indices: number[]): [number, number, number] {
  if (!indices.length) return [0, 0, 0]
  let x = 0, y = 0, z = 0, n = 0
  for (const i of indices) {
    const b = i * 3
    if (b + 2 >= vertices.length || b < 0) continue
    x += vertices[b]; y += vertices[b + 1]; z += vertices[b + 2]; n++
  }
  return n ? [x / n, y / n, z / n] : [0, 0, 0]
}
