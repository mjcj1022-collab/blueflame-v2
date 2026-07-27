import { describe, it, expect } from 'vitest'
import { recommendProngs, gemSpacingReport, weightAdvice, ringFitReadout } from '../lib/designAdvice'
import { describePiece } from '../lib/describePiece'
import { buildIntent, synthesizeRoutes } from '../lib/aiAssistant'
import { MACROS } from '../lib/commandMacros'
import { normalizeCommand } from '../lib/aiCommands'
import { sizeToDiameter } from '../lib/sizing'
import type { SculptObject } from '../state/modeler'

const gem = (carat: number, pos: [number, number, number], shapeId = 'rd'): SculptObject => ({
  id: Math.random().toString(36).slice(2), kind: 'gem', name: 'g', position: pos, rotation: [0, 0, 0],
  scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId, stoneTypeId: 'dia', carat },
})
const shank = (): SculptObject => ({
  id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  size: 6, material: 'metal', color: 0, params: { ringSize: 7, width: 2.2, thickness: 1.8, profile: 'round' },
})

describe('recommendProngs', () => {
  it('gives six prongs to a large stone and a fragile cut', () => {
    expect(recommendProngs(0.3, 'rd')).toBe(4)
    expect(recommendProngs(1.5, 'rd')).toBe(6)
    expect(recommendProngs(1, 'em')).toBe(6) // emerald cut, fragile corners
  })
})

describe('gemSpacingReport', () => {
  it('flags overlapping stones as a clash', () => {
    const r = gemSpacingReport([gem(1, [0, 0, 0]), gem(1, [0.5, 0, 0])]) // ~6.5mm stones almost coincident
    expect(r.clashes).toBeGreaterThan(0)
  })
  it('is happy when stones are well separated', () => {
    const r = gemSpacingReport([gem(1, [0, 0, 0]), gem(1, [20, 0, 0])])
    expect(r.clashes).toBe(0)
    expect(r.tight).toBe(0)
  })
})

describe('weightAdvice', () => {
  it('reports grams and flags a heavy piece', () => {
    // a big solid box of metal → heavy
    const slab: SculptObject = { id: 'm', kind: 'box', name: 'm', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 20, material: 'metal', color: 0 }
    const w = weightAdvice([slab], '14ky')
    expect(w.grams).toBeGreaterThan(0)
    expect(w.heavy).toBe(true)
  })
})

describe('ringFitReadout', () => {
  it('reads the shank ring size into a true inner diameter', () => {
    const fit = ringFitReadout([shank()])
    expect(fit).not.toBeNull()
    expect(fit!.size).toBe(7)
    expect(fit!.innerDiaMm).toBeCloseTo(sizeToDiameter(7), 4)
    expect(fit!.circMm).toBeCloseTo(sizeToDiameter(7) * Math.PI, 4)
  })
  it('returns null with no metal', () => {
    expect(ringFitReadout([gem(1, [0, 0, 0])])).toBeNull()
  })
})

describe('describePiece', () => {
  it('names a solitaire ring from its parts', () => {
    const d = describePiece([shank(), gem(1, [0, 8, 0]), { id: 'h', kind: 'head', name: 'head', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0, params: { prongs: 6 } }], '14ky')
    expect(d.name.toLowerCase()).toContain('ring')
    expect(d.tags).toContain('ring')
    expect(d.sentence.length).toBeGreaterThan(0)
  })
  it('tags a halo when there are many accents', () => {
    const parts = [shank(), gem(1, [0, 8, 0]), ...Array.from({ length: 8 }, (_, i) => gem(0.03, [i, 8, 0]))]
    expect(describePiece(parts, '14kw').tags).toContain('halo')
  })
})

describe('buildIntent', () => {
  it('is true for a build request and false for an edit', () => {
    expect(buildIntent('design me a solitaire engagement ring')).toBe(true)
    expect(buildIntent('build a rose gold halo')).toBe(true)
    expect(buildIntent('make it wider')).toBe(false)
    expect(buildIntent('change the setting to bezel')).toBe(false)
  })
})

describe('synthesizeRoutes', () => {
  it('always yields three distinct routes from one ring design', () => {
    const routes = synthesizeRoutes({ category: 'ring', shapeId: 'rd', stoneTypeId: 'dia', carat: 1, settingId: 'p6' })
    expect(routes).toHaveLength(3)
    const settings = routes.map(r => r.design.settingId)
    expect(new Set(settings).size).toBeGreaterThan(1) // genuinely different takes
  })
})

describe('MACROS', () => {
  it('every macro command validates', () => {
    for (const m of MACROS) {
      expect(m.commands.length).toBeGreaterThan(0)
      for (const c of m.commands) expect(normalizeCommand(c)).not.toBeNull()
    }
  })
})
