import type { NecklaceMotif } from '../spec/types'

/** Labelled, ordered motif list for the picker (excludes 'none', shown separately). */
export const MOTIFS: [Exclude<NecklaceMotif, 'none'>, string][] = [
  ['celtic', 'Celtic knot'],
  ['cross', 'Cross'],
  ['infinity', 'Infinity'],
  ['heart', 'Heart'],
  ['halo', 'Halo'],
  ['cluster', 'Cluster'],
  ['floral', 'Floral'],
]

/** Every valid motif id, for AI-patch validation. */
export const MOTIF_IDS = new Set<string>(['none', ...MOTIFS.map(([id]) => id)])

const sphere = (d: number) => (Math.PI / 6) * d ** 3
const cyl = (d: number, len: number) => Math.PI * (d / 2) ** 2 * len

/**
 * Approximate metal volume (mm³) of a motif medallion sized to base radius R with
 * a wire/section thickness derived from the chain gauge. Kept analytic so the
 * pendant weighs and prices consistently with the rest of the piece.
 */
export function motifVolumeMm3(motif: NecklaceMotif, R: number, gauge: number): number {
  const t = Math.max(gauge * 1.4, 2.4)     // section thickness of the motif
  switch (motif) {
    case 'none':     return 0
    case 'celtic':   return cyl(t, 2 * Math.PI * R * 2.2)         // interlaced knot tube
    case 'cross':    return cyl(t, R * 2) + cyl(t, R * 1.3)       // two crossed bars
    case 'infinity': return cyl(t * 0.8, 2 * (2 * Math.PI * R * 0.6))  // two loops
    case 'heart':    return R * R * 1.6 * t * 0.9                 // extruded heart plate
    case 'halo':     return cyl(t * 0.8, 2 * Math.PI * R) + sphere(R * 0.7)  // ring + center
    case 'cluster':  return 7 * sphere(R * 0.5)                   // seven beads
    case 'floral':   return sphere(R * 0.55) + 6 * sphere(R * 0.5) * 0.7     // center + petals
  }
}
