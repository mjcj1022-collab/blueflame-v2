import type { SculptObject } from '../state/modeler'
import { printEstimate, type PrintEstimate } from './printEstimate'

/**
 * Printer profiles — the same piece prints very differently on a wax-jet machine
 * than on a resin LCD, and the maker's cost/time depend on which one is running.
 * Each profile carries the layer height, per-layer time, and castable-material
 * cost that machine actually uses, so the generic print estimate becomes a real
 * per-machine number. Estimate; tune to your slicer and resin.
 */

export type PrintTech = 'lcd' | 'dlp' | 'waxjet' | 'sla' | 'fdm'

export interface PrinterProfile {
  id: string
  name: string
  tech: PrintTech
  layerHeightMm: number
  secondsPerLayer: number
  materialPerMl: number   // $/mL of castable resin or wax
  materialName: string
  note?: string
}

/** Machines a small jewelry shop realistically runs, castable-material oriented. */
export const PRINTERS: PrinterProfile[] = [
  { id: 'lcd-mono', name: 'Mono LCD (castable)', tech: 'lcd', layerHeightMm: 0.05, secondsPerLayer: 2.5, materialPerMl: 0.16, materialName: 'Castable resin', note: 'Fast, cheap, whole-plate exposure — layer time barely changes with part count.' },
  { id: 'dlp-hd', name: 'DLP (fine detail)', tech: 'dlp', layerHeightMm: 0.03, secondsPerLayer: 4, materialPerMl: 0.28, materialName: 'Fine castable resin', note: 'Finer voxel; best for tight pavé and filigree. Slower, pricier resin.' },
  { id: 'waxjet', name: 'Wax-jet (Solidscape-type)', tech: 'waxjet', layerHeightMm: 0.013, secondsPerLayer: 55, materialPerMl: 3.2, materialName: 'Thermoplastic wax', note: 'Cleanest burnout and finest layers; very slow and material-costly. The gold standard for fine work.' },
  { id: 'sla-lab', name: 'Lab SLA', tech: 'sla', layerHeightMm: 0.05, secondsPerLayer: 8, materialPerMl: 0.35, materialName: 'Castable SLA resin', note: 'Point-laser: time grows with part footprint and count.' },
  { id: 'fdm-proto', name: 'FDM (prototype only)', tech: 'fdm', layerHeightMm: 0.12, secondsPerLayer: 20, materialPerMl: 0.05, materialName: 'PLA (fit-check only)', note: 'Not castable — for size/fit prototypes, never for burnout.' },
]

export const printerById = (id: string): PrinterProfile => PRINTERS.find(p => p.id === id) ?? PRINTERS[0]

export interface ProfiledPrintEstimate extends PrintEstimate {
  profile: PrinterProfile
  hours: number
  castable: boolean
}

/** Run the print estimate through a specific machine's real parameters. */
export function printEstimateFor(objects: SculptObject[], profileId: string): ProfiledPrintEstimate {
  const profile = printerById(profileId)
  const est = printEstimate(objects, {
    layerHeightMm: profile.layerHeightMm,
    secondsPerLayer: profile.secondsPerLayer,
    resinPerMl: profile.materialPerMl,
  })
  return {
    ...est,
    profile,
    hours: est.minutes / 60,
    castable: profile.tech !== 'fdm',
  }
}
