import { describe, it, expect } from 'vitest'
import { pricingTiers } from '../lib/pricingTiers'
import { invoiceText } from '../lib/invoice'
import { certificateHtml } from '../lib/certificate'
import { intakeFormHtml } from '../lib/intakeForm'
import { batchStlZip } from '../lib/cadExport'
import type { SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (id: string, ct: number): SculptObject => ({ id, kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat: ct } })

describe('pricing tiers', () => {
  it('rise cost < wholesale < keystone, and retail is present', () => {
    const t = pricingTiers([shank(), gem('g', 1)], '14ky')
    expect(t.cost).toBeGreaterThan(0)
    expect(t.wholesale).toBeGreaterThan(t.cost)
    expect(t.keystone).toBeGreaterThan(t.wholesale)
    expect(t.keystone).toBeCloseTo(t.cost * 2, 6)
    expect(t.retail).toBeGreaterThan(0)
  })
})

describe('invoice', () => {
  it('itemizes and subtracts a deposit to a balance due', () => {
    const t = invoiceText([shank(), gem('g', 1)], '14ky', { invoiceNo: 'A1', depositPaid: 100 })
    expect(t).toMatch(/INVOICE/)
    expect(t).toMatch(/Less deposit paid/)
    expect(t).toMatch(/BALANCE DUE/)
    expect(t).toMatch(/A1/)
  })
})

describe('certificate of authenticity', () => {
  it('states the piece, metal and stones with a SKU', () => {
    const h = certificateHtml('Blue Flame', 'Solitaire', [shank(), gem('g', 1)], '18ky', '2026-01-01')
    expect(h).toMatch(/Certificate of Authenticity/)
    expect(h).toMatch(/18K/)
    expect(h).toMatch(/RG-18KY/)
  })
})

describe('intake form', () => {
  it('is a printable form with the key brief fields', () => {
    const h = intakeFormHtml('Blue Flame')
    expect(h).toMatch(/Custom Piece/)
    expect(h).toMatch(/Budget range/)
    expect(h).toMatch(/Deadline/)
  })
})

describe('batch STL zip', () => {
  it('produces a zip (PK header) with one STL per design', () => {
    const z = batchStlZip([{ name: 'Ring A', objects: [shank()] }, { name: 'Ring A', objects: [shank()] }])
    expect(z[0]).toBe(0x50); expect(z[1]).toBe(0x4b)   // "PK"
    expect(z.length).toBeGreaterThan(200)
  })
})
