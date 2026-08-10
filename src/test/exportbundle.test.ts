import { describe, it, expect } from 'vitest'
import { assembleAllExports, assembleCollectionExports } from '../lib/exportBundle'
import type { SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })
const gem = (): SculptObject => ({ id: 'g', kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1 } })

const keys = (m: Record<string, Uint8Array>) => Object.keys(m)
const has = (m: Record<string, Uint8Array>, suffix: string) => keys(m).some(k => k.endsWith(suffix))

describe('assembleAllExports', () => {
  it('an empty bench yields no files', () => {
    expect(keys(assembleAllExports([], '14ky', { shopName: 'Test Shop' })).length).toBe(0)
  })

  it('bundles the CAD/mesh formats for a real piece', () => {
    const f = assembleAllExports([shank(), gem()], '14ky', { shopName: 'Test Shop', today: '2026-01-01' })
    expect(has(f, '.stl')).toBe(true)
    expect(has(f, '.obj')).toBe(true)
    expect(has(f, 'mandrel.mtl')).toBe(true)
    expect(has(f, '.step')).toBe(true)
    expect(has(f, '.dxf')).toBe(true)
    expect(has(f, '-spec.svg')).toBe(true)
    expect(has(f, '.3mf')).toBe(true)
  })

  it('includes the data + client exports', () => {
    const f = assembleAllExports([shank(), gem()], '14ky', { shopName: 'Test Shop' })
    expect(has(f, '-bom.csv')).toBe(true)
    expect(has(f, '-qbo-invoice.csv')).toBe(true)
    expect(has(f, '-certificate.html')).toBe(true)
    expect(has(f, '-care.html')).toBe(true)
  })

  it('every produced file is non-empty', () => {
    const f = assembleAllExports([shank(), gem()], '14ky', { shopName: 'Test Shop' })
    expect(keys(f).length).toBeGreaterThan(5)
    for (const k of keys(f)) expect(f[k].length).toBeGreaterThan(0)
  })

  it('gem-only exports appear with a stone and vanish without one', () => {
    const withGem = assembleAllExports([shank(), gem()], '14ky', { shopName: 'Test Shop' })
    const noGem = assembleAllExports([shank()], '14ky', { shopName: 'Test Shop' })
    expect(has(withGem, '-stones.csv')).toBe(true)
    expect(has(noGem, '-stones.csv')).toBe(false)
  })

  it('slugs the shop name into the paths', () => {
    const f = assembleAllExports([shank()], '14ky', { shopName: 'Test Shop' })
    expect(keys(f).some(k => k.includes('test-shop'))).toBe(true)
  })
})

describe('assembleCollectionExports', () => {
  it('puts each design in its own numbered folder', () => {
    const f = assembleCollectionExports([
      { name: 'Solitaire', objects: [shank(), gem()] },
      { name: 'Plain band', objects: [shank()] },
    ], '14ky', { shopName: 'Test Shop' })
    expect(keys(f).some(k => k.startsWith('01-solitaire/'))).toBe(true)
    expect(keys(f).some(k => k.startsWith('02-plain-band/'))).toBe(true)
  })
  it('numbered prefixes keep same-named designs from colliding', () => {
    const f = assembleCollectionExports([
      { name: 'Ring', objects: [shank()] },
      { name: 'Ring', objects: [shank()] },
    ], '14ky', { shopName: 'Test Shop' })
    expect(keys(f).some(k => k.startsWith('01-ring/'))).toBe(true)
    expect(keys(f).some(k => k.startsWith('02-ring/'))).toBe(true)
  })
  it('skips empty designs and bundles the rest', () => {
    const f = assembleCollectionExports([
      { name: 'Empty', objects: [] },
      { name: 'Real', objects: [shank()] },
    ], '14ky', { shopName: 'Test Shop' })
    expect(keys(f).some(k => k.startsWith('01-empty/'))).toBe(false)
    expect(keys(f).some(k => k.startsWith('02-real/'))).toBe(true)
  })
})
