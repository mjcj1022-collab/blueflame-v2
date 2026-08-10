import { jsPDF } from 'jspdf'
import type { DesignSpec } from '../spec/types'
import { CATEGORY_LABEL, stoneOnPiece } from '../spec/types'
import { alloyById, shapeById, stoneMm, settingById, finishById } from '../catalog'
import { computeMetal } from './metal'
import { computeBom } from './bom'
import { manufacturabilityChecks } from './manufacture'
import { sizeToDiameter, formatSize } from './sizing'
import { money } from './units'

/** A rendered hero image to embed at the top of the tech pack. */
export interface HeroImage { url: string; w: number; h: number; format: 'PNG' | 'JPEG' }

/**
 * A one-page manufacturing tech pack for the caster: an optional render, the
 * piece specification (metal, weights, size, stone, setting, finish),
 * castability checks, and the bill of materials. Pairs with the STL export.
 */
export function downloadTechPack(spec: DesignSpec, shopName: string, hero?: HeroImage | null): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const PAGE_W = 612, PAGE_H = 792, M = 48
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

  // header bar
  doc.setFillColor(19, 22, 25); doc.rect(0, 0, PAGE_W, 64, 'F')
  doc.setTextColor(198, 162, 101); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text(shopName.toUpperCase(), M, 34)
  doc.setTextColor(150, 160, 165); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Manufacturing Tech Pack  ·  ${CATEGORY_LABEL[spec.category]}  ·  ${dateStr}`, M, 50)

  let y = 92
  const colX = M + 150

  // optional render, top-right
  if (hero) {
    const imgW = 176
    const imgH = Math.min(200, Math.round(imgW * (hero.h / hero.w)))
    doc.setFillColor(14, 17, 19); doc.rect(PAGE_W - M - imgW, y - 4, imgW, imgH + 8, 'F')
    try { doc.addImage(hero.url, hero.format, PAGE_W - M - imgW + 4, y, imgW - 8, imgH) } catch { /* image add failed — skip */ }
  }

  const section = (title: string) => {
    y += 6
    doc.setTextColor(28, 28, 28); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(title, M, y); y += 4
    doc.setDrawColor(210, 210, 210); doc.line(M, y, M + 300, y); y += 16
  }
  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
    doc.setTextColor(120, 128, 132); doc.text(label, M, y)
    doc.setTextColor(28, 28, 28); doc.text(value, colX, y)
    y += 15
  }

  // ---- specification ----
  const alloy = alloyById(spec.metal.alloyId)
  const metal = computeMetal(spec)
  section('Specification')
  row('Piece', CATEGORY_LABEL[spec.category])
  if (spec.category === 'ring') row('Ring size', `${formatSize(spec.ring.size)}  (${sizeToDiameter(spec.ring.size).toFixed(2)} mm ID)`)
  row('Metal', `${alloy.name}  ·  ${alloy.hallmark}`)
  if (spec.metal.twoTone && spec.metal.headAlloyId) row('Head metal', alloyById(spec.metal.headAlloyId).name)
  if (spec.metal.rhodium) row('Plating', 'Rhodium')
  row('Finished weight', `${metal.finished.toFixed(2)} g`)
  row('Metal to pour', `${metal.pour.toFixed(2)} g`)
  row('Finish', finishById(spec.finish)?.name ?? spec.finish)
  if (stoneOnPiece(spec)) {
    const shape = shapeById(spec.center.shapeId)
    const mm = stoneMm(shape, spec.center.carat)
    row('Center stone', `${spec.center.carat.toFixed(2)} ct ${shape.name}  ·  ${mm.length.toFixed(2)} × ${mm.width.toFixed(2)} mm`)
    row('Setting', settingById(spec.setting.typeId).name)
  }
  if (spec.engraving.text.trim()) row('Engraving', `“${spec.engraving.text.trim()}”`)

  // ---- castability ----
  const checks = manufacturabilityChecks(spec)
  if (checks.length) {
    y += 8
    section('Castability checks')
    for (const c of checks) {
      const color: [number, number, number] = c.level === 'fail' ? [192, 57, 43] : c.level === 'warn' ? [199, 122, 69] : [95, 176, 122]
      doc.setFillColor(...color); doc.circle(M + 3, y - 3, 3, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(28, 28, 28)
      doc.text(c.title, M + 12, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 96, 100)
      const detail = doc.splitTextToSize(c.detail, PAGE_W - M - (M + 130)) as string[]
      doc.text(detail, M + 130, y)
      y += Math.max(15, detail.length * 12)
    }
  }

  // ---- bill of materials ----
  const bom = computeBom(spec)
  y += 8
  section('Bill of materials')
  for (const l of bom.lines) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(28, 28, 28)
    doc.text(l.item, M, y)
    doc.setTextColor(120, 128, 132); doc.text(l.detail, colX, y)
    doc.setTextColor(28, 28, 28); doc.text(l.cost > 0 ? money(l.cost) : '—', PAGE_W - M, y, { align: 'right' })
    y += 14
  }
  doc.setDrawColor(210, 210, 210); doc.line(M, y, PAGE_W - M, y); y += 14
  doc.setFont('helvetica', 'bold'); doc.setTextColor(28, 28, 28)
  doc.text(`${bom.metalGrams.toFixed(2)} g metal · pour ${bom.pourGrams.toFixed(2)} g${bom.totalCarat > 0 ? ` · ${bom.totalCarat.toFixed(2)} ct` : ''}`, M, y)
  doc.text(money(bom.total), PAGE_W - M, y, { align: 'right' })

  // footer
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140, 146, 150)
  doc.text('Castability checks are heuristic — confirm wall and prong minimums with your caster. Geometry supplied separately as STL (metal only, true millimetres).', M, PAGE_H - 40, { maxWidth: PAGE_W - M * 2 })

  doc.save(`mandrel-techpack-${spec.category}.pdf`)
}
