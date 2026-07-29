import { describe, it, expect } from 'vitest'
import { paveRun, paveField, MIN_PAVE_WALL } from '../lib/paveLayout'
import { hallmarkCompliance } from '../lib/hallmarkCompliance'
import { printEstimateFor, printerById, PRINTERS } from '../lib/printerProfiles'
import { pendantSit, braceletFit, layeringLengths, suggestClaspFor, chainFitReport, NECKLACE_LENGTHS } from '../lib/chainFit'
import { prongsWithSeatsVertices } from '../lib/settingParts'
import { useModeler, type SculptObject } from '../state/modeler'

/* ---------- pavé / melee layout ---------- */
describe('pavé run planner', () => {
  it('fits more small stones than large ones in the same run', () => {
    const small = paveRun(1.3, 20)
    const large = paveRun(2.5, 20)
    expect(small.count).toBeGreaterThan(large.count)
  })
  it('centre-to-centre pitch is the stone plus the gap', () => {
    const r = paveRun(1.5, 30, 0.2)
    expect(r.pitchMm).toBeCloseTo(1.7, 5)
    expect(r.wallMm).toBeCloseTo(0.2, 5)
  })
  it('flags too little wall between seats', () => {
    expect(paveRun(1.5, 30, 0.05).wallOk).toBe(false)         // 0.05 < MIN_PAVE_WALL
    expect(paveRun(1.5, 30, 0.2).wallOk).toBe(true)
    expect(MIN_PAVE_WALL).toBeGreaterThan(0)
  })
  it('a run shorter than one stone fits none', () => {
    expect(paveRun(2, 1).count).toBe(0)
  })
  it('a field packs rows and columns', () => {
    const f = paveField(1.2, 6, 10)
    expect(f.rows).toBeGreaterThan(1)
    expect(f.perRow).toBeGreaterThan(1)
    expect(f.count).toBeGreaterThan(0)
  })
})

/* ---------- hallmark compliance ---------- */
describe('hallmark compliance advisor', () => {
  it('UK requires a compulsory assay hallmark; the US does not', () => {
    expect(hallmarkCompliance('18ky', 'UK').compulsoryAssay).toBe(true)
    expect(hallmarkCompliance('18ky', 'US').compulsoryAssay).toBe(false)
  })
  it('a quality mark obliges a maker/trademark in the US and Canada', () => {
    expect(hallmarkCompliance('14ky', 'US').makersMarkRequired).toBe(true)
    expect(hallmarkCompliance('14ky', 'CA').makersMarkRequired).toBe(true)
  })
  it('reports parts-per-thousand fineness from the alloy', () => {
    expect(hallmarkCompliance('18ky', 'EU').finenessPpt).toBe(750)
    expect(hallmarkCompliance('ss92', 'UK').finenessPpt).toBe(925)
  })
  it('knows when a metal is too low to be called by its name', () => {
    // 10K = 417‰ is above the US 417 gold floor (callable), but below platinum logic n/a
    expect(hallmarkCompliance('10ky', 'US').callable?.ok).toBe(true)
    // Sterling is callable "silver"; fine silver clears every bar
    expect(hallmarkCompliance('ag99', 'UK').callable?.ok).toBe(true)
  })
  it('a base metal gets no precious-metal marks', () => {
    const ti = hallmarkCompliance('ti', 'UK')
    expect(ti.requiredMarks.length).toBe(0)
    expect(ti.notes.some(n => /base metal/i.test(n))).toBe(true)
  })
})

/* ---------- printer profiles ---------- */
describe('printer-profile estimator', () => {
  const shank: SculptObject = { id: 's', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 2.2, thickness: 1.8 } }
  it('a wax-jet run takes far longer than a mono-LCD run of the same piece', () => {
    const lcd = printEstimateFor([shank], 'lcd-mono')
    const wax = printEstimateFor([shank], 'waxjet')
    expect(wax.minutes).toBeGreaterThan(lcd.minutes)
    expect(wax.materialCost).toBeGreaterThan(lcd.materialCost)
  })
  it('marks FDM as not castable, resin machines as castable', () => {
    expect(printEstimateFor([shank], 'fdm-proto').castable).toBe(false)
    expect(printEstimateFor([shank], 'lcd-mono').castable).toBe(true)
  })
  it('unknown profile id falls back to the first machine', () => {
    expect(printerById('nope').id).toBe(PRINTERS[0].id)
  })
})

/* ---------- chain fit & drape ---------- */
describe('chain length & drape advisor', () => {
  it('18 inches reads as the princess/pendant length', () => {
    expect(pendantSit(18).name).toBe('Princess')
  })
  it('a looser fit gives a longer bracelet than a snug one', () => {
    expect(braceletFit(6.5, 'loose').lengthIn).toBeGreaterThan(braceletFit(6.5, 'snug').lengthIn)
  })
  it('layered lengths step apart so pieces show', () => {
    expect(layeringLengths(16, 3)).toEqual([16, 18, 20])
  })
  it('heavier chains get a more secure clasp', () => {
    expect(suggestClaspFor(2)).toMatch(/spring/i)
    expect(suggestClaspFor(20)).toMatch(/box/i)
  })
  it('report names the nearest standard and whether it is exact', () => {
    expect(chainFitReport(18, 5).exactStandard).toBe(true)
    expect(chainFitReport(19, 5).exactStandard).toBe(false)
    expect(NECKLACE_LENGTHS.length).toBeGreaterThan(4)
  })
})

/* ---------- prong bearing seats ---------- */
describe('prong bearing-seat geometry', () => {
  it('builds a valid triangle soup that scales with the stone', () => {
    const v = prongsWithSeatsVertices(6, 4)
    expect(v.length).toBeGreaterThan(0)
    expect(v.length % 9).toBe(0)                 // whole triangles (9 floats each)
    // spans roughly the stone diameter across x
    const xs = v.filter((_, i) => i % 3 === 0)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(3)
  })
  it('more prongs → more geometry', () => {
    expect(prongsWithSeatsVertices(6, 6).length).toBeGreaterThan(prongsWithSeatsVertices(6, 3).length)
  })
  it('seatHead adds a metal head part to the bench', () => {
    const gem: SculptObject = { id: 'g', kind: 'gem', name: 'Gem', position: [0, 8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'gem', color: 0, params: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1 } }
    useModeler.setState({ objects: [gem], selectedId: 'g', past: [], future: [], placing: null, importedSig: null, explode: 0, snapshots: [] })
    const ok = useModeler.getState().seatHead('g', 4)
    expect(ok).toBe(true)
    const parts = useModeler.getState().objects
    expect(parts.length).toBe(2)
    expect(parts.some(o => o.material === 'metal' && /prong seat/.test(o.name))).toBe(true)
  })
})
