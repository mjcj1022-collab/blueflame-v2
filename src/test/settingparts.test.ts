import { describe, it, expect, beforeEach } from 'vitest'
import { basketVertices, galleryRailVertices } from '../lib/settingParts'
import { useModeler, type SculptObject } from '../state/modeler'

describe('setting parts geometry', () => {
  it('basket is a valid non-empty soup that scales with more wires', () => {
    const b4 = basketVertices(3, 3.3, 4)
    const b6 = basketVertices(3, 3.3, 6)
    expect(b4.length).toBeGreaterThan(0)
    expect(b4.length % 9).toBe(0)
    expect(b4.every(Number.isFinite)).toBe(true)
    expect(b6.length).toBeGreaterThan(b4.length)   // more struts → more triangles
  })
  it('gallery rail is a valid ring soup', () => {
    const g = galleryRailVertices(4)
    expect(g.length).toBeGreaterThan(0)
    expect(g.length % 9).toBe(0)
  })
})

const head = (): SculptObject => ({ id: 'h', kind: 'head', name: '6-prong head', position: [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { prongs: 6, stoneW: 6.5, height: 4 } })
const gem = (): SculptObject => ({ id: 'g', kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1 } })

describe('addBasket store action', () => {
  beforeEach(() => useModeler.setState({ objects: [head()], selectedId: null, past: [], future: [], placing: null, importedSig: null, explode: 0, snapshots: [] }))
  it('adds a basket mesh under a head, sized to the stone', () => {
    const ok = useModeler.getState().addBasket('h')
    expect(ok).toBe(true)
    const basket = useModeler.getState().objects.find(o => o.name === 'Basket')!
    expect(basket.kind).toBe('mesh')
    expect(basket.material).toBe('metal')
    expect(basket.vertices!.length).toBeGreaterThan(0)
    expect(basket.position[1]).toBeLessThan(6)   // seated below the head origin
  })
  it('works under a gem too', () => {
    useModeler.setState({ objects: [gem()] })
    expect(useModeler.getState().addBasket('g')).toBe(true)
  })
})
