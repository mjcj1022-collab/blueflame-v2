import { bakedVertices, boundingSize } from './sculpt'
import type { SculptObject } from '../state/modeler'

/**
 * SVG technical drawing — a scaled, dimensioned top view for the tech pack or the
 * shop wall. Projects the metal geometry to the X–Z plane as a faint wireframe
 * inside a dimensioned frame (overall width × depth, and a height note), so the
 * maker has a true-scale reference of the piece, not just numbers. Renders inline.
 */

export interface SvgSpecInput {
  brand: string
  name: string
  ringSize?: number
}

export function modelerToSvg(objects: SculptObject[], input: SvgSpecInput): string {
  const metal = objects.filter(o => o.material !== 'gem')
  // Collect projected edges + bounds (X–Z), and overall height (Y).
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, height = 0
  const edges: [number, number, number, number][] = []
  const seen = new Set<string>()
  for (const o of (metal.length ? metal : objects)) {
    height = Math.max(height, boundingSize(o)[1])
    const v = bakedVertices(o)
    for (let i = 0; i + 8 < v.length; i += 9) {
      const p = [[v[i], v[i + 2]], [v[i + 3], v[i + 5]], [v[i + 6], v[i + 8]]]
      for (const [x, z] of p) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z) }
      const e = (a: number[], b: number[]) => {
        const r = (n: number) => Math.round(n * 10) / 10
        const ka = `${r(a[0])},${r(a[1])}`, kb = `${r(b[0])},${r(b[1])}`
        const key = ka < kb ? ka + '|' + kb : kb + '|' + ka
        if (ka === kb || seen.has(key)) return
        seen.add(key); edges.push([a[0], a[1], b[0], b[1]])
      }
      e(p[0], p[1]); e(p[1], p[2]); e(p[2], p[0])
    }
  }
  if (!isFinite(minX)) { minX = 0; maxX = 10; minZ = 0; maxZ = 10 }

  const wmm = Math.max(0.1, maxX - minX), dmm = Math.max(0.1, maxZ - minZ)
  const PAD = 60, MAXPX = 360
  const scale = Math.min(MAXPX / wmm, MAXPX / dmm)
  const W = wmm * scale, H = dmm * scale
  const svgW = W + PAD * 2, svgH = H + PAD * 2 + 30
  const tx = (x: number) => PAD + (x - minX) * scale
  const tz = (z: number) => PAD + (z - minZ) * scale

  const path = edges.map(([x1, z1, x2, z2]) => `M${tx(x1).toFixed(1)} ${tz(z1).toFixed(1)} L${tx(x2).toFixed(1)} ${tz(z2).toFixed(1)}`).join('')
  const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}" font-family="monospace" font-size="11">
 <rect width="100%" height="100%" fill="#fff"/>
 <text x="${PAD}" y="24" font-size="13" font-weight="bold">${esc(input.brand)} — ${esc(input.name)}</text>
 <text x="${PAD}" y="40" fill="#6C737D">Top view · true scale · millimetres</text>
 <rect x="${PAD}" y="${PAD}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="none" stroke="#E6E8EC"/>
 <path d="${path}" fill="none" stroke="#1B2024" stroke-width="0.6" opacity="0.85"/>
 <line x1="${PAD}" y1="${(PAD + H + 16).toFixed(1)}" x2="${(PAD + W).toFixed(1)}" y2="${(PAD + H + 16).toFixed(1)}" stroke="#1F8A6B"/>
 <text x="${(PAD + W / 2).toFixed(1)}" y="${(PAD + H + 30).toFixed(1)}" fill="#1F8A6B" text-anchor="middle">${wmm.toFixed(1)} mm</text>
 <line x1="${(PAD + W + 16).toFixed(1)}" y1="${PAD}" x2="${(PAD + W + 16).toFixed(1)}" y2="${(PAD + H).toFixed(1)}" stroke="#1F8A6B"/>
 <text x="${(PAD + W + 22).toFixed(1)}" y="${(PAD + H / 2).toFixed(1)}" fill="#1F8A6B" transform="rotate(90 ${(PAD + W + 22).toFixed(1)} ${(PAD + H / 2).toFixed(1)})" text-anchor="middle">${dmm.toFixed(1)} mm</text>
 <text x="${PAD}" y="${(svgH - 8).toFixed(1)}" fill="#6C737D">Height ${height.toFixed(1)} mm${input.ringSize != null ? ` · ring size US ${input.ringSize}` : ''}</text>
</svg>`
}
