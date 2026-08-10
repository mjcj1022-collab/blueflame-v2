import type { SculptObject } from '../state/modeler'
import { alloyById } from '../catalog'
import { sculptEstimate } from './sculpt'
import { laborBreakdown, formatMinutes } from './laborTime'
import { sculptBom } from './sculptBom'
import { castingPlan } from './casting'
import { money } from './units'

/**
 * Bench job ticket / work order — the paper that travels with the piece through
 * the shop: what to make, in what metal, the parts to gather, the pour weight, the
 * bench operations in order with their time, and where it's going. Distinct from
 * the client quote (that's about price); this is the maker's build sheet.
 */

export interface JobTicketOpts {
  order?: string
  customer?: string
  due?: string
  today?: string
}

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))

export function jobTicketText(objects: SculptObject[], alloyId: string, brand = 'Mandrel', opts: JobTicketOpts = {}): string {
  const alloy = alloyById(alloyId)
  const est = sculptEstimate(objects, alloyId)
  const lb = laborBreakdown(objects, alloyId)
  const bom = sculptBom(objects, alloyId)
  const pour = castingPlan(objects, alloyId, 1)

  const head: string[] = [
    `${brand.toUpperCase()} — JOB TICKET`, '',
    `  ${pad('Order', 12)}${opts.order ?? '—'}`,
    `  ${pad('Customer', 12)}${opts.customer ?? '—'}`,
    `  ${pad('Opened', 12)}${opts.today ?? ''}`,
    `  ${pad('Due', 12)}${opts.due ?? '—'}`,
    '',
    'BUILD',
    `  ${pad('Metal', 12)}${alloy.name}`,
    `  ${pad('Cast wt', 12)}${est.castG.toFixed(2)} g finished`,
    `  ${pad('Pour', 12)}${pour.pourGrams.toFixed(2)} g (with sprue, shrink, button)`,
    ...(est.gemCount > 0 ? [`  ${pad('Stones', 12)}${est.gemCount} · ${est.carats.toFixed(2)} ct`] : []),
    '',
    'PARTS',
    ...bom.rows.map(r => `  ${pad(`${r.qty}x`, 4)}${pad(r.item, 22)}${r.material}  ${r.detail}`),
    '',
    'BENCH OPERATIONS',
    ...lb.lines.map(l => `  [ ] ${pad(l.op, 18)}${pad(l.detail, 16)}${formatMinutes(l.minutes)}`),
    `      ${pad('TOTAL BENCH', 18)}${pad('', 16)}${formatMinutes(lb.totalMinutes)}`,
    '',
    'SIGN-OFF',
    '  Cast [ ]   Set [ ]   Finish [ ]   QC [ ]   Ship [ ]',
    '',
    `  Value on ticket: ${money(est.total)} (see quote for client pricing).`,
  ]
  return head.join('\n')
}
