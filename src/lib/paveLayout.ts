/**
 * Pavé / melee layout planner — the bench math for setting a run or a field of
 * small stones. Given a length (or an area) and a calibrated melee size, it works
 * out how many stones fit, their centre-to-centre pitch, the metal wall left
 * between seats, the setting bur and pilot drill, and the bead count. This is
 * what a setter sketches before drilling — done right so seats don't blow into
 * each other and the wall between stones can actually hold a bead. Pure + testable.
 */

/** Minimum metal wall between two seats that will still hold a bright-cut bead. */
export const MIN_PAVE_WALL = 0.13   // mm — below this the shared bead breaks out

export interface PaveRun {
  stoneMm: number
  runLengthMm: number
  gapMm: number          // intended metal gap between girdles
  count: number          // stones that fit
  pitchMm: number        // centre-to-centre
  wallMm: number         // actual metal wall left between seats (pitch − stoneMm)
  burMm: number          // setting bur ≈ stone diameter
  drillMm: number        // pilot drill for the seat
  beads: number          // bright-cut beads, shared between neighbours
  seatDepthMm: number    // how deep the girdle sits
  wallOk: boolean        // wall ≥ MIN_PAVE_WALL
}

/** A single straight run of melee (a channel, a shoulder line, an eternity arc). */
export function paveRun(stoneMm: number, runLengthMm: number, gapMm = 0.18): PaveRun {
  const s = Math.max(stoneMm, 0.001)
  const gap = Math.max(gapMm, 0)
  const pitch = s + gap
  // Stones are centred in the run: first centre at s/2 from the end, then step by pitch.
  const count = runLengthMm >= s ? Math.floor((runLengthMm - s) / pitch) + 1 : 0
  const wall = pitch - s
  return {
    stoneMm: s,
    runLengthMm,
    gapMm: gap,
    count,
    pitchMm: pitch,
    wallMm: wall,
    burMm: Math.round(s * 100) / 100,          // setting bur cut to the stone size
    drillMm: Math.round(s * 0.6 * 100) / 100,  // pilot ~60% of the stone
    beads: count > 0 ? 2 * count + 2 : 0,      // two beads per stone, shared, plus two ends
    seatDepthMm: Math.round(s * 0.35 * 100) / 100,
    wallOk: wall >= MIN_PAVE_WALL,
  }
}

export interface PaveField {
  stoneMm: number
  widthMm: number
  lengthMm: number
  rows: number
  perRow: number
  count: number          // honeycomb-packed total
  pitchMm: number
  rowPitchMm: number     // rows nest closer than the square pitch
  wallOk: boolean
  carbonPerStone: number // total field carats need the stone's ct — filled by caller
}

/**
 * A rectangular pavé field, honeycomb-packed (offset rows sit closer than a
 * square grid, the way a setter actually lays a field). Returns the row/column
 * counts and the total.
 */
export function paveField(stoneMm: number, widthMm: number, lengthMm: number, gapMm = 0.18): PaveField {
  const s = Math.max(stoneMm, 0.001)
  const pitch = s + Math.max(gapMm, 0)
  // Offset rows nest at ~0.866 of the pitch (equilateral triangle packing).
  const rowPitch = pitch * 0.866
  const rows = lengthMm >= s ? Math.floor((lengthMm - s) / rowPitch) + 1 : 0
  const perRow = widthMm >= s ? Math.floor((widthMm - s) / pitch) + 1 : 0
  // Offset rows lose ~half a stone alternately; average with a small correction.
  const count = rows > 0 && perRow > 0 ? rows * perRow - Math.floor(rows / 2) : 0
  return {
    stoneMm: s,
    widthMm,
    lengthMm,
    rows,
    perRow,
    count: Math.max(0, count),
    pitchMm: pitch,
    rowPitchMm: rowPitch,
    wallOk: pitch - s >= MIN_PAVE_WALL,
    carbonPerStone: 0,
  }
}
