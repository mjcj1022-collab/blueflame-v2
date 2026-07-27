import type { SculptObject } from '../state/modeler'
import { alloyById } from '../catalog'
import { sculptEstimate } from './sculpt'
import { money } from './units'

/**
 * Invoice. The document that closes a job — itemized, with any deposit already
 * paid subtracted and the balance due. Distinct from the quote (an estimate that
 * holds for N days); an invoice is the bill. Line items come from the same
 * estimate the bench and quote use, so nothing ever disagrees.
 */

export interface InvoiceOpts {
  invoiceNo?: string
  customer?: string
  depositPaid?: number
  today?: string
  brand?: string
}

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))
const amountRow = (label: string, amount: string, width = 46) => `  ${pad(label, width - amount.length)}${amount}`

export function invoiceText(objects: SculptObject[], alloyId: string, opts: InvoiceOpts = {}): string {
  const { invoiceNo = '—', customer = '—', depositPaid = 0, today = '', brand = 'Blue Flame' } = opts
  const est = sculptEstimate(objects, alloyId)
  const alloy = alloyById(alloyId)
  const balance = Math.max(0, est.total - depositPaid)

  const lines: string[] = [
    `  Metal — ${est.castG.toFixed(2)} g ${alloy.name}|${money(est.metalCost)}`,
  ]
  if (est.gemCount > 0) {
    lines.push(`  Stones — ${est.gemCount} · ${est.carats.toFixed(2)} ct|${money(est.stoneCost)}`)
    lines.push(`  Setting labor|${money(est.settingLabor)}`)
  }
  lines.push(`  Cast, finish & polish|${money(est.finishFee)}`)

  return [
    `${brand.toUpperCase()} — INVOICE`,
    '',
    `  ${pad('Invoice #', 14)}${invoiceNo}`,
    `  ${pad('Date', 14)}${today}`,
    `  ${pad('Bill to', 14)}${customer}`,
    '',
    'ITEMS',
    ...lines.map(l => { const [label, amt] = l.trim().split('|'); return amountRow(label, amt) }),
    `  ${'-'.repeat(46)}`,
    amountRow('Subtotal', money(est.total)),
    ...(depositPaid > 0 ? [amountRow('Less deposit paid', `-${money(depositPaid)}`)] : []),
    `  ${'-'.repeat(46)}`,
    amountRow('BALANCE DUE', money(balance)),
    '',
    'Thank you for your business. Payment is due on receipt.',
  ].join('\n')
}
