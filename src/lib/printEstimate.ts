import type { SculptObject } from '../state/modeler'
import { sculptMetalVolume, boundingSize } from './sculpt'
import { overhangReport } from './castCheck'

/**
 * Resin/wax print estimate. Before a piece goes on the printer, a maker wants to
 * know the resin it'll drink, the supports it needs, how long it ties up the
 * machine, and what that costs — computed from the model's volume, height and
 * down-facing surface. Estimate; real numbers depend on the printer and slicer.
 */

export interface PrintEstimate {
  resinMl: number       // the piece itself
  supportMl: number     // supports, from the overhang burden
  totalMl: number
  heightMm: number
  layers: number
  minutes: number
  materialCost: number  // resin used × $/mL
}

export interface PrintOpts {
  layerHeightMm?: number   // resin layer, default 0.05 mm
  secondsPerLayer?: number // exposure + peel, default 7 s
  resinPerMl?: number      // castable resin, default $0.18/mL
}

export function printEstimate(objects: SculptObject[], opts: PrintOpts = {}): PrintEstimate {
  const layerHeightMm = opts.layerHeightMm ?? 0.05
  const secondsPerLayer = opts.secondsPerLayer ?? 7
  const resinPerMl = opts.resinPerMl ?? 0.18

  // Print the metal parts (you don't print stones). mm³ → mL is /1000.
  const metal = objects.filter(o => o.material === 'metal')
  const volMm3 = sculptMetalVolume(objects)
  const resinMl = volMm3 / 1000
  const overhang = overhangReport(objects).fraction
  const supportMl = resinMl * (0.15 + overhang * 0.6)   // more down-facing → more support

  const heightMm = metal.reduce((h, o) => Math.max(h, boundingSize(o)[1]), 0)
  const layers = Math.max(1, Math.ceil(heightMm / layerHeightMm))
  const minutes = (layers * secondsPerLayer) / 60
  const totalMl = resinMl + supportMl
  return { resinMl, supportMl, totalMl, heightMm, layers, minutes, materialCost: totalMl * resinPerMl }
}
