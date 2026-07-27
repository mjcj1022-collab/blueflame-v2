import type { SculptObject } from '../state/modeler'
import { stoneById } from '../catalog'

/**
 * Durability / wear QA. A beautiful piece that won't survive daily wear is a
 * warranty problem waiting to happen. This flags the classics: a soft or cleavage-
 * prone stone (opal, pearl, emerald, tanzanite) in a ring that takes knocks, stones
 * that can't go near an ultrasonic at the bench, and a set that mixes hard and soft
 * stones. Read from the catalog's Mohs and care data — advisory, not a block.
 */

export interface DurabilityFinding { level: 'pass' | 'warn' | 'fail'; title: string; detail: string }

/** Category inferred from the parts present — a ring/bracelet takes far more
 *  abuse than earrings or a pendant. */
export type WearContext = 'hand' | 'other'

export function wearContext(objects: SculptObject[]): WearContext {
  return objects.some(o => o.kind === 'shank') ? 'hand' : 'other'
}

export function durabilityCheck(objects: SculptObject[], ctx: WearContext = wearContext(objects)): DurabilityFinding[] {
  const gems = objects.filter(o => o.kind === 'gem')
  if (!gems.length) return []
  const out: DurabilityFinding[] = []
  const seen = new Set<string>()
  let minMohs = Infinity, maxMohs = 0

  for (const g of gems) {
    const st = stoneById(g.params?.stoneTypeId ?? 'dia')
    minMohs = Math.min(minMohs, st.mohs); maxMohs = Math.max(maxMohs, st.mohs)
    if (seen.has(st.id)) continue
    seen.add(st.id)
    if (ctx === 'hand' && st.mohs < 7.5) {
      out.push({ level: st.mohs < 6 ? 'fail' : 'warn', title: `${st.name} is soft for a ring`, detail: `Mohs ${st.mohs} — a ring takes daily knocks. ${st.mohs < 6 ? 'It will abrade and chip; steer to earrings/pendant or a very protected setting.' : 'Use a bezel or protective mount and set the wearer’s expectations.'}` })
    }
    if (st.care) out.push({ level: 'warn', title: `${st.name}: special care`, detail: st.care })
  }
  if (isFinite(minMohs) && maxMohs - minMohs >= 3) {
    out.push({ level: 'warn', title: 'Mixed hardness', detail: `This set mixes hard and soft stones (Mohs ${minMohs}–${maxMohs}) — the softer stones will scratch against the harder ones over time.` })
  }
  if (!out.length) out.push({ level: 'pass', title: 'Durable for its wear', detail: 'The stones suit how this piece is worn — no hardness or care concerns.' })
  return out
}
