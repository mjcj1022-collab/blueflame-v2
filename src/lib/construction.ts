/**
 * Placement math for built-up settings: the ring a halo of accents rides on, and
 * the pair of rails that flank a channel-set row. Pure geometry so the store can
 * turn the spots into gems and metal bars, and so it can be unit-tested exactly.
 * Millimetres, modeler frame (Y up).
 */

/** Radius a halo of small stones sits at so it just hugs the centre stone. */
export function haloRadius(centerDiameter: number, smallDiameter: number, gap = 0): number {
  return centerDiameter / 2 + smallDiameter / 2 + Math.max(0, gap)
}

export type RailAlong = 'x' | 'z'

export interface RailOptions {
  center: [number, number, number]
  length: number // run length along the `along` axis (mm)
  innerGap: number // clear gap between the two rails (holds the stones) (mm)
  height: number // rail height (mm)
  thickness: number // rail thickness across the run (mm)
  along: RailAlong
}

export interface RailSpot {
  position: [number, number, number]
  /** Box dimensions (a unit box scaled by these). */
  scale: [number, number, number]
}

/** The two flanking rails of a channel setting. */
export function channelRailSpots(o: RailOptions): [RailSpot, RailSpot] {
  const [cx, cy, cz] = o.center
  const off = o.innerGap / 2 + o.thickness / 2
  if (o.along === 'x') {
    const scale: [number, number, number] = [o.length, o.height, o.thickness]
    return [
      { position: [cx, cy, cz - off], scale },
      { position: [cx, cy, cz + off], scale },
    ]
  }
  const scale: [number, number, number] = [o.thickness, o.height, o.length]
  return [
    { position: [cx - off, cy, cz], scale },
    { position: [cx + off, cy, cz], scale },
  ]
}
