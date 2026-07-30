import { jsPDF } from 'jspdf'

/**
 * Render a monospace document (tech sheet, appraisal, quote) to a branded PDF.
 * Letter size, dark header bar, courier body, multi-page.
 */
function buildPdf(brand: string, subtitle: string, body: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const M = 48
  const PAGE_W = 612
  const PAGE_H = 792
  const bodyW = PAGE_W - M * 2

  const header = () => {
    doc.setFillColor(19, 22, 25)
    doc.rect(0, 0, PAGE_W, 64, 'F')
    doc.setTextColor(198, 162, 101)
    doc.setFont('courier', 'bold')
    doc.setFontSize(15)
    doc.text(brand.toUpperCase(), M, 38)
    doc.setTextColor(150, 160, 165)
    doc.setFont('courier', 'normal')
    doc.setFontSize(9)
    doc.text(subtitle, M, 52)
  }

  header()
  doc.setTextColor(28, 28, 28)
  doc.setFont('courier', 'normal')
  doc.setFontSize(9)

  const lines = doc.splitTextToSize(body, bodyW) as string[]
  let y = 92
  const lh = 12
  const bottom = PAGE_H - 48
  for (const ln of lines) {
    if (y > bottom) { doc.addPage(); header(); doc.setTextColor(28, 28, 28); doc.setFont('courier', 'normal'); doc.setFontSize(9); y = 92 }
    doc.text(ln, M, y)
    y += lh
  }
  return doc
}

/** Render a monospace document to a branded PDF and trigger a download. */
export function textToPdf(brand: string, subtitle: string, body: string, filename: string): void {
  buildPdf(brand, subtitle, body).save(filename)
}

/** Same branded PDF, returned as bytes — for bundling into a "download all" zip. */
export function textToPdfBytes(brand: string, subtitle: string, body: string): Uint8Array {
  return new Uint8Array(buildPdf(brand, subtitle, body).output('arraybuffer'))
}

/** Drop the document's own title line (the PDF header already carries the brand). */
export const bodyAfterTitle = (text: string): string => text.split('\n').slice(1).join('\n').replace(/^\n+/, '')
