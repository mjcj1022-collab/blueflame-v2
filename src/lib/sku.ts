import type { SculptObject } from '../state/modeler'
import { alloyById, stoneById } from '../catalog'

/**
 * SKU / style-number generator. A shop needs a stable code for every design to
 * tag it in a catalog, on a tag, or in an order. This builds a readable,
 * deterministic SKU from the piece's own attributes — category, metal, centre
 * stone, shape and size — so the same design always yields the same code.
 */

const CAT = (objects: SculptObject[]): string => objects.some(o => o.kind === 'shank') ? 'RG' : 'JW'

const SHAPE_CODE: Record<string, string> = {
  rd: 'RD', ov: 'OV', cu: 'CU', pr: 'PR', em: 'EM', as: 'AS', ra: 'RA', pe: 'PE',
  ma: 'MQ', he: 'HT', tr: 'TR', bg: 'BG', oe: 'OE', ro: 'RO', ca: 'CB', br: 'BR',
}

/** e.g. RG-14KY-RD-DIA-100 (ring, 14K yellow, round diamond, 1.00 ct). */
export function skuFor(objects: SculptObject[], alloyId: string): string {
  const parts: string[] = [CAT(objects), alloyById(alloyId).short.toUpperCase()]
  const gems = objects.filter(o => o.kind === 'gem')
  if (gems.length) {
    const centre = gems.reduce((a, c) => (c.params?.carat ?? 0) > (a.params?.carat ?? 0) ? c : a)
    const st = stoneById(centre.params?.stoneTypeId ?? 'dia')
    const shape = SHAPE_CODE[centre.params?.shapeId ?? 'rd'] ?? 'XX'
    const ct = Math.round((centre.params?.carat ?? 0) * 100)
    parts.push(shape, st.id.toUpperCase(), String(ct).padStart(3, '0'))
    if (gems.length > 1) parts.push(`M${gems.length - 1}`)   // + melee count
  } else {
    parts.push('PLAIN')
  }
  return parts.join('-')
}
