import { NO_STONE, type ProductCategory } from '../spec/types'
import type { AiDesignPatch } from './aiAssistant'

/**
 * Design-quality guardrails applied to any design patch (AI-produced or preset)
 * before it drives geometry:
 *   validateDesign — strip fields that contradict the category or each other, so
 *     a spec is never self-contradictory (a "ring" carrying a chainStyle, a
 *     no-stone band still carrying a setting, etc.).
 *   completeDesign — fill the missing fields every buildable piece needs, so the
 *     output is a COMPLETE manufacturing spec rather than a sparse hint.
 *   proportionedCarat / bandWidthFor — professional proportions so generated
 *     pieces look designed, not arbitrary.
 * Pure and independently testable.
 */

// ring-only, necklace-only, etc. — fields that make no sense off their category
const RING_FIELDS: (keyof AiDesignPatch)[] = ['size', 'bandWidth', 'bandProfile']
const NECKLACE_FIELDS: (keyof AiDesignPatch)[] = ['chainStyle', 'necklaceLength', 'motif']
const EARRING_FIELDS: (keyof AiDesignPatch)[] = ['dropLength']
const BRACELET_FIELDS: (keyof AiDesignPatch)[] = ['braceletKind']
const BODY_FIELDS: (keyof AiDesignPatch)[] = ['bodyStyle', 'bodyGauge', 'bodySize']

const drop = (d: AiDesignPatch, keys: (keyof AiDesignPatch)[]) => { for (const k of keys) delete d[k] }

export interface ValidationResult { design: AiDesignPatch; fixes: string[] }

/** Remove fields that contradict the category or the stone choice. */
export function validateDesign(patch: AiDesignPatch): ValidationResult {
  const d: AiDesignPatch = { ...patch }
  const fixes: string[] = []

  // A piece that carries a motif is really a necklace medallion — normalise the
  // category FIRST, before the category-exclusive stripping below removes it.
  if (d.motif && d.motif !== 'none' && d.category && d.category !== 'necklace') {
    fixes.push(`a ${d.category} with a motif was set to a necklace so the medallion has a home`)
    d.category = 'necklace'
  }
  const cat = d.category

  // Category-exclusive fields: keep only those that belong to the set category.
  const groups: [ProductCategory, (keyof AiDesignPatch)[]][] = [
    ['ring', RING_FIELDS], ['necklace', NECKLACE_FIELDS],
    ['earring', EARRING_FIELDS], ['bracelet', BRACELET_FIELDS], ['body', BODY_FIELDS],
  ]
  if (cat) {
    for (const [c, fields] of groups) {
      if (c === cat) continue
      const present = fields.filter((f) => d[f] !== undefined)
      if (present.length) { drop(d, fields); fixes.push(`removed ${c} field(s) from a ${cat}: ${present.join(', ')}`) }
    }
  }

  // No centre stone → a setting and a carat are meaningless.
  if (d.stoneTypeId === NO_STONE) {
    const stripped: string[] = []
    if (d.settingId !== undefined) { delete d.settingId; stripped.push('settingId') }
    if (d.carat !== undefined) { delete d.carat; stripped.push('carat') }
    if (d.shapeId !== undefined) { delete d.shapeId; stripped.push('shapeId') }
    if (stripped.length) fixes.push(`no-stone piece: dropped ${stripped.join(', ')}`)
  }
  return { design: d, fixes }
}

/** Professional band width (mm) for a ring given the centre-stone carat. */
export function bandWidthFor(carat: number | undefined): number {
  if (!carat) return 2.0
  // grows gently with the stone, clamped to a wearable range
  return Math.min(4.5, Math.max(1.6, 1.6 + carat * 0.6))
}

/** A sensible default carat when a stone is implied but none was given. */
export function proportionedCarat(category: ProductCategory | undefined): number {
  if (category === 'pendant' || category === 'earring') return 0.5
  return 1
}

/** Fill every field a complete, buildable spec needs, without overwriting the
 *  caller's explicit choices. */
export function completeDesign(patch: AiDesignPatch): AiDesignPatch {
  const d: AiDesignPatch = { ...patch }
  const cat: ProductCategory = d.category ?? 'ring'
  d.category = cat
  d.alloyId = d.alloyId ?? '14ky'
  d.finish = d.finish ?? 'polish'

  const wantsStone = d.stoneTypeId !== NO_STONE && (d.stoneTypeId || d.shapeId || d.carat || cat === 'ring' || cat === 'pendant' || cat === 'earring')
  if (wantsStone) {
    d.shapeId = d.shapeId ?? 'rd'
    d.stoneTypeId = d.stoneTypeId ?? 'dia'
    d.carat = d.carat ?? proportionedCarat(cat)
  }

  if (cat === 'ring') {
    d.size = d.size ?? 6.5
    d.bandProfile = d.bandProfile ?? 'round'
    d.bandWidth = d.bandWidth ?? bandWidthFor(d.carat)
    if (d.stoneTypeId && d.stoneTypeId !== NO_STONE) d.settingId = d.settingId ?? 'p4'
  } else if (cat === 'necklace') {
    d.necklaceLength = d.necklaceLength ?? 18
    d.chainStyle = d.chainStyle ?? 'cable'
  } else if (cat === 'earring') {
    d.dropLength = d.dropLength ?? 0
    if (d.stoneTypeId && d.stoneTypeId !== NO_STONE) d.settingId = d.settingId ?? 'p4'
  } else if (cat === 'bracelet') {
    d.braceletKind = d.braceletKind ?? 'tennis'
  } else if (cat === 'body') {
    d.bodyStyle = d.bodyStyle ?? 'barbell'
    d.bodyGauge = d.bodyGauge ?? 1.6
    d.bodySize = d.bodySize ?? 8
  }
  return d
}

/** Full pipeline: repair contradictions, then complete the spec. */
export function refineDesign(patch: AiDesignPatch): ValidationResult {
  const { design, fixes } = validateDesign(patch)
  return { design: completeDesign(design), fixes }
}
