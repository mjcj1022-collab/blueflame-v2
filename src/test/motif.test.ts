import { describe, it, expect } from 'vitest'
import { MOTIFS, MOTIF_IDS, motifVolumeMm3 } from '../lib/motif'
import { computeVolume } from '../lib/volume'
import { normalizeAiDesign } from '../lib/aiAssistant'
import { DEFAULT_SPEC, type NecklaceMotif, type DesignSpec } from '../spec/types'

const withMotif = (motif: NecklaceMotif): DesignSpec => ({
  ...DEFAULT_SPEC, category: 'necklace', necklace: { ...DEFAULT_SPEC.necklace, motif },
})

describe('motif library', () => {
  it('every motif has positive medallion volume', () => {
    for (const [id] of MOTIFS) {
      expect(motifVolumeMm3(id, 12, 1.2), id).toBeGreaterThan(0)
    }
    expect(motifVolumeMm3('none', 12, 1.2)).toBe(0)
  })

  it('each motif adds pendant mass to the chain', () => {
    const plain = computeVolume(withMotif('none')).total
    for (const [id] of MOTIFS) {
      expect(computeVolume(withMotif(id)).head, id).toBeGreaterThan(0)
      expect(computeVolume(withMotif(id)).total, id).toBeGreaterThan(plain)
    }
  })

  it('AI accepts every real motif and rejects unknowns', () => {
    for (const [id] of MOTIFS) {
      expect(normalizeAiDesign({ motif: id })?.motif, id).toBe(id)
    }
    expect(normalizeAiDesign({ motif: 'dragon' })).toBeNull()
  })

  it('MOTIF_IDS includes none plus every listed motif', () => {
    expect(MOTIF_IDS.has('none')).toBe(true)
    for (const [id] of MOTIFS) expect(MOTIF_IDS.has(id)).toBe(true)
  })
})
