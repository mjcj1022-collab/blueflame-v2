import type { BodyStyle, BodyGeo } from '../spec/types'

/** Labelled, ordered list of body-jewelry styles for the picker. */
export const BODY_STYLES: [BodyStyle, string][] = [
  ['barbell', 'Straight barbell'],
  ['curved', 'Curved barbell / banana'],
  ['cbr', 'Captive bead ring'],
  ['circular', 'Circular barbell (horseshoe)'],
  ['septum', 'Septum clicker'],
  ['labret', 'Labret / flat-back'],
  ['plug', 'Plug (stretched lobe)'],
  ['hoop', 'Seamless hoop'],
  ['tunnel', 'Ear tunnel (eyelet)'],
  ['taper', 'Stretching taper'],
  ['spike', 'Spike barbell'],
]

const sphere = (d: number) => (Math.PI / 6) * d ** 3           // 4/3·π·r³ with r = d/2
const cyl = (d: number, len: number) => Math.PI * (d / 2) ** 2 * len
const cone = (d: number, h: number) => (Math.PI / 3) * (d / 2) ** 2 * h  // 1/3·π·r²·h
const torus = (ringD: number, wireD: number) =>               // 2·π²·R·r²
  2 * Math.PI ** 2 * (ringD / 2) * (wireD / 2) ** 2

/**
 * Metal volume of a body-jewelry piece in mm³, derived analytically from the
 * shaft/wire, balls and any disc — the same first-principles approach the other
 * categories use. Kept pure so weight and pricing stay testable without a mesh.
 */
export function bodyVolumeMm3(g: BodyGeo): number {
  const { style, gauge, size, ballSize } = g
  const ball = sphere(ballSize)
  switch (style) {
    case 'barbell':
      // straight shaft + a ball on each end
      return cyl(gauge, size) + 2 * ball
    case 'curved':
      // arc shaft is ~5% longer than the chord + two balls
      return cyl(gauge, size * 1.05) + 2 * ball
    case 'cbr':
      // near-closed wire ring (mean diameter = inner + gauge) + one captive bead
      return torus(size + gauge, gauge) + sphere(ballSize)
    case 'circular':
      // ~83% of a full ring (open horseshoe) + a ball on each end
      return torus(size + gauge, gauge) * 0.83 + 2 * ball
    case 'septum':
      // ~80% ring with a slightly heavier decorative front bar
      return torus(size + gauge, gauge) * 0.8 + cyl(gauge * 1.6, size * 0.5)
    case 'labret':
      // post + flat backing disc (≈1 mm thick) + a front ball/gem
      return cyl(gauge, size) + cyl(ballSize * 1.4, 1.0) + ball
    case 'plug': {
      // double-flared tube: a ~1 mm wall around a bore, plus two flared collars
      const wall = 1.0
      const outerR = size / 2 + wall
      const length = Math.max(size * 0.7, 4)
      const tube = Math.PI * (outerR ** 2 - (size / 2) ** 2) * length
      const flare = 2 * Math.PI * (outerR + 0.6) * 0.6 * wall     // two lip rings
      return tube + flare
    }
    case 'hoop':
      // seamless continuous ring, no bead
      return torus(size + gauge, gauge)
    case 'tunnel': {
      // hollow eyelet: a ~1.2 mm wall tube of diameter `size`, with two rims
      const wall = 1.2
      const outerR = size / 2 + wall
      const length = Math.max(size * 0.6, 4)
      const tube = Math.PI * (outerR ** 2 - (size / 2) ** 2) * length
      const rims = 2 * torus(size + wall * 2, wall)
      return tube + rims
    }
    case 'taper':
      // a long stretching cone from `gauge` up to `ballSize` across `size`
      return cone(ballSize, size)
    case 'spike':
      // straight shaft with a conical spike on each end
      return cyl(gauge, size) + 2 * cone(ballSize, ballSize * 1.6)
  }
}
