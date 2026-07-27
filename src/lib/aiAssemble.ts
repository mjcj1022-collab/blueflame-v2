import { sizeToDiameter } from './sizing'
import { stoneMm, shapeById, stoneById, alloyById } from '../catalog'
import { haloRadius } from './construction'
import { NO_STONE, type DesignSpec } from '../spec/types'
import type { AiDesignPatch } from './aiAssistant'
import type { SculptObject } from '../state/modeler'

const MM_PER_INCH = 25.4

/**
 * Flatten a full parametric DesignSpec (nested) into the flat AiDesignPatch the
 * assembler consumes. This is the bridge that lets a piece built in the AI /
 * Design studio be handed to the Sculpt modeler as real editable parts.
 */
/**
 * A stable fingerprint of the parametric design, used to tell whether the piece
 * currently on the Sculpt bench still matches the studio design or has drifted
 * (so the bench can offer to re-import). Ignores view-only fields (hidden).
 */
export function designSignature(spec: DesignSpec): string {
  const { hidden: _hidden, ...rest } = spec
  return JSON.stringify(rest)
}

export function patchFromSpec(spec: DesignSpec): AiDesignPatch {
  const p: AiDesignPatch = {
    category: spec.category,
    alloyId: spec.metal.alloyId,
    shapeId: spec.center.shapeId,
    stoneTypeId: spec.center.stoneTypeId,
    carat: spec.center.carat,
    settingId: spec.setting.typeId,
    finish: spec.finish,
  }
  if (spec.setting.melee?.stoneId) p.accentStoneId = spec.setting.melee.stoneId
  switch (spec.category) {
    case 'ring':
      p.size = spec.ring.size
      p.bandWidth = spec.ring.width
      p.bandProfile = spec.ring.profile
      break
    case 'necklace':
      p.necklaceLength = spec.necklace.length
      p.chainStyle = spec.necklace.chainStyle
      if (spec.necklace.motif && spec.necklace.motif !== 'none') p.motif = spec.necklace.motif
      if (spec.necklace.station) {
        p.stationStoneId = spec.necklace.station.stoneId
        p.stationCarat = spec.necklace.station.carat
        p.stationEveryIn = spec.necklace.station.everyIn
      }
      break
    case 'earring':
      p.dropLength = spec.earring.dropLength
      break
    case 'bracelet':
      p.braceletKind = spec.bracelet.kind
      break
    case 'body':
      p.bodyStyle = spec.body.style
      p.bodyGauge = spec.body.gauge
      p.bodySize = spec.body.size
      break
  }
  return p
}

/**
 * Turn a parametric design (the same patch the AI produces) into real, editable
 * modeler parts — a shank, a centre stone, and its setting — so a maker can start
 * from "build me a 6-prong solitaire" and then refine the actual geometry with the
 * modeling tools, instead of being stuck with a locked parametric preview.
 *
 * Pure: returns part descriptors ready for the store's addObjects. Millimetres.
 */

export type NewPart = Omit<SculptObject, 'id'> & { name: string }

const DEFAULT_GOLD = 0xd8b36a
// The true display colour of a metal/stone from the catalog, so the render
// matches the chosen alloy (yellow/white/rose) and stone (sapphire blue, etc.).
const metalColorOf = (alloyId?: string): number => alloyById(alloyId ?? '14ky')?.color ?? DEFAULT_GOLD
const stoneColorOf = (stoneTypeId?: string): number => stoneById(stoneTypeId ?? 'dia').color

const metal = (kind: SculptObject['kind'], name: string, extra: Partial<SculptObject>, color = DEFAULT_GOLD): NewPart => ({
  kind, name, material: 'metal', color,
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, ...extra,
})

function prongCount(settingId?: string): number {
  if (settingId === 'p6') return 6
  if (settingId === 'p8') return 8
  if (settingId === 'dc') return 8 // double-claw ≈ 8 contact points
  return 4
}

/** True when the design calls for a centre stone. */
function hasStone(d: AiDesignPatch): boolean {
  if (d.stoneTypeId === NO_STONE) return false
  return !!(d.stoneTypeId || d.shapeId || d.carat)
}

export function buildSculptFromDesign(d: AiDesignPatch): NewPart[] {
  const category = d.category ?? 'ring'
  const parts: NewPart[] = []
  const mc = metalColorOf(d.alloyId)                 // metal parts match the alloy
  const stoneType = d.stoneTypeId && d.stoneTypeId !== NO_STONE ? d.stoneTypeId : 'dia'

  if (category === 'ring') {
    const size = d.size ?? 7
    const width = d.bandWidth ?? 2.2
    const thickness = 1.8
    const profile = d.bandProfile ?? 'round'
    parts.push(metal('shank', 'Shank', { params: { ringSize: size, width, thickness, profile } }, mc))

    if (hasStone(d)) {
      const shapeId = d.shapeId ?? 'rd'
      const carat = d.carat ?? 1
      const stoneW = stoneMm(shapeById(shapeId), carat).width
      const bandTop = sizeToDiameter(size) / 2 + thickness // top of the band
      const setting = d.settingId ?? 'p4'

      if (setting === 'fl') {
        // flush: sit the stone into the band top
        parts.push(gem('Center stone', [0, bandTop - stoneW * 0.28, 0], shapeId, carat, [0, 0, 0], stoneType))
      } else {
        const gemY = bandTop + stoneW * 0.35
        parts.push(gem('Center stone', [0, gemY, 0], shapeId, carat, [0, 0, 0], stoneType))
        if (setting === 'bz') {
          const h = Math.max(2, stoneW * 0.5)
          parts.push(metal('bezel', 'Bezel', { position: [0, gemY - h * 0.35, 0], params: { stoneW, height: h, wall: Math.max(0.4, stoneW * 0.09) } }, mc))
        } else {
          const h = Math.max(3, stoneW * 0.62)
          parts.push(metal('head', `${prongCount(setting)}-prong head`, { position: [0, gemY - h * 0.15, 0], params: { prongs: prongCount(setting), stoneW, height: h } }, mc))
        }
        if (setting === 'hal' || setting === 'hl2') {
          const accentCt = Math.max(0.01, carat * 0.03)
          const smallDia = stoneMm(shapeById('rd'), accentCt).width
          const r = haloRadius(stoneW, smallDia, smallDia * 0.1)
          const count = Math.max(8, Math.round((2 * Math.PI * r) / (smallDia * 1.1)))
          for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2
            parts.push(gem(`Halo ${i + 1}`, [Math.cos(a) * r, gemY, Math.sin(a) * r], 'rd', accentCt, [0, -a, 0]))
          }
        }
      }
    }
    return parts
  }

  if (category === 'pendant' || category === 'earring') {
    const shapeId = d.shapeId ?? 'rd'
    const carat = d.carat ?? 1
    parts.push(gem('Center stone', [0, 6, 0], shapeId, carat, [0, 0, 0], stoneType))
    const stoneW = stoneMm(shapeById(shapeId), carat).width
    const h = Math.max(3, stoneW * 0.62)
    parts.push(metal('head', 'Prong head', { position: [0, 6 - h * 0.15, 0], params: { prongs: prongCount(d.settingId), stoneW, height: h } }, mc))
    if (category === 'pendant') {
      // a bail loop above the stone
      const ring = Math.max(2.5, stoneW * 0.5)
      parts.push(metal('torus', 'Bail', { position: [0, 6 + stoneW * 0.7 + ring * 0.85, 0], scale: [ring / 3, ring / 3, ring / 3], size: 3 }, mc))
    }
    return parts
  }

  if (category === 'necklace' || category === 'bracelet') {
    // A wearable loop as a torus, sized from the piece length, plus any
    // station stones spaced around it and a motif/pendant hung at the base.
    const inches = category === 'necklace'
      ? (d.necklaceLength ?? 18)
      : ((d.bodySize ?? 180) / MM_PER_INCH) // bracelet wrist ~7"
    const R = (inches * MM_PER_INCH) / (Math.PI * 2)
    parts.push(metal('torus', category === 'necklace' ? 'Chain' : 'Bangle',
      { position: [0, 0, 0], scale: [R / 3, R / 3, R / 3], size: 3 }, mc))

    if (d.stationStoneId && (d.stationEveryIn ?? 0) > 0 && (d.stationCarat ?? 0) > 0) {
      const count = Math.max(1, Math.min(60, Math.round(inches / (d.stationEveryIn ?? 2))))
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        parts.push(gem(`Station ${i + 1}`, [Math.cos(a) * R, Math.sin(a) * R, 0],
          d.shapeId ?? 'rd', d.stationCarat ?? 0.05, [0, 0, 0], d.stationStoneId))
      }
    }
    // Pendant / motif drop, or a lone centre stone, at the base of the loop.
    if (hasStone(d)) {
      parts.push(gem('Center stone', [0, -R - 6, 0], d.shapeId ?? 'rd', d.carat ?? 1, [0, 0, 0], stoneType))
    }
    return parts
  }

  // Categories without a natural single-part assembly (body) start from a lone
  // stone the maker can build around.
  if (hasStone(d)) parts.push(gem('Stone', [0, 6, 0], d.shapeId ?? 'rd', d.carat ?? 1, [0, 0, 0], stoneType))
  return parts
}

function gem(name: string, position: [number, number, number], shapeId: string, carat: number, rotation: [number, number, number] = [0, 0, 0], stoneTypeId = 'dia'): NewPart {
  return {
    kind: 'gem', name, material: 'gem', color: stoneColorOf(stoneTypeId),
    position, rotation, scale: [1, 1, 1], size: 6,
    params: { shapeId, stoneTypeId, carat },
  }
}
