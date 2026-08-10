import type { DesignSpec } from '../spec/types'
import { alloyById, shapeById, stoneById, settingById, stoneMm, isGradeable, gradeLabel } from '../catalog'
import { computePrice, stoneUnits } from './pricing'
import { computeMetal } from './metal'
import { money, gToDwt } from './units'

/** Retail replacement multiplier for insurance (above the shop quote). */
export const APPRAISAL_MULTIPLIER = 1.15

/**
 * A formal insurance appraisal, generated from the same spec as everything else
 * — metal, graded stone, certificate, and an estimated retail replacement value.
 */
export function appraisal(spec: DesignSpec, brand = 'MANDREL', dateStr = new Date().toLocaleDateString()): string {
  const p = computePrice(spec)
  const m = computeMetal(spec)
  const alloy = alloyById(spec.metal.alloyId)
  const shape = shapeById(spec.center.shapeId)
  const stone = stoneById(spec.center.stoneTypeId)
  const setting = settingById(spec.setting.typeId)
  const { count, caratEach } = stoneUnits(spec)
  const mm = stoneMm(shape, caratEach)
  const replacement = p.total * APPRAISAL_MULTIPLIER

  const lines = [
    `${brand} — INSURANCE APPRAISAL`,
    `Date of appraisal   ${dateStr}`,
    '',
    'ITEM',
    `  Type              ${spec.category.charAt(0).toUpperCase() + spec.category.slice(1)}`,
    `  Metal             ${alloy.name}${spec.metal.twoTone && spec.metal.headAlloyId ? ` + ${alloyById(spec.metal.headAlloyId).name} head` : ''}`,
    `  Finished weight   ${m.finished.toFixed(2)} g  (${gToDwt(m.finished).toFixed(2)} dwt)`,
    `  Hallmark          ${alloy.hallmark}`,
    `  Finish            ${spec.finish}`,
  ]

  if (count > 0) {
    lines.push(
      '',
      count > 1 ? `CENTER / MELEE (${count} stones)` : 'CENTER STONE',
      `  Description       ${caratEach.toFixed(2)} ct ${shape.name} ${stone.name} (${stone.variety})`,
      `  Measurements      ${mm.length.toFixed(2)} x ${mm.width.toFixed(2)} mm`,
      `  Total carat       ${(count * caratEach).toFixed(2)} ct`,
    )
    if (isGradeable(spec.center.stoneTypeId)) {
      lines.push(`  Grade             ${gradeLabel(spec.center.grading)}, ${spec.center.grading.fluorescence} fluorescence`)
      lines.push(`  Certificate       ${spec.center.cert.lab === 'none' ? 'Not certified' : `${spec.center.cert.lab} ${spec.center.cert.number || '(number pending)'}`}`)
    }
    lines.push(`  Origin/treatment  ${stone.labGrown ? 'Laboratory-grown' : 'Natural'}${stone.treatment ? `, ${stone.treatment}` : ''}`)
    lines.push(`  Setting           ${setting.name} (${setting.variety})`)
  }

  lines.push(
    '',
    'VALUATION',
    `  Shop estimate     ${money(p.total)}`,
    `  RETAIL REPLACEMENT ${money(replacement)}`,
    '',
    'STATEMENT',
    `  This appraisal states the estimated retail replacement value of the item`,
    `  described above as of the date of appraisal, for insurance purposes. It is`,
    `  not an offer to purchase. Values reflect current materials and labor and`,
    `  should be reviewed periodically as metal and stone markets move.`,
  )
  if (stone.labGrown && count > 0) lines.push('  Laboratory-grown center stone — disclosed per FTC guidance.')
  lines.push('', '  Appraiser _______________________   Signature _______________________')

  return lines.join('\n')
}
