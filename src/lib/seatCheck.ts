import { bakedVertices } from './sculpt'
import { stoneMm, shapeById } from '../catalog'
import type { SculptObject } from '../state/modeler'

/**
 * Stone-setting security check. A stone is held only if metal (prongs or a bezel
 * rim) reaches its widest point — the girdle — AND rises above it to lock it in.
 * We measure both from the actual placed geometry, so a maker knows before
 * casting whether the stone would sit securely or fall out.
 */
export interface SeatReport {
  level: 'pass' | 'warn' | 'fail' | 'none'
  coverage: number     // 0..1 — fraction of the girdle ring with metal at it
  aboveGirdle: number  // mm the metal rises above the girdle (locks the stone)
  girdleR: number      // mm — the stone's girdle radius
  note: string
}

const NONE = (note: string): SeatReport => ({ level: 'none', coverage: 0, aboveGirdle: 0, girdleR: 0, note })

export function seatReport(objects: SculptObject[]): SeatReport {
  const gem = objects.find((o) => o.material === 'gem')
  const metals = objects.filter((o) => o.material === 'metal')
  if (!gem) return NONE('Add a gem, then check its setting.')
  if (!metals.length) return NONE('Add a prong head or bezel around the stone to check it.')

  const shapeId = gem.params?.shapeId ?? 'rd'
  const carat = gem.params?.carat ?? 1
  const R = (stoneMm(shapeById(shapeId), carat).width / 2) * (gem.scale[0] ?? 1)
  const [gx, gy, gz] = gem.position

  const N = 16
  const nearest = new Array<number>(N).fill(Infinity)   // radial distance of metal to the girdle ring, per angular slot
  let top = -Infinity

  for (const m of metals) {
    const v = bakedVertices(m)
    for (let i = 0; i < v.length; i += 3) {
      const x = v[i], y = v[i + 1], z = v[i + 2]
      if (y > top) top = y
      if (Math.abs(y - gy) < R * 0.9) {               // metal in the girdle height band
        const dx = x - gx, dz = z - gz
        const ang = (Math.atan2(dz, dx) + Math.PI * 2) % (Math.PI * 2)
        const k = Math.floor((ang / (Math.PI * 2)) * N) % N
        const d = Math.abs(Math.hypot(dx, dz) - R)     // how close to the girdle radius
        if (d < nearest[k]) nearest[k] = d
      }
    }
  }

  const reach = Math.max(R * 0.4, 0.8)                  // metal within this of the girdle counts as covering
  const coverage = nearest.filter((d) => d < reach).length / N
  const aboveGirdle = isFinite(top) ? top - gy : 0

  let level: SeatReport['level']
  let note: string
  if (aboveGirdle < 0.15) {
    level = 'fail'; note = 'Nothing rises above the girdle — the stone would lift straight out. Extend the prongs/bezel over the top of the stone.'
  } else if (coverage < 0.3) {
    level = 'fail'; note = `Metal barely reaches the girdle (${Math.round(coverage * 100)}% around) — the stone isn't held. Move the head in or add prongs.`
  } else if (aboveGirdle < 0.5 || coverage < 0.55) {
    level = 'warn'; note = `Marginal hold — ${Math.round(coverage * 100)}% girdle coverage, ${aboveGirdle.toFixed(2)} mm over the girdle. Tighten before setting.`
  } else {
    level = 'pass'; note = `Secure — ${Math.round(coverage * 100)}% of the girdle is covered and metal locks ${aboveGirdle.toFixed(2)} mm over it.`
  }
  return { level, coverage, aboveGirdle, girdleR: R, note }
}
