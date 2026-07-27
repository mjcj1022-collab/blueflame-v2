import type { SculptObject } from '../state/modeler'
import { sculptMetalVolume } from './sculpt'
import { alloyById } from '../catalog'
import { settingBand } from './labor'
import { MARKET } from './market'

/**
 * Bench-time estimator. The dollar estimate answers "what does it cost"; this
 * answers "how long is it on my bench", broken down by the operations a maker
 * actually performs — casting, stone setting (scaled by each stone's size),
 * finishing/polishing (scaled by mass), and assembly (a solder join per extra
 * part). Minutes convert to a labor charge at the shop's hourly rate, so a
 * jeweler can price a real job instead of guessing. Deterministic + testable.
 */

/** Bench minutes to set one stone, by size band label. */
const SET_MINUTES: Record<string, number> = {
  melee: 4, small: 9, medium: 16, large: 26, statement: 42, exceptional: 60,
}

export interface LaborLine { op: string; detail: string; minutes: number; cost: number }
export interface LaborBreakdown { lines: LaborLine[]; totalMinutes: number; laborCost: number }

/** Estimate bench time per operation and its cost at MARKET.laborRate ($/hr). */
export function laborBreakdown(objects: SculptObject[], alloyId: string): LaborBreakdown {
  const rate = MARKET.laborRate > 0 ? MARKET.laborRate : 0
  const perMin = rate / 60
  const alloy = alloyById(alloyId)
  const vol = sculptMetalVolume(objects)
  const castG = (vol / 1000) * alloy.density
  const gems = objects.filter(o => o.kind === 'gem')
  const metalParts = objects.filter(o => o.material === 'metal').length

  const lines: LaborLine[] = []
  const add = (op: string, detail: string, minutes: number) => {
    if (minutes <= 0) return
    lines.push({ op, detail, minutes: Math.round(minutes), cost: minutes * perMin })
  }

  // Casting: mould, sprue, pour, divest, clean-up — a base plus a mass term.
  if (metalParts > 0) add('Cast & clean-up', `${castG.toFixed(1)} g ${alloy.name}`, 20 + 0.4 * castG)

  // Stone setting: summed per stone by size band.
  if (gems.length) {
    let setMin = 0
    const counts: Record<string, number> = {}
    for (const g of gems) {
      const band = settingBand(g.params?.carat ?? 0).label
      setMin += SET_MINUTES[band] ?? 10
      counts[band] = (counts[band] ?? 0) + 1
    }
    const detail = Object.entries(counts).map(([b, n]) => `${n} ${b}`).join(', ')
    add('Stone setting', detail, setMin)
  }

  // Finishing / polishing: setup plus a term that tracks the metal to work.
  if (metalParts > 0) add('Finish & polish', `${castG.toFixed(1)} g`, 15 + 1.2 * castG)

  // Assembly: one solder join per metal part beyond the first.
  if (metalParts > 1) add('Assembly', `${metalParts - 1} join${metalParts - 1 === 1 ? '' : 's'}`, 10 * (metalParts - 1))

  const totalMinutes = lines.reduce((s, l) => s + l.minutes, 0)
  const laborCost = lines.reduce((s, l) => s + l.cost, 0)
  return { lines, totalMinutes, laborCost }
}

/** "1 h 25 m" style, from minutes. */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  return h ? `${h} h${r ? ` ${r} m` : ''}` : `${r} m`
}
