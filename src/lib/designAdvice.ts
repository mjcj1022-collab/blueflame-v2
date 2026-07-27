import { bakedVertices, sculptMetalVolume } from './sculpt'
import { gemDiameterMm } from './setting'
import { sizeToDiameter } from './sizing'
import { alloyById } from '../catalog'
import type { SculptObject } from '../state/modeler'

/**
 * Pure design-quality reads a maker relies on: how many prongs a stone wants,
 * whether stones are crowding or overlapping, whether the piece is over-heavy in
 * metal, and the true finger fit of a band. Each is independently testable and
 * feeds the QA panel and the spec sheet.
 */

/** Recommended prong count for a stone by size and cut. Fragile-corner cuts and
 *  larger stones want six; small round/oval/cushion are secure on four. */
export function recommendProngs(carat: number, shapeId: string): number {
  const fragileCorners = ['pr', 'em', 'as', 'ra', 'mq'] // princess/emerald/asscher/radiant/marquise
  if (fragileCorners.includes(shapeId)) return carat >= 0.75 ? 6 : 4
  return carat >= 0.9 ? 6 : 4
}

export interface SpacingReport { clashes: number; tight: number; note: string }

/** Pairwise gem spacing: overlapping (clash) or crowded (tight) stones. */
export function gemSpacingReport(objects: SculptObject[]): SpacingReport {
  const gems = objects.filter((o) => o.material === 'gem')
  let clashes = 0, tight = 0
  for (let i = 0; i < gems.length; i++) {
    for (let j = i + 1; j < gems.length; j++) {
      const a = gems[i], b = gems[j]
      const ra = gemDiameterMm(a) / 2, rb = gemDiameterMm(b) / 2
      const d = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2])
      if (d < (ra + rb) * 0.92) clashes++
      else if (d < (ra + rb) * 1.05) tight++
    }
  }
  const note = clashes
    ? `${clashes} pair(s) of stones overlap — space them out or they can't both be set.`
    : tight
      ? `${tight} pair(s) sit very tight — check there's metal between them for beads/prongs.`
      : 'Stone spacing looks good.'
  return { clashes, tight, note }
}

export interface WeightAdvice { grams: number; heavy: boolean; note: string }

/** Flags an over-heavy casting and suggests lightening. */
export function weightAdvice(objects: SculptObject[], alloyId: string): WeightAdvice {
  const vol = sculptMetalVolume(objects)
  const alloy = alloyById(alloyId)
  const grams = (vol / 1000) * alloy.density
  const heavy = grams > 12
  const note = heavy
    ? `${grams.toFixed(1)} g is heavy for daily wear — consider hollowing the shank or trimming the gallery.`
    : `${grams.toFixed(1)} g cast weight — comfortable.`
  return { grams, heavy, note }
}

export interface FitReadout { size: number | null; innerDiaMm: number; circMm: number }

/** True finger fit of the band: inner diameter and circumference. Reads the
 *  shank's ring size when present, else measures the largest metal part's hole. */
export function ringFitReadout(objects: SculptObject[]): FitReadout | null {
  const shank = objects.find((o) => o.kind === 'shank')
  if (shank && typeof shank.params?.ringSize === 'number') {
    const innerDiaMm = sizeToDiameter(shank.params.ringSize)
    return { size: shank.params.ringSize, innerDiaMm, circMm: innerDiaMm * Math.PI }
  }
  // Fallback: measure the inner hole of the biggest metal part in the XY plane.
  const metals = objects.filter((o) => o.material === 'metal')
  if (!metals.length) return null
  let best: number | null = null
  for (const m of metals) {
    const v = bakedVertices(m)
    let minR = Infinity
    for (let i = 0; i + 2 < v.length; i += 3) {
      const r = Math.hypot(v[i], v[i + 1]) // distance from the ring axis (Z) in the XY plane
      if (r < minR) minR = r
    }
    if (isFinite(minR) && (best === null || minR * 2 > best)) best = minR * 2
  }
  if (best === null) return null
  return { size: null, innerDiaMm: best, circMm: best * Math.PI }
}
