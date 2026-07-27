import { describe, it, expect, beforeEach } from 'vitest'
import { buildSculptFromDesign } from '../lib/aiAssemble'
import { useModeler } from '../state/modeler'

describe('buildSculptFromDesign', () => {
  it('builds a prong-set solitaire: shank + gem + head', () => {
    const parts = buildSculptFromDesign({ category: 'ring', shapeId: 'rd', carat: 1, settingId: 'p6', size: 6.5 })
    const kinds = parts.map(p => p.kind)
    expect(kinds).toContain('shank')
    expect(kinds).toContain('gem')
    expect(kinds).toContain('head')
    const head = parts.find(p => p.kind === 'head')!
    expect(head.params!.prongs).toBe(6)
    const gem = parts.find(p => p.kind === 'gem')!
    // stone sits above the band (positive Y, above the ring radius)
    expect(gem.position[1]).toBeGreaterThan(8)
  })

  it('uses a bezel when the setting is bezel, and no head', () => {
    const parts = buildSculptFromDesign({ category: 'ring', shapeId: 'ov', carat: 1.2, settingId: 'bz' })
    expect(parts.some(p => p.kind === 'bezel')).toBe(true)
    expect(parts.some(p => p.kind === 'head')).toBe(false)
  })

  it('flush setting sinks the stone and adds no head', () => {
    const parts = buildSculptFromDesign({ category: 'ring', shapeId: 'rd', carat: 1, settingId: 'fl', size: 7 })
    expect(parts.filter(p => p.kind === 'gem')).toHaveLength(1)
    expect(parts.some(p => p.kind === 'head' || p.kind === 'bezel')).toBe(false)
  })

  it('halo setting adds a ring of accent stones around the centre', () => {
    const parts = buildSculptFromDesign({ category: 'ring', shapeId: 'rd', carat: 1, settingId: 'hal' })
    const gems = parts.filter(p => p.kind === 'gem')
    expect(gems.length).toBeGreaterThan(5) // centre + halo accents
  })

  it('a no-stone band is just a shank', () => {
    const parts = buildSculptFromDesign({ category: 'ring', stoneTypeId: 'none', bandWidth: 6 })
    expect(parts).toHaveLength(1)
    expect(parts[0].kind).toBe('shank')
    expect(parts[0].params!.width).toBe(6)
  })

  it('a pendant gets a stone, head and bail', () => {
    const parts = buildSculptFromDesign({ category: 'pendant', shapeId: 'pe', carat: 1 })
    expect(parts.some(p => p.kind === 'gem')).toBe(true)
    expect(parts.some(p => p.name === 'Bail')).toBe(true)
  })
})

describe('assembleDesign store action', () => {
  beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [] }))

  it('adds the assembled parts and can replace the scene', () => {
    const s = useModeler.getState()
    s.addObjects([{ kind: 'box', size: 4, material: 'metal', color: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }])
    const n = s.assembleDesign({ category: 'ring', shapeId: 'rd', carat: 1, settingId: 'p4' }, true)
    expect(n).toBeGreaterThan(1)
    // replace:true wiped the pre-existing box — no box remains
    expect(useModeler.getState().objects.some(o => o.kind === 'box')).toBe(false)
    expect(useModeler.getState().objects).toHaveLength(n)
  })

  it('appends when replace is false, and is undoable', () => {
    const s = useModeler.getState()
    s.assembleDesign({ category: 'ring', stoneTypeId: 'none' }, true) // one shank
    const before = useModeler.getState().objects.length
    s.assembleDesign({ category: 'ring', shapeId: 'rd', carat: 1, settingId: 'p4' }, false)
    expect(useModeler.getState().objects.length).toBeGreaterThan(before)
    useModeler.getState().undo()
    expect(useModeler.getState().objects.length).toBe(before)
  })
})
