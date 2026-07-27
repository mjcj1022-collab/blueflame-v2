import { seatReport } from './seatCheck'
import { overhangReport } from './castCheck'
import { sculptWarnings } from './sculpt'
import { pieceSummary, pieceSummaryText } from './pieceSummary'
import { stoneSchedule, stoneScheduleText } from './stoneSchedule'
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

export function designQuality(objects: SculptObject[]): DesignQuality {
  const issues: string[] = []
  const passes: string[] = []

  const gems = objects.filter((o) => o.material === 'gem')
  const metals = objects.filter((o) => o.material === 'metal')

  const seat = seatReport(objects)
  if (gems.length && !metals.length) issues.push('Stone has no metal around it — add a head or bezel to hold it.')
  else if (seat.level === 'fail') issues.push(`Stone not held: ${seat.note}`)
  else if (seat.level === 'warn') issues.push(`Marginal setting: ${seat.note}`)
  else if (seat.level === 'pass') passes.push('Stone is securely held.')

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
  const q = designQuality(objects)
  return [
    'DESIGN SPECIFICATION',
    '────────────────────',
    pieceSummaryText(ps, alloyName),
    `Finish: ${finishName}`,
    '',
    'STONES',
    stoneScheduleText(sched),
    '',
    `Quality: ${q.level.toUpperCase()}${q.issues.length ? ' — ' + q.issues.join('; ') : ''}`,
  ].join('\n')
}
