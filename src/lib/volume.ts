import type { DesignSpec, BandProfile } from '../spec/types'
import { stoneOnPiece } from '../spec/types'
import { shapeById, stoneMm, settingById, type SettingType } from '../catalog'
import { sizeToDiameter } from './sizing'
import { isHidden } from './features'
import { bodyVolumeMm3 } from './body'
import { motifVolumeMm3 } from './motif'

const headOn = (spec: DesignSpec) => stoneOnPiece(spec) && !isHidden(spec, 'head')

/** Cross-section fill by band profile. `round` is the calibrated baseline. */
const PROFILE_FACTOR: Record<BandProfile, number> = { round: 0.90, flat: 1.02, dshape: 0.96, knife: 0.70 }

/**
 * Shank cross-section profile factor.
 *
 * A torus has an ELLIPTICAL cross-section, which under-weighs a real band by
 * pi/4 (about 21%). Bands are near-rectangular with broken edges, so model the
 * shank as cross-section area times centreline circumference instead.
 */
const PROFILE_FLAT = 0.90
const COMFORT_HOLLOW = 0.91   // domed interior removes roughly 9% of the section
const MM_PER_INCH = 25.4

export interface VolumeBreakdown {
  shank: number     // structural body: shank / bail / posts / chain / links
  head: number      // stone-carrying head(s)
  total: number     // mm3
}

/** Width of the center stone in mm, from shape + carat. */
function centerStoneWidth(spec: DesignSpec): number {
  const shape = shapeById(spec.center.shapeId)
  return stoneMm(shape, spec.center.carat).width
}

/**
 * Volume of a single prong/bezel head sized to a stone of `stoneW` mm.
 * Prong and rail stock scale with stone size — a 3 ct head is not a 1 ct head
 * enlarged by eye. Calibrated against catalogue head weights.
 */
export function headVolume(setting: SettingType, stoneW: number): number {
  const r = stoneW / 2
  const prongR = 0.42 + stoneW * 0.012
  let head = 0
  if (setting.bezel) {
    head += Math.PI * ((r * 1.15) ** 2 - (r * 1.02) ** 2) * (stoneW * 0.45)  // wall
    head += 2 * Math.PI * Math.PI * (r * 0.80) * 0.30 * 0.30                  // seat rail
  } else {
    head += setting.prongs * Math.PI * prongR * prongR * (stoneW * 0.95)      // prongs
    head += 2 * (2 * Math.PI * Math.PI * (r * 0.82) * (prongR * 0.85) ** 2)   // two gallery rails
  }
  head += Math.PI * 0.65 * 0.65 * (stoneW * 0.35)                             // peg / gallery base
  return head
}

/** Length of round wire stock of a given gauge, as a volume. */
const wireVolume = (lengthMm: number, gaugeMm: number) =>
  Math.PI * (gaugeMm / 2) ** 2 * lengthMm

function ringVolume(spec: DesignSpec): VolumeBreakdown {
  const { size, width, thickness, fit, profile } = spec.ring
  const setting = settingById(spec.setting.typeId)
  const stoneW = centerStoneWidth(spec)

  const insideR = sizeToDiameter(size) / 2
  const tube = thickness / 2
  const centreR = insideR + tube

  let section = width * thickness * (PROFILE_FACTOR[profile] ?? PROFILE_FLAT)
  if (fit === 'comfort') section *= COMFORT_HOLLOW
  const shank = isHidden(spec, 'band') ? 0 : section * 2 * Math.PI * centreR

  const head = headOn(spec) ? headVolume(setting, stoneW) : 0
  const total = Math.max(shank + head, 5)
  return { shank, head, total }
}

function pendantVolume(spec: DesignSpec): VolumeBreakdown {
  const setting = settingById(spec.setting.typeId)
  const stoneW = centerStoneWidth(spec)
  const { bailInner, bailGauge, hasChain, chainLength, chainGauge } = spec.pendant

  const head = headOn(spec) ? headVolume(setting, stoneW) : 0
  // Bail: a loop of wire of mean circumference pi * (inner + gauge).
  const bail = isHidden(spec, 'bail') ? 0 : wireVolume(Math.PI * (bailInner + bailGauge), bailGauge)
  // Chain: linked wire fills ~45% of the swept length at the given gauge.
  const chain = hasChain && !isHidden(spec, 'chain') ? wireVolume(chainLength * MM_PER_INCH, chainGauge) * 2.2 * 0.45 : 0

  const shank = bail + chain
  const total = Math.max(shank + head, 8)
  return { shank, head, total }
}

function earringVolume(spec: DesignSpec): VolumeBreakdown {
  const setting = settingById(spec.setting.typeId)
  const stoneW = centerStoneWidth(spec)
  const { pair, postGauge, postLength, dropLength } = spec.earring
  const headEach = headOn(spec) ? headVolume(setting, stoneW) : 0

  const one =
    headEach +
    wireVolume(postLength, postGauge) +
    (dropLength > 0 ? wireVolume(dropLength, Math.max(postGauge, 1.0)) : 0)

  const each = pair ? 2 : 1
  const head = headEach * each
  const total = Math.max(one * each, 3)
  return { shank: total - head, head, total }
}

function braceletVolume(spec: DesignSpec): VolumeBreakdown {
  const { kind, wristCircumference, fitAllowance, width, thickness, linkCount } = spec.bracelet
  const setting = settingById(spec.setting.typeId)
  const length = wristCircumference + fitAllowance   // mm, worn length

  if (kind === 'tennis') {
    // Tennis bracelets are specified by TOTAL carat spread over many small
    // stones. Size each head from the per-stone carat, not the total.
    const perStone = spec.center.carat / Math.max(linkCount, 1)
    const stoneW = stoneMm(shapeById(spec.center.shapeId), perStone).width
    const heads = isHidden(spec, 'head') ? 0 : headVolume(setting, stoneW) * linkCount
    const links = isHidden(spec, 'band') ? 0 : wireVolume(length, Math.max(width * 0.35, 1.2)) * 1.4  // link stock between stones
    return { shank: links, head: heads, total: Math.max(links + heads, 20) }
  }
  if (kind === 'chain') {
    const links = wireVolume(length, Math.max(thickness * 0.5, 1.0)) * 2.2 * 0.45
    return { shank: links, head: 0, total: Math.max(links, 15) }
  }
  // bangle / cuff: a solid band swept around the wrist (cuff is ~75% of full loop).
  const arc = kind === 'cuff' ? 0.78 : 1.0
  const section = width * thickness * PROFILE_FLAT
  const body = section * length * arc
  return { shank: body, head: 0, total: Math.max(body, 30) }
}

function necklaceVolume(spec: DesignSpec): VolumeBreakdown {
  const { length, gauge, motif } = spec.necklace
  const links = isHidden(spec, 'chain') ? 0 : wireVolume(length * MM_PER_INCH, gauge) * 2.2 * 0.45
  let head = 0
  if (!isHidden(spec, 'head')) {
    if (motif && motif !== 'none') {
      // A decorative motif medallion sized to the neckline radius.
      const R = (length * MM_PER_INCH) / (2 * Math.PI)
      head = motifVolumeMm3(motif, Math.max(R * 0.16, 6), gauge)
    } else if (spec.necklace.hasPendant) {
      head = headVolume(settingById(spec.setting.typeId), centerStoneWidth(spec))
    }
  }
  return { shank: links, head, total: Math.max(links + head, 12) }
}

function bodyVolume(spec: DesignSpec): VolumeBreakdown {
  const body = isHidden(spec, 'band') ? 0 : bodyVolumeMm3(spec.body)
  return { shank: body, head: 0, total: Math.max(body, 2) }
}

export function computeVolume(spec: DesignSpec): VolumeBreakdown {
  switch (spec.category) {
    case 'ring':     return ringVolume(spec)
    case 'pendant':  return pendantVolume(spec)
    case 'earring':  return earringVolume(spec)
    case 'bracelet': return braceletVolume(spec)
    case 'necklace': return necklaceVolume(spec)
    case 'body':     return bodyVolume(spec)
  }
}
