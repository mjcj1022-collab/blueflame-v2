import type { SculptObject } from '../state/modeler'
import { mmForCarat } from './stoneSize'

/**
 * Setting-security check — will the stones stay put? A bench-grounded pass over
 * the placed stones and their mounts: enough prongs for the stone size, a bezel
 * with real wall, and stones not crowded so tight they can't be set or will chip
 * a neighbour. Advisory, from the actual geometry — the difference between a
 * stone that holds for a generation and one that drops in a month.
 */

export interface SecurityFinding { level: 'pass' | 'warn' | 'fail'; title: string; detail: string }

/** Minimum prongs recommended for a stone of this carat. */
function minProngs(carat: number): number {
  if (carat >= 2) return 6
  if (carat >= 0.75) return 4
  return 3
}

export function settingSecurity(objects: SculptObject[]): SecurityFinding[] {
  const gems = objects.filter(o => o.kind === 'gem')
  const heads = objects.filter(o => o.kind === 'head')
  const bezels = objects.filter(o => o.kind === 'bezel')
  const out: SecurityFinding[] = []
  if (!gems.length) return out

  // Prong / mount adequacy — pair each gem to its nearest mount.
  for (const g of gems) {
    const carat = g.params?.carat ?? 0
    const near = nearest([...heads, ...bezels], g)
    if (!near) {
      out.push({ level: 'warn', title: `${carat.toFixed(2)} ct stone unmounted`, detail: 'No head or bezel near this stone — add a mount and cut a seat, or it isn’t held.' })
      continue
    }
    if (near.kind === 'head') {
      const prongs = Math.round(near.params?.prongs ?? 4)
      const need = minProngs(carat)
      if (prongs < need) out.push({ level: 'fail', title: `Too few prongs for ${carat.toFixed(2)} ct`, detail: `${prongs} prongs on a ${carat.toFixed(2)} ct stone — use at least ${need} (or double-claw) so a lost prong doesn’t drop it.` })
    } else {
      const wall = near.params?.wall ?? 0
      if (wall > 0 && wall < 0.4) out.push({ level: 'warn', title: 'Thin bezel wall', detail: `Bezel wall ${wall.toFixed(2)} mm is thin — under ~0.4 mm it can tear when you burnish it over the girdle.` })
    }
  }

  // Stone-to-stone clearance — centres closer than the sum of half-diameters
  // means they overlap; a hair beyond that and there's no metal to hold each.
  for (let i = 0; i < gems.length; i++) {
    for (let j = i + 1; j < gems.length; j++) {
      const a = gems[i], b = gems[j]
      const ra = mmForCarat(a.params?.shapeId ?? 'rd', a.params?.stoneTypeId ?? 'dia', a.params?.carat ?? 0).width / 2
      const rb = mmForCarat(b.params?.shapeId ?? 'rd', b.params?.stoneTypeId ?? 'dia', b.params?.carat ?? 0).width / 2
      const d = dist(a, b)
      if (d < ra + rb) { out.push({ level: 'fail', title: 'Stones overlap', detail: `Two stones sit ${d.toFixed(2)} mm apart but need ${(ra + rb).toFixed(2)} mm just to touch — they overlap. Space them out.` }); return dedupe(out) }
      if (d < ra + rb + 0.2) out.push({ level: 'warn', title: 'Stones very tight', detail: `Only ${(d - ra - rb).toFixed(2)} mm of metal between two stones — tight to set without chipping a neighbour.` })
    }
  }

  if (!out.length) out.push({ level: 'pass', title: 'Settings look secure', detail: 'Enough prongs for each stone, bezels have wall, and stones have room to set.' })
  return dedupe(out)
}

function dist(a: SculptObject, b: SculptObject): number {
  return Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2])
}
function nearest(mounts: SculptObject[], g: SculptObject): SculptObject | undefined {
  let best: SculptObject | undefined, bd = Infinity
  for (const m of mounts) { const d = dist(m, g); if (d < bd) { bd = d; best = m } }
  return bd < 8 ? best : undefined   // only "near" mounts count as this stone's setting
}
/** Collapse repeated identical findings so one problem isn't listed N times. */
function dedupe(list: SecurityFinding[]): SecurityFinding[] {
  const seen = new Set<string>()
  return list.filter(f => { const k = f.title + f.detail; if (seen.has(k)) return false; seen.add(k); return true })
}
