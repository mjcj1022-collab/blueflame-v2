import type { DesignSpec } from '../spec/types'
import { usesSetting, stoneOnPiece, NO_STONE } from '../spec/types'
import { settingById, shapeById, stoneById, stoneMm, finishById, alloyById, isGradeable, gradeMultiplier, DEFAULT_GRADING, meleeQuality, meleeStyle } from '../catalog'
import { computeMetal, type MetalResult } from './metal'
import { engraveFee } from './engrave'
import { isHidden } from './features'
import { MARKET } from './market'
import { settingSizeMultiplier, finishingFee } from './labor'

export const FINISH_FEE = 95     // cast, file, sand, pre-polish, final polish
export const RHODIUM_FEE = 45    // white-metal rhodium plating pass
export const MARGIN = 1.35

export interface PriceResult {
  metal: MetalResult
  metalCost: number
  stoneCost: number
  stoneCount: number
  settingFee: number
  accentCost: number
  accentCount: number
  platingFee: number
  finishFee: number
  finishExtra: number
  engraveFee: number
  subtotal: number
  total: number
}

export const MELEE_LABOR_EACH = 12   // bead/channel setting labor per accent stone

/**
 * How many set stones the piece carries, and the carat of each. A pair of studs
 * is two stones; a tennis bracelet is `linkCount` stones; a plain band is none.
 */
export function stoneUnits(spec: DesignSpec): { count: number; caratEach: number } {
  if (spec.center.stoneTypeId === NO_STONE) return { count: 0, caratEach: 0 }
  const ct = spec.center.carat
  switch (spec.category) {
    case 'ring':     return { count: 1, caratEach: ct }
    case 'pendant':  return { count: 1, caratEach: ct }
    case 'earring':  return { count: spec.earring.pair ? 2 : 1, caratEach: ct }
    case 'bracelet': return spec.bracelet.kind === 'tennis'
      ? { count: spec.bracelet.linkCount, caratEach: ct / Math.max(spec.bracelet.linkCount, 1) }
      : { count: 0, caratEach: 0 }
    case 'necklace': return spec.necklace.hasPendant ? { count: 1, caratEach: ct } : { count: 0, caratEach: 0 }
    case 'body':     return { count: 0, caratEach: 0 }   // gem ends are priced with the piece, not as set stones
  }
}

export function computePrice(spec: DesignSpec): PriceResult {
  const metal = computeMetal(spec)
  const stone = stoneById(spec.center.stoneTypeId)
  const setting = settingById(spec.setting.typeId)
  const { count, caratEach } = stoneUnits(spec)

  const gm = isGradeable(spec.center.stoneTypeId) ? gradeMultiplier(spec.center.grading ?? DEFAULT_GRADING) : 1
  const stoneCost = count > 0 && !isHidden(spec, 'stone') ? count * stone.rate * Math.pow(caratEach, stone.exponent) * gm : 0
  // The style sets the rate (a bezel costs more than prongs); the stone's size
  // scales it — seating a 3 ct is not the same job as seating a 0.3 ct.
  const settingFee = usesSetting(spec.category) && count > 0 && !isHidden(spec, 'head')
    ? count * setting.fee * settingSizeMultiplier(caratEach) : 0

  // Accent stones (halo, pavé, channel, three-stone sides): cheaper per-ct
  // melee plus bead-setting labor. Count, size, quality and setting style are
  // designer-overridable.
  const mOver = spec.setting.melee
  // Accents price with a centre stone (halo/pavé/sides) or, for an eternity
  // band, on their own — stones set all the way around, no centre needed.
  const meleeActive = (count > 0 || setting.allAround) && setting.melee && !isHidden(spec, 'halo')
  const melee = meleeActive ? (mOver?.count ?? setting.melee ?? 0) : 0
  const accentCt = mOver?.caratEach ?? setting.accentCt ?? 0.01
  const qMult = meleeQuality(mOver?.quality ?? 'gh').mult
  const sMult = meleeStyle(mOver?.style ?? 'bright').mult
  const accentCost = melee * (stone.rate * 0.5 * qMult) * Math.pow(accentCt, stone.exponent) + melee * MARKET.meleeLabor * sMult

  const platingFee = spec.metal.rhodium && metal.alloy.platable ? MARKET.rhodiumFee : 0
  const finishExtra = finishById(spec.finish).fee
  const engrave = isHidden(spec, 'engraving') ? 0 : engraveFee(spec)
  // Finishing scales with the metal that actually has to be filed and polished.
  const finish = finishingFee(metal.cast)
  const subtotal = metal.netMetalCost + stoneCost + settingFee + accentCost + platingFee + finish + finishExtra + engrave

  return {
    metal,
    metalCost: metal.netMetalCost,
    stoneCost,
    stoneCount: count,
    settingFee,
    accentCost,
    accentCount: melee,
    platingFee,
    finishFee: finish,
    finishExtra,
    engraveFee: engrave,
    subtotal,
    total: subtotal * MARKET.margin
  }
}

export interface Guardrail {
  level: 'warn' | 'note' | 'ok'
  title: string
  body: string
}

/** Wearability and setting advice derived from the spec. */
export function guardrails(spec: DesignSpec): Guardrail[] {
  const out: Guardrail[] = []
  const stone = stoneById(spec.center.stoneTypeId)
  const setting = settingById(spec.setting.typeId)
  const shape = shapeById(spec.center.shapeId)
  const { width } = stoneMm(shape, spec.center.carat)
  const daily = spec.category === 'ring' || spec.category === 'bracelet'

  if (stoneOnPiece(spec)) {
    if (stone.mohs < 7 && daily) {
      out.push({
        level: 'warn',
        title: 'Not for daily wear',
        body: `${stone.name} is Mohs ${stone.mohs}. It will abrade and chip in a piece worn every day. Better suited to a pendant or an occasional-wear piece.${stone.care ? ' ' + stone.care : ''}`
      })
    } else if (stone.mohs < 8 && daily) {
      out.push({
        level: 'note',
        title: 'Wear with care',
        body: `Mohs ${stone.mohs}. Fine, but remove it for manual work.${stone.care ? ' ' + stone.care : ''}`
      })
    }

    if (setting.bezel && stone.mohs < 8) {
      out.push({ level: 'ok', title: 'Good pairing', body: 'A bezel protects the girdle, which is the right call for a softer stone.' })
    }
    if (!setting.bezel && setting.prongs === 4 && spec.center.carat >= 2) {
      out.push({ level: 'note', title: 'Consider six prongs', body: `At ${spec.center.carat.toFixed(2)} ct, four prongs leave more girdle exposed than most setters are comfortable with.` })
    }
    if (['ma', 'pe', 'he'].includes(shape.id) && !setting.bezel && setting.prongs < 6) {
      out.push({ level: 'note', title: 'Protect the point', body: `${shape.name} cuts have a vulnerable tip. Specify a V-prong at the point or move to a bezel.` })
    }
    if (stone.labGrown) {
      out.push({ level: 'note', title: 'Disclosure required', body: 'Laboratory-grown origin must be disclosed on the quote, the appraisal and any advertising. Handled automatically on generated documents.' })
    }
  }

  if (spec.category === 'ring' && width > spec.ring.width * 3.4 && spec.ring.thickness < 1.8) {
    out.push({ level: 'warn', title: 'Shank may be under-built', body: `A ${width.toFixed(1)} mm stone on a ${spec.ring.width.toFixed(1)} x ${spec.ring.thickness.toFixed(1)} mm shank is top-heavy and will spin. Increase thickness to at least 1.8 mm.` })
  }

  // Compliance surfacing (spec §10)
  const alloy = alloyById(spec.metal.alloyId)
  if (!alloy.nickelFree) {
    out.push({ level: 'warn', title: 'Nickel content', body: `${alloy.name} contains nickel; the EU restricts prolonged skin contact. Offer a nickel-free alternative for sensitive clients.` })
  }
  if (usesSetting(spec.category) && stoneOnPiece(spec) && /not/i.test(setting.resizeRange)) {
    out.push({ level: 'note', title: 'Confirm size before casting', body: `A ${setting.name.toLowerCase()} setting ${setting.resizeRange}. Surface this to the client at design time, not after casting.` })
  }

  return out
}
