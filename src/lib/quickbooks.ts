import type { SculptObject } from '../state/modeler'
import { alloyById } from '../catalog'
import { sculptEstimate } from './sculpt'

/**
 * QuickBooks Online invoice export (CSV import bridge). QBO imports invoices from
 * a CSV with one row per line item sharing an invoice number. This turns a piece's
 * estimate into that format so a maker drops it into QuickBooks → Import Data →
 * Invoices instead of re-keying it. Not a live API sync (that needs OAuth); a
 * clean import file that QBO accepts.
 */

const cell = (v: string | number): string => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export interface QboInvoiceOpts {
  invoiceNo?: string
  customer?: string
  invoiceDate?: string   // yyyy-mm-dd
  dueDate?: string
}

/** QBO invoice-import CSV (header + one row per line item). */
export function invoiceCsvQBO(objects: SculptObject[], alloyId: string, opts: QboInvoiceOpts = {}): string {
  const { invoiceNo = String(Date.now()).slice(-6), customer = 'Custom order', invoiceDate = new Date().toISOString().slice(0, 10), dueDate = invoiceDate } = opts
  const est = sculptEstimate(objects, alloyId)
  const alloy = alloyById(alloyId)

  const header = ['InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate', 'Item(Product/Service)', 'ItemDescription', 'ItemQuantity', 'ItemRate', 'ItemAmount']
  const lines: (string | number)[][] = []
  const push = (item: string, desc: string, qty: number, rate: number) =>
    lines.push([invoiceNo, customer, invoiceDate, dueDate, item, desc, qty, rate.toFixed(2), (qty * rate).toFixed(2)])

  push('Metal', `${est.castG.toFixed(2)} g ${alloy.name}`, 1, est.metalCost)
  if (est.gemCount > 0) {
    push('Stones', `${est.gemCount} · ${est.carats.toFixed(2)} ct`, 1, est.stoneCost)
    push('Setting', 'Stone setting labor', 1, est.settingLabor)
  }
  push('Finishing', 'Cast, finish & polish', 1, est.finishFee)

  return [header, ...lines].map(r => r.map(cell).join(',')).join('\n') + '\n'
}
