import type { SculptObject } from '../state/modeler'
import { alloyById, stoneById } from '../catalog'
import { sculptEstimate, boundingSize, sculptMetalVolume } from './sculpt'
import { mmForCarat } from './stoneSize'
import { money, gToDwt } from './units'

/** Retail replacement multiplier for insurance — above the shop quote. */
export const APPRAISAL_MULTIPLIER = 1.35

/**
 * Insurance appraisal for a modeler piece. A formal statement of what the piece
 * is — metal and weight, each stone with its size, and an estimated retail
 * replacement value — for the customer to insure it. Mirrors the design-side
 * appraisal but reads the sculpted geometry. Plain text for a PDF.
 */
export function sculptAppraisalText(objects: SculptObject[], alloyId: string, brand = 'Mandrel', dateStr = ''): string {
  const alloy = alloyById(alloyId)
  const est = sculptEstimate(objects, alloyId)
  const gems = objects.filter(o => o.kind === 'gem')
  const [w, h, d] = objects.length ? envelope(objects) : [0, 0, 0]
  const replacement = est.total * APPRAISAL_MULTIPLIER
  const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))

  const stoneLines = gems.map((g, i) => {
    const st = stoneById(g.params?.stoneTypeId ?? 'dia')
    const ct = g.params?.carat ?? 0
    const mm = mmForCarat(g.params?.shapeId ?? 'rd', g.params?.stoneTypeId ?? 'dia', ct).width
    return `  ${pad(`${i + 1}. ${st.name}`, 18)}${ct.toFixed(2)} ct · ${mm.toFixed(2)} mm${st.treatment ? ` · ${st.treatment}` : ''}`
  })

  return [
    `${brand.toUpperCase()} — INSURANCE APPRAISAL`,
    '',
    `  ${pad('Date', 20)}${dateStr}`,
    `  ${pad('Item', 20)}Custom ${objects.some(o => o.kind === 'shank') ? 'ring' : 'jewelry piece'}`,
    '',
    'DESCRIPTION',
    `  ${pad('Metal', 20)}${alloy.name} (${(alloy.fine * 100).toFixed(1)}% ${alloy.symbol})`,
    `  ${pad('Metal weight', 20)}${est.castG.toFixed(2)} g (${gToDwt(est.castG).toFixed(2)} dwt)`,
    `  ${pad('Dimensions', 20)}${w.toFixed(1)} × ${h.toFixed(1)} × ${d.toFixed(1)} mm`,
    gems.length ? `  ${pad('Stones', 20)}${gems.length} · ${est.carats.toFixed(2)} ct total` : '',
    ...(stoneLines.length ? ['', 'STONES', ...stoneLines] : []),
    '',
    'VALUATION',
    `  ${pad('Retail replacement', 20)}${money(replacement)}`,
    '',
    '  This appraisal states the estimated retail replacement value of the item',
    '  described above as of the date shown, for insurance purposes. It is not an',
    '  offer to purchase. Values reflect current materials and market and should be',
    '  reviewed periodically.',
    '',
    `  Appraised by ____________________   ${brand}`,
  ].filter(Boolean).join('\n')
}

function envelope(objects: SculptObject[]): [number, number, number] {
  // overall envelope from per-part bounds (approx: max of each dimension)
  void sculptMetalVolume
  let w = 0, h = 0, d = 0
  for (const o of objects) { const [bw, bh, bd] = boundingSize(o); w = Math.max(w, bw); h = Math.max(h, bh); d = Math.max(d, bd) }
  return [w, h, d]
}
