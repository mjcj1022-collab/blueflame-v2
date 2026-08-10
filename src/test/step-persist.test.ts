import { describe, it, expect, beforeEach } from 'vitest'
import { modelerToStep } from '../lib/stepExport'
import { useModeler, type SculptObject } from '../state/modeler'

const shank = (): SculptObject => ({ id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } })

describe('STEP export (faceted solid B-rep)', () => {
  it('writes a valid AP214 STEP with a manifold solid and closed shell', () => {
    const step = modelerToStep([shank()])
    expect(step.startsWith('ISO-10303-21;')).toBe(true)
    expect(step.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true)
    expect(step).toMatch(/FILE_SCHEMA\(\('AUTOMOTIVE_DESIGN/)
    expect(step).toMatch(/MANIFOLD_SOLID_BREP/)
    expect(step).toMatch(/CLOSED_SHELL/)
    expect(step).toMatch(/ADVANCED_FACE/)
    expect(step).toMatch(/ADVANCED_BREP_SHAPE_REPRESENTATION/)
  })
  it('welds vertices — fewer CARTESIAN_POINTs than triangle corners', () => {
    const step = modelerToStep([shank()])
    const faces = (step.match(/ADVANCED_FACE/g) || []).length
    const points = (step.match(/CARTESIAN_POINT/g) || []).length
    expect(faces).toBeGreaterThan(0)
    // shared vertices → points far fewer than 3 per face
    expect(points).toBeLessThan(faces * 3)
  })
  it('skips collinear (zero-area) triangles — no invalid zero-vector DIRECTION', () => {
    // one real triangle + one collinear (a,b,c on a line) as a mesh part
    const soup = [0, 0, 0, 1, 0, 0, 0, 1, 0, /* collinear: */ 0, 0, 0, 1, 0, 0, 2, 0, 0]
    const mesh: SculptObject = { id: 'm', kind: 'mesh', name: 'M', vertices: soup, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: 0 }
    const step = modelerToStep([mesh])
    expect(step).not.toMatch(/DIRECTION\('',\(0,0,0\)\)/)   // no zero-length normal
    expect(step).toMatch(/MANIFOLD_SOLID_BREP/)             // still has the one good face
  })
  it('emits no solid (not an empty shell) for an all-degenerate mesh', () => {
    const soup = [0, 0, 0, 1, 0, 0, 2, 0, 0]                // a single collinear triangle
    const mesh: SculptObject = { id: 'm', kind: 'mesh', name: 'M', vertices: soup, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: 0 }
    const step = modelerToStep([mesh])
    expect(step).not.toMatch(/MANIFOLD_SOLID_BREP/)
    expect(step).not.toMatch(/CLOSED_SHELL\('',\(\)\)/)     // no empty shell either
  })
  it('every entity reference resolves to a defined entity', () => {
    const step = modelerToStep([shank()])
    const defined = new Set<number>()
    for (const m of step.matchAll(/^#(\d+)=/gm)) defined.add(Number(m[1]))
    for (const m of step.matchAll(/#(\d+)/g)) {
      // references appear as #N inside bodies; all must be defined
      expect(defined.has(Number(m[1]))).toBe(true)
    }
  })
})

describe('version-history persistence', () => {
  beforeEach(() => {
    // Node test env has no localStorage — install a minimal Map-backed shim.
    const store = new Map<string, string>()
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => store.clear(), key: () => null, length: 0,
    } as Storage
    useModeler.setState({ objects: [shank()], selectedId: null, past: [], future: [], placing: null, importedSig: null, explode: 0, snapshots: [] })
  })
  it('writes snapshots to localStorage so they survive a reload', () => {
    useModeler.getState().saveSnapshot('base')
    const raw = localStorage.getItem('mandrel.snapshots.v1')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.length).toBe(1)
    expect(parsed[0].name).toBe('base')
  })
  it('removes them from storage on delete', () => {
    const id = useModeler.getState().saveSnapshot('base')
    useModeler.getState().deleteSnapshot(id)
    expect(JSON.parse(localStorage.getItem('mandrel.snapshots.v1')!).length).toBe(0)
  })
})
