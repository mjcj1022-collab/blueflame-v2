import { describe, it, expect, beforeEach } from 'vitest'
import { patchFromSpec, buildSculptFromDesign } from '../lib/aiAssemble'
import { useModeler } from '../state/modeler'
import { useDesign } from '../state/design'
import { DEFAULT_SPEC, type DesignSpec } from '../spec/types'
import { alloyById, stoneById } from '../catalog'

const spec = (over: Partial<DesignSpec>): DesignSpec => ({ ...DEFAULT_SPEC, ...over })

describe('patchFromSpec — flattens a DesignSpec for the assembler', () => {
  it('carries ring geometry, alloy, stone and setting', () => {
    const s = spec({
      category: 'ring',
      metal: { ...DEFAULT_SPEC.metal, alloyId: '18kw' },
      center: { ...DEFAULT_SPEC.center, shapeId: 'ov', stoneTypeId: 'sap', carat: 1.5 },
      setting: { typeId: 'p6' },
      ring: { ...DEFAULT_SPEC.ring, size: 6.5, width: 2.4, profile: 'flat' },
    })
    const p = patchFromSpec(s)
    expect(p.category).toBe('ring')
    expect(p.alloyId).toBe('18kw')
    expect(p.stoneTypeId).toBe('sap')
    expect(p.carat).toBe(1.5)
    expect(p.settingId).toBe('p6')
    expect(p.size).toBe(6.5)
    expect(p.bandWidth).toBe(2.4)
    expect(p.bandProfile).toBe('flat')
  })

  it('carries necklace station stones', () => {
    const s = spec({
      category: 'necklace',
      necklace: { ...DEFAULT_SPEC.necklace, length: 20, station: { stoneId: 'rub', shapeId: 'rd', carat: 0.05, everyIn: 2 } },
    })
    const p = patchFromSpec(s)
    expect(p.category).toBe('necklace')
    expect(p.necklaceLength).toBe(20)
    expect(p.stationStoneId).toBe('rub')
    expect(p.stationEveryIn).toBe(2)
  })

  it('carries an eternity accent stone off the melee', () => {
    const s = spec({ category: 'ring', setting: { typeId: 'etr', melee: { stoneId: 'rub' } } })
    expect(patchFromSpec(s).accentStoneId).toBe('rub')
  })
})

describe('buildSculptFromDesign — necklace assembles real parts', () => {
  it('builds a chain loop with ruby stations coloured from the catalog', () => {
    const parts = buildSculptFromDesign({
      category: 'necklace', chainStyle: 'cable', necklaceLength: 18,
      stationStoneId: 'rub', stationCarat: 0.05, stationEveryIn: 2, alloyId: '14ky',
    })
    const chain = parts.find(p => p.material === 'metal')!
    const stones = parts.filter(p => p.material === 'gem')
    expect(chain).toBeTruthy()
    expect(chain.color).toBe(alloyById('14ky').color)
    expect(stones.length).toBeGreaterThan(0)
    expect(stones[0].color).toBe(stoneById('rub').color)
  })
})

describe('importFromDesign — studio piece lands on the bench', () => {
  beforeEach(() => {
    useModeler.setState({ objects: [], selectedId: null, past: [], future: [], placing: null })
    useDesign.setState({ spec: spec({
      category: 'ring',
      metal: { ...DEFAULT_SPEC.metal, alloyId: '14kr' },
      center: { ...DEFAULT_SPEC.center, shapeId: 'rd', stoneTypeId: 'dia', carat: 1 },
      setting: { typeId: 'p6' },
    }) })
  })
  it('imports the current design as editable parts and adopts its alloy', () => {
    const n = useModeler.getState().importFromDesign(useDesign.getState().spec, true)
    expect(n).toBeGreaterThan(0)
    const objs = useModeler.getState().objects
    expect(objs.some(o => o.kind === 'shank')).toBe(true)
    expect(objs.some(o => o.material === 'gem')).toBe(true)
    expect(useModeler.getState().alloyId).toBe('14kr')
  })
})
