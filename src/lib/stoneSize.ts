import { shapeById, stoneMm } from '../catalog'

/**
 * Calibrated stone sizing — the maker's side of the bench, where stones are
 * bought and set by MILLIMETRE, not carat. Two stones of the same carat differ
 * in size because they differ in density (specific gravity): a 6.5 mm round is
 * ~1.00 ct in diamond but heavier in denser corundum (sapphire/ruby). The base
 * `stoneMm` is diamond-calibrated; here we density-correct it so "1.5 mm round
 * sapphire melee" comes out to the exact carat a supplier would quote, and we
 * publish the standard calibrated melee sizes the trade actually stocks.
 */

/** Diamond specific gravity — the reference the base mm formula is calibrated to. */
const DIA_SG = 3.52

/** Specific gravity (g/cm³) by stone id. Denser stone → more carats per mm. */
export const STONE_SG: Record<string, number> = {
  dia: 3.52, lab: 3.52, moi: 3.21,
  wsp: 4.00, sap: 4.00, psp: 4.00, ysp: 4.00, rub: 4.00, // corundum
  eme: 2.72, aqu: 2.72, mor: 2.80,                        // beryl
  alx: 3.73, spn: 3.60, tan: 3.35, tur: 3.06,
  tsv: 3.60, gar: 4.00, per: 3.34,
  ame: 2.65, cit: 2.65, tpz: 3.53,
  opa: 2.10, tqs: 2.76, lap: 2.75, onx: 2.60, pea: 2.70,
}

export const sgOf = (stoneId: string): number => STONE_SG[stoneId] ?? DIA_SG

/** Density scale on linear size: width ∝ ∛(carat / sg), calibrated to diamond. */
const sizeK = (stoneId: string): number => Math.cbrt(DIA_SG / sgOf(stoneId))

/** Face-up size (mm) of a stone of a given carat, corrected for its density. */
export function mmForCarat(shapeId: string, stoneId: string, carat: number): { width: number; length: number } {
  const base = stoneMm(shapeById(shapeId), Math.max(carat, 1e-4))
  const k = sizeK(stoneId)
  return { width: base.width * k, length: base.length * k }
}

/** Carat of a stone from its face-up WIDTH (mm) — the inverse a maker needs when
 *  they know the millimetre size they're buying/setting. */
export function caratForMm(shapeId: string, stoneId: string, widthMm: number): number {
  const shape = shapeById(shapeId)
  const k = sizeK(stoneId)
  // width = mmFactor * cbrt(ct) * k  ⇒  ct = (width / (mmFactor * k))^3
  const r = widthMm / (shape.mmFactor * k)
  return Math.max(0, r * r * r)
}

/** Standard calibrated round-melee diameters (mm) the trade stocks. */
export const MELEE_MM = [
  0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9,
  2.0, 2.2, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0,
]

export interface MeleeOption { mm: number; carat: number; label: string }

/** Calibrated size list for a picker: each standard mm with its exact carat for
 *  the chosen stone + shape. Carats round to a sensible precision for melee. */
export function meleeOptions(stoneId: string, shapeId = 'rd'): MeleeOption[] {
  return MELEE_MM.map(mm => {
    const ct = caratForMm(shapeId, stoneId, mm)
    const carat = ct < 0.1 ? Math.round(ct * 1000) / 1000 : Math.round(ct * 100) / 100
    return { mm, carat, label: `${mm.toFixed(2)} mm · ${carat} ct` }
  })
}
