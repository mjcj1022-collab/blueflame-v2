import { describe, it, expect } from 'vitest'
import { invoiceCsvQBO } from '../lib/quickbooks'
import { supplierPOText } from '../lib/supplierPO'
import type { SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (id: string, ct: number, stone = 'dia'): SculptObject => ({ id, kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: stone, carat: ct } })

describe('QuickBooks invoice CSV', () => {
  it('has the QBO header and a shared invoice number across line rows', () => {
    const csv = invoiceCsvQBO([shank(), gem('g', 1)], '14ky', { invoiceNo: 'INV42', customer: 'Sam' })
    const rows = csv.trim().split('\n')
    expect(rows[0]).toBe('InvoiceNo,Customer,InvoiceDate,DueDate,Item(Product/Service),ItemDescription,ItemQuantity,ItemRate,ItemAmount')
    expect(rows.length).toBeGreaterThan(2)                 // metal + stones + setting + finishing
    expect(rows.slice(1).every(r => r.startsWith('INV42,Sam,'))).toBe(true)
  })
  it('quotes fields containing commas', () => {
    const csv = invoiceCsvQBO([shank()], '14ky', { customer: 'Smith, Jane' })
    expect(csv).toMatch(/"Smith, Jane"/)
  })
})

describe('supplier purchase order', () => {
  it('lists stones grouped with quantities and totals', () => {
    const po = supplierPOText([gem('a', 0.05), gem('b', 0.05), gem('c', 1, 'sap')], { poNumber: 'PO9', buyer: 'Mandrel' })
    expect(po).toMatch(/PURCHASE ORDER/)
    expect(po).toMatch(/PO #\s+PO9/)
    expect(po).toMatch(/Sapphire/)
    expect(po).toMatch(/stone/)
  })
})
