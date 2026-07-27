import { shapeById, stoneById, alloyById } from '../catalog'
import type { SculptObject } from '../state/modeler'

/**
 * Turn the parts on the bench into words: a short plain-language description, a
 * concise auto-name, and a set of style tags. Used for the spec sheet, saved-
 * sculpt names, and eventual listing copy — so a maker never has to hand-write
 * "1.00 ct round diamond solitaire in 14K yellow" for every piece.
 */

export interface PieceDescription {
  name: string
  sentence: string
  tags: string[]
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function describePiece(objects: SculptObject[], alloyId: string): PieceDescription {
  const gems = objects.filter((o) => o.material === 'gem')
  const hasShank = objects.some((o) => o.kind === 'shank')
  const hasHead = objects.some((o) => o.kind === 'head')
  const hasBezel = objects.some((o) => o.kind === 'bezel')
  const hasBail = objects.some((o) => o.name === 'Bail')
  const alloyName = alloyById(alloyId).name

  if (!objects.length) return { name: 'Empty piece', sentence: 'Nothing on the bench yet.', tags: [] }

  // The centre stone is the largest gem; the rest are accents.
  const sorted = [...gems].sort((a, b) => (b.params?.carat ?? 0) - (a.params?.carat ?? 0))
  const centre = sorted[0]
  const accents = sorted.slice(1)
  const tags: string[] = []

  const kind = hasShank ? 'ring' : hasBail ? 'pendant' : gems.length && !hasShank ? 'piece' : 'band'
  tags.push(kind)

  let stonePhrase = ''
  if (centre) {
    const shape = shapeById(centre.params?.shapeId ?? 'rd').name.toLowerCase()
    const stone = stoneById(centre.params?.stoneTypeId ?? 'dia').name.toLowerCase()
    const ct = (centre.params?.carat ?? 0).toFixed(2)
    stonePhrase = `${ct} ct ${shape} ${stone}`
    tags.push(shape)
  }

  // Setting style
  let style = ''
  if (accents.length >= 5) { style = 'halo'; tags.push('halo') }
  else if (accents.length >= 1 && accents.length <= 3) { style = 'accented'; tags.push('accented') }
  else if (centre) { style = 'solitaire'; tags.push('solitaire') }
  if (hasBezel) tags.push('bezel')
  else if (hasHead) tags.push('prong-set')

  const settingWord = hasBezel ? 'bezel-set' : hasHead ? 'prong-set' : ''
  const styleWord = style === 'halo' ? 'halo' : style === 'solitaire' ? 'solitaire' : ''

  const namePieces = [
    centre ? stonePhrase : null,
    styleWord || (kind === 'ring' && !centre ? 'band' : null),
    kind === 'ring' ? 'ring' : kind === 'pendant' ? 'pendant' : kind,
    `in ${alloyName}`,
  ].filter(Boolean)
  const name = cap(namePieces.join(' '))

  const sentenceBits: string[] = []
  if (centre) sentenceBits.push(`A ${stonePhrase} centre`)
  else sentenceBits.push(`A ${alloyName} ${kind}`)
  if (settingWord && centre) sentenceBits.push(`${settingWord}`)
  if (style === 'halo') sentenceBits.push(`framed by a ${accents.length}-stone halo`)
  else if (accents.length) sentenceBits.push(`with ${accents.length} accent stone${accents.length === 1 ? '' : 's'}`)
  if (centre) sentenceBits.push(`in ${alloyName}`)
  const sentence = sentenceBits.join(' ').replace(/\s+/g, ' ') + '.'

  return { name, sentence, tags: [...new Set(tags)] }
}
