import { alloyById, shapeById, stoneById, settingById } from '../catalog'
import { stoneOnPiece, NO_STONE, CATEGORY_LABEL, type DesignSpec } from '../spec/types'
import { formatSize } from './sizing'

/**
 * A short, human-readable summary of the current design — the one-line brief the
 * assistant reacts to when suggesting a next move. Kept pure (no React, no state)
 * so it's cheap to unit-test and reuse anywhere a plain description is needed.
 */
export function summarizeDesign(spec: DesignSpec): string {
  const parts: string[] = [CATEGORY_LABEL[spec.category]]
  parts.push(alloyById(spec.metal.alloyId).name)
  if (stoneOnPiece(spec) && spec.center.stoneTypeId !== NO_STONE) {
    parts.push(`${spec.center.carat.toFixed(2)}ct ${shapeById(spec.center.shapeId).name} ${stoneById(spec.center.stoneTypeId).name}`)
    parts.push(`${settingById(spec.setting.typeId).name} setting`)
  } else parts.push('no center stone')
  if (spec.category === 'ring') parts.push(`size ${formatSize(spec.ring.size)}`)
  parts.push(`${spec.finish} finish`)
  return parts.join(', ')
}
