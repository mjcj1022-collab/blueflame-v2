import { sizeToDiameter } from './sizing'
import { stoneMm, shapeById } from '../catalog'
import { haloRadius } from './construction'
import { NO_STONE } from '../spec/types'
import type { AiDesignPatch } from './aiAssistant'
import type { SculptObject } from '../state/modeler'

/**
 * Turn a parametric design (the same patch the AI produces) into real, editable
 * modeler parts — a shank, a centre stone, and its setting — so a maker can start
 * from "build me a 6-prong solitaire" and then refine the actual geometry with the
 * modeling tools, instead of being stuck with a locked parametric preview.
 *
 * Pure: returns part descriptors ready for the store's addObjects. Millimetres.
 */

export type NewPart = Omit<SculptObject, 'id'> & { name: string }

const GOLD = 0xd8b36a
const GEM = 0x8fd0e8

const metal = (kind: SculptObject['kind'], name: string, extra: Partial<SculptObject>): NewPart => ({
  kind, name, material: 'metal', color: GOLD,
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

  if (category === 'ring') {
    const size = d.size ?? 7
    const width = d.bandWidth ?? 2.2
    const thickness = 1.8
    const profile = d.bandProfile ?? 'round'
    parts.push(metal('shank', 'Shank', { params: { ringSize: size, width, thickness, profile } }))

    if (hasStone(d)) {
      const shapeId = d.shapeId ?? 'rd'
      const carat = d.carat ?? 1
      const stoneW = stoneMm(shapeById(shapeId), carat).width
      const bandTop = sizeToDiameter(size) / 2 + thickness // top of the band
      const setting = d.settingId ?? 'p4'

      if (setting === 'fl') {
        // flush: sit the stone into the band top
        parts.push(gem('Center stone', [0, bandTop - stoneW * 0.28, 0], shapeId, carat))
      } else {
        const gemY = bandTop + stoneW * 0.35
        parts.push(gem('Center stone', [0, gemY, 0], shapeId, carat))
        if (setting === 'bz') {
          const h = Math.max(2, stoneW * 0.5)
          parts.push(metal('bezel', 'Bezel', { position: [0, gemY - h * 0.35, 0], params: { stoneW, height: h, wall: Math.max(0.4, stoneW * 0.09) } }))
        } else {
          const h = Math.max(3, stoneW * 0.62)
          parts.push(metal('head', `${prongCount(setting)}-prong head`, { position: [0, gemY - h * 0.15, 0], params: { prongs: prongCount(setting), stoneW, height: h } }))
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
    parts.push(gem('Center stone', [0, 6, 0], shapeId, carat))
    const stoneW = stoneMm(shapeById(shapeId), carat).width
    const h = Math.max(3, stoneW * 0.62)
    parts.push(metal('head', 'Prong head', { position: [0, 6 - h * 0.15, 0], params: { prongs: prongCount(d.settingId), stoneW, height: h } }))
    if (category === 'pendant') {
      // a bail loop above the stone
      const ring = Math.max(2.5, stoneW * 0.5)
      parts.push(metal('torus', 'Bail', { position: [0, 6 + stoneW * 0.7 + ring * 0.85, 0], scale: [ring / 3, ring / 3, ring / 3], size: 3 }))
    }
    return parts
  }

  // Categories without a natural single-part assembly (necklace/bracelet/body)
  // start from a lone stone the maker can build around.
  if (hasStone(d)) parts.push(gem('Stone', [0, 6, 0], d.shapeId ?? 'rd', d.carat ?? 1))
  return parts
}

function gem(name: string, position: [number, number, number], shapeId: string, carat: number, rotation: [number, number, number] = [0, 0, 0]): NewPart {
  return {
    kind: 'gem', name, material: 'gem', color: GEM,
    position, rotation, scale: [1, 1, 1], size: 6,
    params: { shapeId, stoneTypeId: 'dia', carat },
  }
}
