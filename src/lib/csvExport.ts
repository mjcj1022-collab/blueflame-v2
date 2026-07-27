import type { SculptObject } from '../state/modeler'
import { sculptBom } from './sculptBom'
import { stoneOrder } from './stoneOrder'

/**
 * CSV export of the bill of materials and the stones-to-order list — so a maker
 * can drop the numbers straight into a spreadsheet, a supplier form, or a shop
 * inventory system, instead of retyping them. RFC-4180 quoting for safety.
 */

const cell = (v: string | number): string => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (cells: (string | number)[]) => cells.map(cell).join(',')

export function bomCsv(objects: SculptObject[], alloyId: string): string {
  const b = sculptBom(objects, alloyId)
  const lines = [row(['Qty', 'Item', 'Material', 'Detail', 'Grams', 'Carat'])]
  for (const r of b.rows) lines.push(row([r.qty, r.item, r.material, r.detail, r.grams?.toFixed(3) ?? '', r.carat?.toFixed(2) ?? '']))
  return lines.join('\n') + '\n'
}

export function stoneOrderCsv(objects: SculptObject[]): string {
  const o = stoneOrder(objects)
  const lines = [row(['Qty', 'Stone', 'Shape', 'mm', 'CaratEach', 'TotalCarat', 'EstCost'])]
  for (const r of o.rows) lines.push(row([r.qty, r.stone, r.shape, r.mm.toFixed(2), r.caratEach.toFixed(3), r.totalCarat.toFixed(2), r.cost.toFixed(2)]))
  return lines.join('\n') + '\n'
}
