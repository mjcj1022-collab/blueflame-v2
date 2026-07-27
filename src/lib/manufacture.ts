import type { DesignSpec } from '../spec/types'
import { stoneOnPiece } from '../spec/types'
import { alloyById, shapeById, stoneMm, settingById } from '../catalog'
import { computeMetal } from './metal'
import { stoneUnits } from './pricing'

/**
 * Automated manufacturability checks — the pass a shop runs before committing a
 * design to wax. Heuristic, calibrated to catch the mistakes that scrap a
 * casting: thin walls, undersized prongs, stones too tight to set, pieces too
 * heavy to wear, features below printer resolution.
 */
export type CheckLevel = 'pass' | 'warn' | 'fail'

export interface Check {
  id: string
  level: CheckLevel
  title: string
  detail: string
}

/** Minimum sound wall thickness by metal family, mm. Silver flows thinner; a
 *  bench that uses one number for every alloy porosity-fails gold. */
function minWall(symbol: string): number {
  switch (symbol) {
    case 'Ag': return 0.80
    case 'Pt': return 0.90
    case 'Pd': return 0.85
    default: return 1.00   // gold
  }
}

/** Minimum sound casting wall (mm) for a given alloy id — the number the
 *  print-readiness gate checks the actual geometry against. */
export function minWallForAlloy(alloyId: string): number {
  return minWall(alloyById(alloyId).symbol)
}

const MIN_PRINTABLE = 0.35   // mm, feature a resin printer can hold reliably

export function manufacturabilityChecks(spec: DesignSpec): Check[] {
  const out: Check[] = []
  const alloy = alloyById(spec.metal.alloyId)
  const m = computeMetal(spec)
  const wall = minWall(alloy.symbol)

  // Wall thickness (ring / bangle / cuff have a structural section)
  if (spec.category === 'ring') {
    const t = spec.ring.thickness
    out.push(t < wall
      ? { id: 'wall', level: 'fail', title: 'Shank too thin', detail: `${t.toFixed(1)} mm is below the ${wall.toFixed(2)} mm minimum for ${alloy.name}. It will cast porous and bend in wear.` }
      : t < wall * 1.35
        ? { id: 'wall', level: 'warn', title: 'Shank on the thin side', detail: `${t.toFixed(1)} mm is castable in ${alloy.name} but leaves little margin. Consider ${(wall * 1.4).toFixed(1)} mm.` }
        : { id: 'wall', level: 'pass', title: 'Wall thickness OK', detail: `${t.toFixed(1)} mm clears the ${wall.toFixed(2)} mm minimum for ${alloy.name}.` })

    // Unsupported wide-thin band
    if (spec.ring.width > spec.ring.thickness * 4)
      out.push({ id: 'span', level: 'warn', title: 'Wide, flat shank', detail: `A ${spec.ring.width.toFixed(1)} mm band only ${spec.ring.thickness.toFixed(1)} mm thick can warp on cooling and dent in wear. Add thickness or a comfort dome.` })
  }

  if (spec.category === 'bracelet' && (spec.bracelet.kind === 'bangle' || spec.bracelet.kind === 'cuff')) {
    const t = spec.bracelet.thickness
    if (t < wall)
      out.push({ id: 'wall', level: 'fail', title: 'Bangle wall too thin', detail: `${t.toFixed(1)} mm is below the ${wall.toFixed(2)} mm minimum for ${alloy.name}.` })
    else out.push({ id: 'wall', level: 'pass', title: 'Wall thickness OK', detail: `${t.toFixed(1)} mm section clears the minimum.` })
  }

  // Stone-carrying checks
  if (stoneOnPiece(spec)) {
    const setting = settingById(spec.setting.typeId)
    const { count, caratEach } = stoneUnits(spec)
    const shape = shapeById(spec.center.shapeId)
    const sW = stoneMm(shape, caratEach).width
    const prongR = 0.42 + sW * 0.012

    // Prong stock vs printer resolution
    out.push(prongR < MIN_PRINTABLE
      ? { id: 'prong-res', level: 'warn', title: 'Fine prongs', detail: `Prongs at ${prongR.toFixed(2)} mm approach printer/casting resolution. Hand-fabricated prongs may be safer.` }
      : { id: 'prong-res', level: 'pass', title: 'Prongs printable', detail: `Prong stock ${prongR.toFixed(2)} mm is comfortably above ${MIN_PRINTABLE} mm.` })

    // Prong count vs stone size
    if (!setting.bezel && setting.prongs <= 4 && caratEach >= 1.5)
      out.push({ id: 'prong-count', level: 'warn', title: 'Consider more prongs', detail: `A ${caratEach.toFixed(2)} ct stone on ${setting.prongs} prongs leaves girdle exposed. Six prongs or a bezel hold it more securely.` })

    // Bezel closed void
    if (setting.bezel)
      out.push({ id: 'void', level: 'warn', title: 'Add a cleaning hole', detail: 'A full bezel traps investment and dirt. Pierce the seat so it casts clean and can be cleaned in wear.' })

    // Tennis stone-to-stone spacing
    if (spec.category === 'bracelet' && spec.bracelet.kind === 'tennis') {
      const length = spec.bracelet.wristCircumference + spec.bracelet.fitAllowance
      const pitch = length / count
      const gap = pitch - sW
      out.push(gap < 0.2
        ? { id: 'spacing', level: 'fail', title: 'Stones too tight', detail: `At ${count} stones on ${length.toFixed(0)} mm the seats overlap (${gap.toFixed(2)} mm gap). Reduce the count or the carat.` }
        : gap < 0.5
          ? { id: 'spacing', level: 'warn', title: 'Tight stone spacing', detail: `${gap.toFixed(2)} mm between stones is setable but unforgiving. 0.5–0.8 mm is easier to bead-set.` }
          : { id: 'spacing', level: 'pass', title: 'Stone spacing OK', detail: `${gap.toFixed(2)} mm between ${count} stones.` })
    }
  }

  // Wearable weight
  const heavy: Partial<Record<DesignSpec['category'], number>> = { ring: 14, earring: 8, pendant: 18 }
  const limit = heavy[spec.category]
  if (limit && m.finished > limit) {
    out.push(spec.category === 'earring'
      ? { id: 'weight', level: 'warn', title: 'Heavy for the lobe', detail: `${m.finished.toFixed(1)} g per pair will drag on the earlobe over a day. Lighten the drop or hollow the back.` }
      : { id: 'weight', level: 'warn', title: 'Heavy piece', detail: `${m.finished.toFixed(1)} g finished is wearable but substantial. Consider hollowing or reducing the shank.` })
  }

  return out
}

export const checkSummary = (checks: Check[]) => ({
  fail: checks.filter(c => c.level === 'fail').length,
  warn: checks.filter(c => c.level === 'warn').length,
  pass: checks.filter(c => c.level === 'pass').length
})
