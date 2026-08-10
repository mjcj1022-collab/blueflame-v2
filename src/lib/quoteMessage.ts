import type { SculptObject } from '../state/modeler'
import { alloyById } from '../catalog'
import { sculptEstimate } from './sculpt'
import { paymentSchedule } from './deposit'
import { leadTime } from './leadTime'
import { money } from './units'

/**
 * Customer quote message. The ready-to-send note a maker copies into an email or
 * text: what the piece is, the price, the deposit to start, and when it'll be
 * ready — in warm, plain language, drawn from the same estimate and schedule the
 * bench uses so it's always accurate. Saves re-typing the same message per client.
 */

export interface QuoteMessageOpts {
  name?: string
  customer?: string
  brand?: string
  depositRate?: number
}

export function quoteMessage(objects: SculptObject[], alloyId: string, opts: QuoteMessageOpts = {}): string {
  const { name = 'your custom piece', customer, brand = 'Mandrel', depositRate = 0.5 } = opts
  const est = sculptEstimate(objects, alloyId)
  const alloy = alloyById(alloyId)
  const sched = paymentSchedule(est.total, depositRate)
  const lead = leadTime(objects, alloyId)

  const stoneBit = est.gemCount > 0 ? ` set with ${est.gemCount} stone${est.gemCount === 1 ? '' : 's'} (${est.carats.toFixed(2)} ct total)` : ''
  return [
    `Hi${customer ? ' ' + customer : ''},`,
    '',
    `Thank you for the chance to make ${name}. Here are the details:`,
    '',
    `• Piece: custom ${objects.some(o => o.kind === 'shank') ? 'ring' : 'design'} in ${alloy.name}${stoneBit}`,
    `• Price: ${money(est.total)}`,
    `• To begin: a ${Math.round(sched.depositRate * 100)}% deposit of ${money(sched.deposit)}, with the balance of ${money(sched.balance)} due before delivery`,
    `• Timeline: approximately ${lead.totalDays} business days from approval`,
    '',
    `The price holds for 14 days — precious metal is quoted at today's market. Everything is made to order, so the final weight may vary slightly after casting.`,
    '',
    `Just say the word and I'll get started.`,
    '',
    `Warmly,`,
    brand,
  ].join('\n')
}
