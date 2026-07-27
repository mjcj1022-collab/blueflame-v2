import type { SculptObject } from '../state/modeler'
import { bakedVertices, sculptMetalVolume } from './sculpt'
import { alloyById } from '../catalog'
import { sizeToCircumference } from './sizing'

/**
 * On-model measurements — the numbers a maker reads off with calipers: overall
 * envelope, ring finger size, band section, and the stone spread. Computed from
 * the real baked geometry so a tech pack and the bench agree. Pure + testable.
 */

export interface Measurements {
  overall: [number, number, number]  // bounding box W×H×D, mm
  castGrams: number
  ringSize?: number                  // US, if a shank is present
  ringInnerMm?: number               // inner diameter
  bandWidth?: number                 // mm
  bandThickness?: number             // mm
  stoneSpread?: [number, number]     // largest stone L×W, mm
  stoneCount: number
}

function worldBounds(objects: SculptObject[]): { min: number[]; max: number[] } | null {
  let has = false
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const o of objects) {
    const v = bakedVertices(o)
    for (let i = 0; i < v.length; i += 3) {
      has = true
      for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], v[i + a]); max[a] = Math.max(max[a], v[i + a]) }
    }
  }
  return has ? { min, max } : null
}

export function measurements(objects: SculptObject[], alloyId: string): Measurements {
  const b = worldBounds(objects)
  const overall: [number, number, number] = b
    ? [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
    : [0, 0, 0]
  const castGrams = (sculptMetalVolume(objects) / 1000) * alloyById(alloyId).density

  const shank = objects.find(o => o.kind === 'shank' && typeof o.params?.ringSize === 'number')
  const gems = objects.filter(o => o.kind === 'gem')
  let stoneSpread: [number, number] | undefined
  if (gems.length) {
    const biggest = gems.reduce((a, c) => (c.params?.carat ?? 0) > (a.params?.carat ?? 0) ? c : a)
    const gb = worldBounds([biggest])
    if (gb) stoneSpread = [Math.max(gb.max[0] - gb.min[0], gb.max[2] - gb.min[2]), Math.min(gb.max[0] - gb.min[0], gb.max[2] - gb.min[2])]
  }

  return {
    overall,
    castGrams,
    ringSize: shank?.params?.ringSize,
    ringInnerMm: shank ? Math.round((sizeToCircumference(shank.params!.ringSize as number) / Math.PI) * 100) / 100 : undefined,
    bandWidth: shank?.params?.width,
    bandThickness: shank?.params?.thickness,
    stoneSpread,
    stoneCount: gems.length,
  }
}
