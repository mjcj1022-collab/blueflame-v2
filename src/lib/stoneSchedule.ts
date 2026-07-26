import { shapeById, stoneMm } from '../catalog'
import type { SculptObject } from '../state/modeler'

/**
 * A stone schedule — the "how many of what to order" list a maker hands to a
 * supplier. Groups every gem in the scene by shape and size, so scattered pavé,
 * a centre stone and a halo collapse into "24 × 1.3 mm round, 1 × 6.5 mm round".
 * Pure over the object list.
 */

export interface StoneRow {
  shapeId: string
  shapeName: string
  carat: number // per stone
  mm: number // per-stone girdle diameter
  count: number
  totalCarat: number
}

export interface StoneSchedule {
  rows: StoneRow[]
  totalStones: number
  totalCarat: number
}

const key = (shapeId: string, carat: number) => `${shapeId}|${carat.toFixed(3)}`

export function stoneSchedule(objects: SculptObject[]): StoneSchedule {
  const groups = new Map<string, StoneRow>()
  let totalStones = 0
  let totalCarat = 0

  for (const o of objects) {
    if (o.material !== 'gem') continue
    const shapeId = o.params?.shapeId ?? 'rd'
    const carat = o.params?.carat ?? 0
    const scale = o.scale?.[0] ?? 1
    const shape = shapeById(shapeId)
    const mm = stoneMm(shape, carat).width * scale
    const k = key(shapeId, carat)
    const row = groups.get(k)
    if (row) {
      row.count += 1
      row.totalCarat += carat
    } else {
      groups.set(k, { shapeId, shapeName: shape.name, carat, mm, count: 1, totalCarat: carat })
    }
    totalStones += 1
    totalCarat += carat
  }

  // largest stones first — the centre stone reads at the top
  const rows = [...groups.values()].sort((a, b) => b.carat - a.carat)
  return { rows, totalStones, totalCarat }
}

/** A plain-text schedule for copying into a supplier order. */
export function stoneScheduleText(s: StoneSchedule): string {
  if (!s.totalStones) return 'No stones placed yet.'
  const lines = s.rows.map(
    (r) => `${r.count} × ${r.shapeName} ${r.carat} ct (${r.mm.toFixed(2)} mm) — ${r.totalCarat.toFixed(2)} ct total`
  )
  lines.push(`Total: ${s.totalStones} stones, ${s.totalCarat.toFixed(2)} ct`)
  return lines.join('\n')
}
