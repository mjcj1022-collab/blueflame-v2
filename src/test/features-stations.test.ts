import { describe, it, expect } from 'vitest'
import { designFeatures } from '../lib/features'
import { DEFAULT_SPEC, type DesignSpec } from '../spec/types'

const spec = (over: Partial<DesignSpec>): DesignSpec => ({ ...DEFAULT_SPEC, ...over })

describe('designFeatures — stations & eternity in the attributes list', () => {
  it('lists station stones on a necklace as a removable row', () => {
    const s = spec({
      category: 'necklace',
      necklace: { ...DEFAULT_SPEC.necklace, station: { stoneId: 'rub', shapeId: 'rd', carat: 0.05, everyIn: 2 } },
    })
    const keys = designFeatures(s).map(f => f.key)
    expect(keys).toContain('station')
    const row = designFeatures(s).find(f => f.key === 'station')!
    expect(row.label.toLowerCase()).toContain('ruby')
  })

  it('lists an eternity accent row on a ring', () => {
    const s = spec({
      category: 'ring',
      setting: { typeId: 'etr', melee: { stoneId: 'rub' } },
    })
    const row = designFeatures(s).find(f => f.key === 'halo')
    expect(row).toBeTruthy()
    expect(row!.label.toLowerCase()).toContain('ruby')
  })

  it('has no station row when the necklace has no stations', () => {
    const s = spec({ category: 'necklace' })
    expect(designFeatures(s).some(f => f.key === 'station')).toBe(false)
  })
})
