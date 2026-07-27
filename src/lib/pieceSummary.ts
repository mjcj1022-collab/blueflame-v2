import { bakedVertices, sculptMetalVolume, sculptWarnings } from './sculpt'
import { alloyById } from '../catalog'
import type { SculptObject } from '../state/modeler'

/**
 * A one-glance spec sheet for the whole piece: overall size, cast weight in the
 * chosen alloy, total stone count and carats, and how many castability warnings
 * are outstanding. The maker copies this straight into a bench note or an order.
 */

export interface PieceSummary {
  dims: [number, number, number] // overall bounding size, mm
  volumeMm3: number
  castG: number
  carats: number
  gemCount: number
  metalParts: number
  warnings: number
}

export function pieceSummary(objects: SculptObject[], alloyId: string): PieceSummary {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const o of objects) {
    const v = bakedVertices(o)
    for (let i = 0; i + 2 < v.length; i += 3) {
      minX = Math.min(minX, v[i]); maxX = Math.max(maxX, v[i])
      minY = Math.min(minY, v[i + 1]); maxY = Math.max(maxY, v[i + 1])
      minZ = Math.min(minZ, v[i + 2]); maxZ = Math.max(maxZ, v[i + 2])
    }
  }
  const has = isFinite(minX)
  const dims: [number, number, number] = has ? [maxX - minX, maxY - minY, maxZ - minZ] : [0, 0, 0]

  const volumeMm3 = sculptMetalVolume(objects)
  const alloy = alloyById(alloyId)
  const castG = (volumeMm3 / 1000) * alloy.density
  const gems = objects.filter((o) => o.material === 'gem')
  const carats = gems.reduce((s, g) => s + (g.params?.carat ?? 0), 0)

  return {
    dims, volumeMm3, castG,
    carats, gemCount: gems.length,
    metalParts: objects.filter((o) => o.material === 'metal').length,
    warnings: sculptWarnings(objects).length,
  }
}

export function pieceSummaryText(s: PieceSummary, alloyName: string): string {
  const [w, h, d] = s.dims
  return [
    `Overall: ${w.toFixed(1)} × ${h.toFixed(1)} × ${d.toFixed(1)} mm`,
    `Metal: ${s.metalParts} part${s.metalParts === 1 ? '' : 's'}, ${s.castG.toFixed(2)} g cast in ${alloyName}`,
    `Stones: ${s.gemCount} (${s.carats.toFixed(2)} ct total)`,
    `Castability warnings: ${s.warnings}`,
  ].join('\n')
}
