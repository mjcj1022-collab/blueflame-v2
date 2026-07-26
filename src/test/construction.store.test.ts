import { describe, it, expect, beforeEach } from 'vitest'
import { useModeler, type SculptObject } from '../state/modeler'
import { gemDiameterMm } from '../lib/setting'
import { haloRadius } from '../lib/construction'
import { stoneMm, shapeById } from '../catalog'

const s = () => useModeler.getState()
const part = (over: Partial<SculptObject>): Omit<SculptObject, 'id' | 'name'> => ({
  kind: 'box', size: 6, material: 'metal', color: 0xffffff,
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], ...over,
})
const gem = (over: Partial<SculptObject> = {}) =>
  part({ kind: 'gem', material: 'gem', position: [0, 5, 0], params: { shapeId: 'rd', carat: 1 }, ...over })

beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [] }))

describe('addHalo', () => {
  it('rings the centre stone with accents on a hugging circle', () => {
    s().addObjects([gem()])
    const center = s().objects[0]
    const n = s().addHalo(center.id, 10, 0.03)
    expect(n).toBe(10)
    const halo = s().objects.filter(o => o.name.startsWith('Halo'))
    expect(halo).toHaveLength(10)
    const centerDia = gemDiameterMm(center)
    const smallDia = stoneMm(shapeById('rd'), 0.03).width
    const expectedR = haloRadius(centerDia, smallDia, smallDia * 0.1)
    for (const h of halo) {
      const r = Math.hypot(h.position[0] - center.position[0], h.position[2] - center.position[2])
      expect(r).toBeCloseTo(expectedR, 4)
      expect(h.position[1]).toBeCloseTo(center.position[1], 6) // same height as centre
    }
  })
  it('needs a gem and at least three accents', () => {
    s().addObjects([part({})])
    expect(s().addHalo(s().objects[0].id, 10, 0.03)).toBe(0)
    s().addObjects([gem()])
    expect(s().addHalo(s().objects.find(o => o.kind === 'gem')!.id, 2, 0.03)).toBe(0)
  })
})

describe('addChannelRails', () => {
  it('adds two metal rails and selects the first', () => {
    expect(s().addChannelRails({ center: [0, 0, 0], length: 12, innerGap: 2, height: 2, thickness: 0.8, along: 'x' })).toBe(true)
    const rails = s().objects.filter(o => o.name.startsWith('Rail'))
    expect(rails).toHaveLength(2)
    expect(rails.every(r => r.material === 'metal')).toBe(true)
    // symmetric on Z
    expect(rails[0].position[2]).toBeCloseTo(-rails[1].position[2], 6)
  })
})

describe('flushSet', () => {
  it('sinks the stone into the metal below and carves a seat', () => {
    // a wide flat slab whose top sits near y≈+3, with a gem hovering above it
    s().addObjects([part({ kind: 'box', size: 6, position: [0, 0, 0] })])
    s().addObjects([gem({ position: [0, 4, 0] })])
    const gemId = s().objects.find(o => o.material === 'gem')!.id
    const baseId = s().objects.find(o => o.material === 'metal')!.id
    expect(s().flushSet(gemId)).toBe(true)
    const g = s().objects.find(o => o.id === gemId)!
    // stone dropped from y=4 down to near the slab surface (~3)
    expect(g.position[1]).toBeLessThan(4)
    expect(g.position[1]).toBeGreaterThan(1)
    // base became a carved mesh
    const base = s().objects.find(o => o.id === baseId)!
    expect(base.kind).toBe('mesh')
    expect(base.vertices!.length % 9).toBe(0)
  })

  it('fails when no metal sits under the stone', () => {
    s().addObjects([gem({ position: [0, 4, 0] })])
    expect(s().flushSet(s().objects[0].id)).toBe(false)
  })
})
