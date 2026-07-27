import { seatReport } from './seatCheck'
import { overhangReport } from './castCheck'
import { sculptWarnings } from './sculpt'
import { pieceSummary, pieceSummaryText } from './pieceSummary'
import { stoneSchedule } from './stoneSchedule'
import { gemSpacingReport, weightAdvice, ringFitReadout } from './designAdvice'
import { describePiece } from './describePiece'
import type { SculptObject } from '../state/modeler'

/**
 * A single design-quality read across the manufacturing checks a maker cares
 * about — stone security, thin sections, print supports — rolled into one
 * verdict with a short issue list. Run automatically after the AI assembles a
 * piece so problems surface immediately instead of at the bench.
 */

export type QualityLevel = 'clean' | 'review' | 'blocked'

export interface DesignQuality {
  level: QualityLevel
  issues: string[]
  passes: string[]
}

export function designQuality(objects: SculptObject[], alloyId?: string): DesignQuality {
  const issues: string[] = []
  const passes: string[] = []

  const gems = objects.filter((o) => o.material === 'gem')
  const metals = objects.filter((o) => o.material === 'metal')

  const seat = seatReport(objects)
  if (gems.length && !metals.length) issues.push('Stone has no metal around it — add a head or bezel to hold it.')
  else if (seat.level === 'fail') issues.push(`Stone not held: ${seat.note}`)
  else if (seat.level === 'warn') issues.push(`Marginal setting: ${seat.note}`)
  else if (seat.level === 'pass') passes.push('Stone is securely held.')

  // Stone crowding / overlap.
  if (gems.length > 1) {
    const sp = gemSpacingReport(objects)
    if (sp.clashes) issues.push(sp.note)
    else if (sp.tight) issues.push(sp.note)
    else passes.push('Stone spacing looks good.')
  }

  // Over-heavy casting (only when we know the alloy).
  if (alloyId && metals.length) {
    const w = weightAdvice(objects, alloyId)
    if (w.heavy) issues.push(w.note)
    else passes.push(w.note)
  }

  const warns = sculptWarnings(objects)
  if (warns.length) issues.push(`${warns.length} thin-section warning${warns.length === 1 ? '' : 's'} (min wall).`)
  else passes.push('No thin-section warnings.')

  const over = overhangReport(objects)
  if (over.level === 'heavy') issues.push(`Heavy print supports: ${Math.round(over.fraction * 100)}% faces down.`)
  else if (over.level === 'some') passes.push(`Prints with some supports (${Math.round(over.fraction * 100)}% down-facing).`)
  else passes.push('Prints clean.')

  // Blocked if a stone would fall out or a section can't cast; review for softer flags.
  const blocked = seat.level === 'fail'
  const level: QualityLevel = blocked ? 'blocked' : issues.length ? 'review' : 'clean'
  return { level, issues, passes }
}

/**
 * A formal, copyable design specification: overall dimensions, materials and
 * finish, the full stone schedule, and cast weight — the sheet a maker hands to
 * a caster or files with the job.
 */
export function designSpecText(objects: SculptObject[], alloyId: string, alloyName: string, finishName = 'High polish'): string {
  const ps = pieceSummary(objects, alloyId)
  const sched = stoneSchedule(objects)
  const q = designQuality(objects, alloyId)
  const desc = describePiece(objects, alloyId)
  const fit = ringFitReadout(objects)
  const lines: string[] = [
    'DESIGN SPECIFICATION',
    '────────────────────',
    desc.name,
    desc.sentence,
    '',
    pieceSummaryText(ps, alloyName),
    `Finish: ${finishName}`,
  ]
  if (fit) lines.push(`Finger fit: ${fit.size !== null ? `size ${fit.size}, ` : ''}${fit.innerDiaMm.toFixed(2)} mm inner Ø (${fit.circMm.toFixed(1)} mm circumference)`)
  lines.push('', 'STONES')
  // Stones with a cutting tolerance note the supplier can work to.
  for (const r of sched.rows) lines.push(`${r.count} × ${r.shapeName} ${r.carat} ct — ${r.mm.toFixed(2)} mm (±0.05 mm)`)
  lines.push(`Total: ${sched.totalStones} stones, ${sched.totalCarat.toFixed(2)} ct`)
  lines.push('', `Quality: ${q.level.toUpperCase()}${q.issues.length ? ' — ' + q.issues.join('; ') : ''}`)
  return lines.join('\n')
}
