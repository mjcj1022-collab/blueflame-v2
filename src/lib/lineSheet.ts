import type { SavedSculpt } from './sculptLibrary'
import { sculptEstimate } from './sculpt'
import { skuFor } from './sku'
import { alloyById } from '../catalog'
import { money } from './units'

/**
 * Collection line sheet. A one-page price list across a shop's saved designs — the
 * sheet a maker hands a stockist or uses to quote a collection. Each design gets a
 * SKU, its metal weight and a price, all in one metal so they compare fairly.
 * Priced in the metal the maker is currently working in.
 */

export function lineSheetText(saved: SavedSculpt[], alloyId: string, brand = 'Blue Flame'): string {
  const alloy = alloyById(alloyId)
  const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))
  const rows = saved.map(s => {
    const est = sculptEstimate(s.objects, alloyId)
    const sku = skuFor(s.objects, alloyId)
    return `  ${pad(sku, 22)}${pad(s.name, 24)}${pad(`${est.castG.toFixed(1)} g`, 9)}${money(est.total)}`
  })
  return [
    `${brand.toUpperCase()} — COLLECTION LINE SHEET`,
    `  Priced in ${alloy.name} · ${saved.length} design${saved.length === 1 ? '' : 's'}`,
    '',
    `  ${pad('SKU', 22)}${pad('Design', 24)}${pad('Weight', 9)}Price`,
    `  ${'-'.repeat(60)}`,
    ...rows,
  ].join('\n')
}
