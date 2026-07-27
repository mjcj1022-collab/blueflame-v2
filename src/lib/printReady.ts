import { bakedVertices } from './sculpt'
import { analyzeMesh, type DfmReport } from './dfm'
import { overhangReport } from './castCheck'
import { minWallForAlloy } from './manufacture'
import type { SculptObject } from '../state/modeler'

/**
 * Whole-piece print/cast readiness — the gate a maker clears before sending a
 * model to a printer or caster. Where the per-part DFM analyzer inspects one
 * mesh, this rolls every METAL part up into a single verdict against the chosen
 * alloy's real minimum wall (gold needs more than silver), so "ready?" is one
 * honest yes/no, not a part-by-part hunt. Gems are ignored — you don't print them.
 */

export interface PrintReadiness {
  verdict: 'pass' | 'warn' | 'fail'
  minWall: number            // mm — thinnest wall across all metal parts
  minWallLimit: number       // mm — the alloy's minimum
  thinFraction: number       // 0..1 — share of samples below the limit
  watertight: boolean        // every metal part is a closed shell
  openEdges: number          // total boundary edges across metal parts
  nonManifoldEdges: number   // total non-manifold edges across metal parts
  overhangFraction: number   // 0..1 — steep downward surface (support burden)
  metalParts: number
  meshParts: number          // metal parts that are baked meshes (repairable)
  issues: { level: 'pass' | 'warn' | 'fail'; title: string; detail: string }[]
}

/** Roll up per-part DFM into one verdict for the whole piece, in the chosen metal. */
export function printReadiness(objects: SculptObject[], alloyId: string): PrintReadiness {
  const limit = minWallForAlloy(alloyId)
  const metal = objects.filter(o => o.material === 'metal')
  const issues: PrintReadiness['issues'] = []

  if (!metal.length) {
    return {
      verdict: 'fail', minWall: Infinity, minWallLimit: limit, thinFraction: 0,
      watertight: false, openEdges: 0, nonManifoldEdges: 0, overhangFraction: 0,
      metalParts: 0, meshParts: 0,
      issues: [{ level: 'fail', title: 'Nothing to print', detail: 'Add at least one metal part before exporting for print or cast.' }],
    }
  }

  let minWall = Infinity
  let thinSamples = 0, totalSamples = 0
  let openEdges = 0, nonManifoldEdges = 0
  let meshParts = 0
  const reports: DfmReport[] = []
  for (const o of metal) {
    if (o.kind === 'mesh' && o.vertices) meshParts++
    const soup = bakedVertices(o)
    if (soup.length < 9) continue
    const r = analyzeMesh(soup, limit)
    reports.push(r)
    if (r.minWall < minWall) minWall = r.minWall
    // approximate sample rollup for a thin-fraction across parts
    thinSamples += r.thinFraction
    totalSamples += 1
    openEdges += r.boundaryEdges
    nonManifoldEdges += r.nonManifoldEdges
  }
  // "Watertight" for print/cast = no open (boundary) edges. Non-manifold edges
  // are common and harmless where solids overlap (a seat sunk into a shank, two
  // fused shells) — a slicer unions them fine — so they're a note, not a fail.
  const watertight = openEdges === 0
  const thinFraction = totalSamples ? thinSamples / totalSamples : 0
  const overhangFraction = overhangReport(objects).fraction

  // Wall thickness
  if (minWall !== Infinity) {
    if (minWall < limit) issues.push({ level: 'fail', title: 'Wall too thin', detail: `Thinnest wall ${minWall.toFixed(2)} mm is below the ${limit.toFixed(2)} mm minimum for this metal — it will cast porous or snap.` })
    else if (minWall < limit * 1.4) issues.push({ level: 'warn', title: 'Thin in places', detail: `Thinnest wall ${minWall.toFixed(2)} mm is castable but leaves little margin.` })
    else issues.push({ level: 'pass', title: 'Wall thickness OK', detail: `Thinnest wall ${minWall.toFixed(2)} mm clears the ${limit.toFixed(2)} mm minimum.` })
  }

  // Watertightness — open edges are a real hole (hard fail); non-manifold from
  // overlapping solids is only a note.
  if (!watertight) issues.push({ level: 'fail', title: 'Not watertight', detail: `${openEdges} open edge${openEdges === 1 ? '' : 's'} (a hole in the shell) — run “Fix for print” before slicing.` })
  else if (nonManifoldEdges > 0) issues.push({ level: 'warn', title: 'Overlapping shells', detail: `${nonManifoldEdges} non-manifold edge${nonManifoldEdges === 1 ? '' : 's'} where parts overlap — a slicer unions them, but fuse the metal for a single clean solid if your caster prefers it.` })
  else issues.push({ level: 'pass', title: 'Watertight', detail: 'Every metal part is a closed shell.' })

  // Overhang / support burden
  if (overhangFraction >= 0.25) issues.push({ level: 'warn', title: 'Heavy supports', detail: `${Math.round(overhangFraction * 100)}% of the surface faces down — re-orient before printing.` })
  else if (overhangFraction >= 0.08) issues.push({ level: 'warn', title: 'Some supports', detail: `${Math.round(overhangFraction * 100)}% faces down — orient supports off polished faces.` })

  const verdict: PrintReadiness['verdict'] =
    issues.some(i => i.level === 'fail') ? 'fail'
      : issues.some(i => i.level === 'warn') ? 'warn' : 'pass'

  return { verdict, minWall, minWallLimit: limit, thinFraction, watertight, openEdges, nonManifoldEdges, overhangFraction, metalParts: metal.length, meshParts, issues }
}
