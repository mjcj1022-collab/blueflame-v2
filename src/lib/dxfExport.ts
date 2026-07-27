import { bakedVertices } from './sculpt'
import type { SculptObject } from '../state/modeler'

/**
 * DXF (R12 ASCII) top-view export. Projects the metal geometry onto the X–Z plane
 * and writes its triangle edges as LINE entities — a 2D wireframe template a maker
 * loads into a laser engraver, rotary tool, or CAM to align stock, mark a plate,
 * or cut a flat pattern. Not a solid; a true-scale (millimetre) reference outline.
 */

const q = (n: number) => (Math.round(n * 1e4) / 1e4).toFixed(4)

export function modelerToDxf(objects: SculptObject[], opts: { metalOnly?: boolean } = {}): string {
  const seen = new Set<string>()
  const edges: [number, number, number, number][] = []
  const addEdge = (x1: number, z1: number, x2: number, z2: number) => {
    // round to 0.05 mm to weld the many shared triangle edges into one line
    const r = (v: number) => Math.round(v * 20) / 20
    const a = `${r(x1)},${r(z1)}`, b = `${r(x2)},${r(z2)}`
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    if (seen.has(key) || a === b) return
    seen.add(key); edges.push([r(x1), r(z1), r(x2), r(z2)])
  }
  for (const o of objects) {
    if (opts.metalOnly !== false && o.material !== 'metal') continue
    const v = bakedVertices(o)
    for (let i = 0; i + 8 < v.length; i += 9) {
      // triangle corners projected to X–Z (top view)
      const p = [[v[i], v[i + 2]], [v[i + 3], v[i + 5]], [v[i + 6], v[i + 8]]]
      addEdge(p[0][0], p[0][1], p[1][0], p[1][1])
      addEdge(p[1][0], p[1][1], p[2][0], p[2][1])
      addEdge(p[2][0], p[2][1], p[0][0], p[0][1])
    }
  }

  const body: string[] = []
  for (const [x1, z1, x2, z2] of edges) {
    body.push('0', 'LINE', '8', 'BLUEFLAME', '10', q(x1), '20', q(z1), '30', '0.0', '11', q(x2), '21', q(z2), '31', '0.0')
  }
  return [
    '0', 'SECTION', '2', 'ENTITIES',
    ...body,
    '0', 'ENDSEC', '0', 'EOF', '',
  ].join('\n')
}
