import type { SculptObject } from '../state/modeler'
import { alloyById } from '../catalog'

/**
 * Quality-control checklist. The final pass before a piece leaves the shop, built
 * to what's actually on it: casting integrity, every stone secure and level, the
 * finish, the legal hallmark, and the numbers matching the order. A context-aware
 * checklist beats a generic one — it lists the exact stone count to verify and
 * only asks about prongs when there are prongs.
 */

export interface QcItem { section: string; check: string }

export function qcChecklist(objects: SculptObject[], alloyId: string): QcItem[] {
  const alloy = alloyById(alloyId)
  const gems = objects.filter(o => o.kind === 'gem')
  const heads = objects.filter(o => o.kind === 'head')
  const bezels = objects.filter(o => o.kind === 'bezel')
  const items: QcItem[] = []
  const add = (section: string, check: string) => items.push({ section, check })

  add('Casting', 'No porosity, pits or shrinkage on any surface')
  add('Casting', 'All sprue sites filed flush and blended')
  add('Casting', 'Full fill — no rounded or missing detail')

  if (gems.length) {
    add('Setting', `All ${gems.length} stone${gems.length === 1 ? '' : 's'} present, level and true`)
    add('Setting', 'Each stone secure — no movement when tapped')
    if (heads.length) add('Setting', 'Prongs even, tipped over the girdle, tips rounded')
    if (bezels.length) add('Setting', 'Bezel burnished evenly all around, no gaps at the rim')
    add('Setting', 'No bur marks or metal over the stones')
  }

  add('Finish', 'Even final finish, no file marks or scratches')
  add('Finish', 'Inside of the band smooth and comfortable')
  if (alloy.platable) add('Finish', 'Rhodium plating even, no bare patches')

  add('Compliance', `${alloy.hallmark} quality mark stamped and legible`)
  add('Compliance', 'Maker’s mark present')

  add('Final', 'Weight and dimensions match the order')
  add('Final', 'Ring size / length verified on the gauge')
  add('Final', 'Cleaned, and photographed for the record')
  return items
}

export function qcChecklistText(objects: SculptObject[], alloyId: string, brand = 'Blue Flame'): string {
  const items = qcChecklist(objects, alloyId)
  const lines: string[] = [`${brand.toUpperCase()} — QC CHECKLIST`, '']
  let section = ''
  for (const it of items) {
    if (it.section !== section) { section = it.section; lines.push('', section.toUpperCase()) }
    lines.push(`  [ ] ${it.check}`)
  }
  return lines.join('\n')
}
