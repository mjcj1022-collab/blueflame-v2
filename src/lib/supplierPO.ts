import type { SculptObject } from '../state/modeler'
import { stoneOrder } from './stoneOrder'
import { money } from './units'

/**
 * Supplier purchase order for the stones a piece needs. A formatted PO a maker
 * emails or prints for a stone supplier (Stuller, RioGrande, a local dealer) —
 * grouped by type/shape/mm the way stones are parcelled, with quantities and
 * carats. A handoff document, not a live ordering API (that needs each supplier's
 * account + key); this is the order they accept by email today.
 */

export interface SupplierPOOpts {
  poNumber?: string
  supplier?: string
  buyer?: string
  date?: string
}

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))

export function supplierPOText(objects: SculptObject[], opts: SupplierPOOpts = {}): string {
  const { poNumber = String(Date.now()).slice(-6), supplier = '____________________', buyer = 'Mandrel', date = new Date().toISOString().slice(0, 10) } = opts
  const o = stoneOrder(objects)
  const rows = o.rows.map(r => `  ${pad(`${r.qty}`, 4)}${pad(`${r.mm.toFixed(2)} mm ${r.shape} ${r.stone}`, 34)}${pad(`${r.totalCarat.toFixed(2)} ct`, 12)}est. ${money(r.cost)}`)
  return [
    `${buyer.toUpperCase()} — PURCHASE ORDER`,
    '',
    `  PO #        ${poNumber}`,
    `  Date        ${date}`,
    `  Supplier    ${supplier}`,
    `  Buyer       ${buyer}`,
    '',
    'STONES',
    `  ${pad('Qty', 4)}${pad('Item', 34)}${pad('Carats', 12)}Est. cost`,
    `  ${'-'.repeat(60)}`,
    ...rows,
    `  ${'-'.repeat(60)}`,
    `  ${o.totalStones} stone${o.totalStones === 1 ? '' : 's'} · est. ${money(o.totalCost)}`,
    '',
    'TERMS',
    '  Please confirm availability, exact millimetre sizes and price before',
    '  shipping. Calibrated/matched melee where noted. Memo terms acceptable.',
    '',
    `  Authorized by ____________________   ${buyer}`,
  ].join('\n')
}
