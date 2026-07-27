import { describe, it, expect, beforeEach } from 'vitest'
import { useModeler } from '../state/modeler'
import { buildSculptFromDesign } from '../lib/aiAssemble'
import { normalizeAiDesign } from '../lib/aiAssistant'
import { validateDesign } from '../lib/designRules'
import { alloyById, stoneById } from '../catalog'

describe('assembled parts use real catalog colours', () => {
  it('metal parts take the alloy colour and gems take the stone colour', () => {
    const parts = buildSculptFromDesign({ category: 'ring', alloyId: '14kr', shapeId: 'ov', stoneTypeId: 'sap', carat: 1, settingId: 'p6' })
    const metal = parts.find(p => p.material === 'metal')!
    const gem = parts.find(p => p.material === 'gem')!
    expect(metal.color).toBe(alloyById('14kr').color) // rose gold
    expect(gem.color).toBe(stoneById('sap').color)    // sapphire blue
  })
})

describe('setAlloy recolours metal', () => {
  beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [], placing: null }))
  it('recolours all metal parts and leaves gems alone', () => {
    const s = useModeler.getState()
    s.addObjects([
      { kind: 'shank', size: 6, material: 'metal', color: 0x000000, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { kind: 'gem', size: 6, material: 'gem', color: 0x123456, position: [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], params: { shapeId: 'rd', carat: 1 } },
    ])
    s.setAlloy('18kw')
    const objs = useModeler.getState().objects
    expect(objs.find(o => o.material === 'metal')!.color).toBe(alloyById('18kw').color)
    expect(objs.find(o => o.material === 'gem')!.color).toBe(0x123456) // gem untouched
  })
})

describe('addStone', () => {
  beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [], placing: null }))
  it('drops a stone of the chosen type, coloured and selected', () => {
    const id = useModeler.getState().addStone({ stoneId: 'rub', shapeId: 'rd', carat: 0.25, position: [3, 4, -2] })
    const o = useModeler.getState().objects.find(x => x.id === id)!
    expect(o.material).toBe('gem')
    expect(o.color).toBe(stoneById('rub').color)
    expect(o.params!.stoneTypeId).toBe('rub')
    expect(o.position).toEqual([3, 4, -2])
    expect(useModeler.getState().selectedId).toBe(id)
  })
})

describe('necklace station stones (rubies by the yard)', () => {
  it('parses and validates station fields on a necklace', () => {
    const d = normalizeAiDesign({ category: 'necklace', chainStyle: 'cable', stationStoneId: 'rub', stationCarat: 0.05, stationEveryIn: 2 })!
    expect(d.stationStoneId).toBe('rub')
    expect(d.stationEveryIn).toBe(2)
    // valid on a necklace
    expect(validateDesign(d).design.stationStoneId).toBe('rub')
  })
  it('strips station fields off a ring', () => {
    const { design } = validateDesign({ category: 'ring', stationStoneId: 'rub', stationEveryIn: 2, shapeId: 'rd' })
    expect(design.stationStoneId).toBeUndefined()
  })
  it('rejects a hallucinated station stone id', () => {
    const d = normalizeAiDesign({ category: 'necklace', stationStoneId: 'zzz', stationCarat: 0.05 })
    expect(d?.stationStoneId).toBeUndefined()
  })
})
