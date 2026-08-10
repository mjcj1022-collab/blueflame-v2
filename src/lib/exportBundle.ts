import type { SculptObject } from '../state/modeler'
import { alloyById } from '../catalog'
import { strToU8 } from 'fflate'
import { modelerToObj, mandrelMtl, modelerToStlBinary, modelerTo3mf } from './cadExport'
import { modelerToStep } from './stepExport'
import { modelerToDxf } from './dxfExport'
import { modelerToSvg } from './svgSpec'
import { textToPdfBytes, bodyAfterTitle } from './pdf'
import { invoiceText } from './invoice'
import { jobTicketText } from './jobTicket'
import { sculptTechSheet, sculptQuote } from './sculptDoc'
import { qcChecklistText } from './qcChecklist'
import { sculptAppraisalText } from './sculptAppraisal'
import { designSpecText } from './designQuality'
import { supplierPOText } from './supplierPO'
import { certificateHtml } from './certificate'
import { careSheetHtml } from './careSheet'
import { intakeFormHtml } from './intakeForm'
import { bomCsv, stoneOrderCsv } from './csvExport'
import { invoiceCsvQBO } from './quickbooks'
import { measurements } from './measure'
import { describePiece } from './describePiece'
import { sculptHandoff } from './sculptHandoff'

/**
 * Assemble EVERY export for a piece into one keyed file map — the CAD/mesh
 * formats, the shop documents, the client-facing sheets and the data files —
 * so the UI can zip it into a single "download all". Each producer is guarded
 * individually: a piece that can't be priced still exports its STL and specs.
 * Pure (no DOM), so it's testable and reusable outside the panel.
 */
export interface BundleOpts { shopName: string; saveName?: string; today?: string }

export function assembleAllExports(objects: SculptObject[], alloyId: string, opts: BundleOpts): Record<string, Uint8Array> {
  const shopName = opts.shopName || 'Mandrel'
  const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'mandrel'
  const today = opts.today ?? '1970-01-01'
  const alloy = alloyById(alloyId)
  const files: Record<string, Uint8Array> = {}
  if (!objects.length) return files

  const name = (() => { try { return describePiece(objects, alloyId).name } catch { return 'piece' } })()
  const m = (() => { try { return measurements(objects, alloyId) } catch { return null } })()
  const hasGems = objects.some(o => o.kind === 'gem')

  const add = (path: string, produce: () => string | Uint8Array | ArrayBuffer) => {
    try {
      const d = produce()
      files[path] = typeof d === 'string' ? strToU8(d) : d instanceof Uint8Array ? d : new Uint8Array(d)
    } catch { /* skip a single failed export, keep the rest */ }
  }

  // CAD / mesh formats
  add(`models/${slug}.stl`, () => modelerToStlBinary(objects))
  add(`models/${slug}.3mf`, () => modelerTo3mf(objects))
  add(`models/${slug}.obj`, () => modelerToObj(objects))
  add('models/mandrel.mtl', () => mandrelMtl())
  add(`models/${slug}.step`, () => modelerToStep(objects))
  add(`models/${slug}.dxf`, () => modelerToDxf(objects))
  add(`models/${slug}-spec.svg`, () => modelerToSvg(objects, { brand: shopName, name, ringSize: m?.ringSize }))

  // Shop documents (PDF)
  try {
    const h = sculptHandoff(opts.saveName ?? name, objects, alloyId)
    add(`documents/${slug}-quote.pdf`, () => textToPdfBytes(shopName, 'Custom Piece — Quote', bodyAfterTitle(sculptQuote(h, { brand: shopName }))))
  } catch { /* unpriceable — skip the quote, keep everything else */ }
  add(`documents/${slug}-invoice.pdf`, () => textToPdfBytes(shopName, 'Invoice', bodyAfterTitle(invoiceText(objects, alloyId, { brand: shopName, invoiceNo: 'BUNDLE', today }))))
  add(`documents/${slug}-job-ticket.pdf`, () => textToPdfBytes(shopName, 'Job Ticket', bodyAfterTitle(jobTicketText(objects, alloyId, shopName, { today }))))
  add(`documents/${slug}-tech-sheet.pdf`, () => textToPdfBytes(shopName, 'Custom Sculpt — Tech Sheet', bodyAfterTitle(sculptTechSheet(objects, alloyId, shopName))))
  add(`documents/${slug}-qc.pdf`, () => textToPdfBytes(shopName, 'QC Checklist', bodyAfterTitle(qcChecklistText(objects, alloyId, shopName))))
  add(`documents/${slug}-appraisal.pdf`, () => textToPdfBytes(shopName, 'Insurance Appraisal', bodyAfterTitle(sculptAppraisalText(objects, alloyId, shopName, today))))
  add(`documents/${slug}-design-spec.pdf`, () => textToPdfBytes(shopName, 'Design Specification', bodyAfterTitle(designSpecText(objects, alloyId, alloy.name))))
  if (hasGems) add(`documents/${slug}-stone-po.pdf`, () => textToPdfBytes(shopName, 'Purchase Order', bodyAfterTitle(supplierPOText(objects, { buyer: shopName }))))

  // Client-facing sheets (HTML)
  add(`client/${slug}-certificate.html`, () => certificateHtml(shopName, name, objects, alloyId, today))
  add(`client/${slug}-care.html`, () => careSheetHtml(shopName, name, objects, alloyId))
  add(`client/${slug}-intake-form.html`, () => intakeFormHtml(shopName))

  // Data exports (CSV)
  add(`data/${slug}-bom.csv`, () => bomCsv(objects, alloyId))
  add(`data/${slug}-qbo-invoice.csv`, () => invoiceCsvQBO(objects, alloyId, { customer: 'Custom order' }))
  if (hasGems) add(`data/${slug}-stones.csv`, () => stoneOrderCsv(objects))

  return files
}

export interface CollectionDesign { name: string; objects: SculptObject[] }

/**
 * Assemble the full export set for EVERY saved design, each in its own numbered
 * folder, so a shop can hand off (or archive) a whole collection in a single zip.
 * Reuses the per-piece bundler; the numeric folder prefix keeps designs with the
 * same name from colliding.
 */
export function assembleCollectionExports(designs: CollectionDesign[], alloyId: string, opts: BundleOpts): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  designs.forEach((d, i) => {
    if (!d.objects?.length) return
    const slug = (d.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `design-${i + 1}`
    const folder = `${String(i + 1).padStart(2, '0')}-${slug}`
    const one = assembleAllExports(d.objects, alloyId, { ...opts, saveName: d.name })
    for (const [path, bytes] of Object.entries(one)) files[`${folder}/${path}`] = bytes
  })
  return files
}
