import type { SculptObject } from '../state/modeler'
import { laborBreakdown } from './laborTime'

/**
 * Production lead-time estimator. Turns bench minutes into a realistic calendar
 * promise. Real lead time isn't just hands-on time — it's the queue and the fixed
 * turnarounds (casting comes back in a couple of days, stones may need ordering),
 * plus the actual setting and finishing hours spread over a working day. Gives a
 * maker a defensible "about N business days" instead of an optimistic guess.
 */

export interface LeadStage { stage: string; days: number }
export interface LeadTime { stages: LeadStage[]; totalDays: number }

const HOURS_PER_DAY = 6   // productive bench hours in a working day

export function leadTime(objects: SculptObject[], alloyId: string): LeadTime {
  const lb = laborBreakdown(objects, alloyId)
  const gems = objects.filter(o => o.kind === 'gem').length
  const setMin = lb.lines.find(l => l.op === 'Stone setting')?.minutes ?? 0
  const finishMin = (lb.lines.find(l => l.op === 'Finish & polish')?.minutes ?? 0) + (lb.lines.find(l => l.op === 'Assembly')?.minutes ?? 0)

  const dayFromMin = (m: number) => Math.max(0, m / 60 / HOURS_PER_DAY)
  const stages: LeadStage[] = [
    { stage: 'CAD & wax/print', days: 1 },
    ...(gems > 0 ? [{ stage: 'Source stones', days: 2 }] : []),
    { stage: 'Casting turnaround', days: 3 },
    { stage: 'Setting', days: Math.max(gems > 0 ? 1 : 0, Math.ceil(dayFromMin(setMin))) },
    { stage: 'Finishing & QC', days: Math.max(1, Math.ceil(dayFromMin(finishMin))) },
  ].filter(s => s.days > 0)

  const totalDays = stages.reduce((s, x) => s + x.days, 0)
  return { stages, totalDays }
}
