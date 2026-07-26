import { bakedVertices } from './sculpt'
import type { SculptObject } from '../state/modeler'

/**
 * Wavefront OBJ export for the modeler.
 *
 * The modeler already ships STL, but STL is a single anonymous triangle soup —
 * every part fuses into one shell and the metal/stone distinction is lost. A
 * maker importing into ZBrush, Blender, Matrix or RhinoGold almost always wants
 * the parts to arrive *separate and named*, with metal and gems on their own
 * groups so a stone can be hidden or a shank edited without touching the rest.
 * OBJ carries exactly that, so it's the honest "hand this to my CAD/CAM" format
 * for a mesh-based tool.
 *
 * Geometry comes from `bakedVertices` — world-space, transform baked, true
 * millimetres — the same source the STL and DFM checks use, so what a maker
 * exports is what they measured.
 */

export interface ObjExportOptions {
  /** Drop non-metal parts (stones/cutters). A caster prints only metal. */
  metalOnly?: boolean
}

const MTL_METAL = 'BlueFlame_Metal'
const MTL_GEM = 'BlueFlame_Gem'

// OBJ group/object names can't contain whitespace — collapse it to underscores.
const slug = (s: string, i: number) =>
  (s || 'part').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, '') || `part_${i + 1}`

/** Sequential, unique object names so two "Ring" parts don't collide on import. */
function uniqueNames(objects: SculptObject[]): string[] {
  const seen = new Map<string, number>()
  return objects.map((o, i) => {
    const base = slug(o.name, i)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base}_${n + 1}`
  })
}

export function modelerToObj(objects: SculptObject[], opts: ObjExportOptions = {}): string {
  const chosen = objects.filter((o) => (opts.metalOnly ? o.material === 'metal' : true))
  const names = uniqueNames(objects)

  const lines: string[] = [
    '# Blue Flame — modeler export',
    '# Units: millimetres. Parts are separate objects; metal and gems are',
    '# grouped so they can be selected independently after import.',
    'mtllib blue-flame.mtl',
  ]

  let base = 0 // running 1-based vertex offset across the whole file
  for (const o of chosen) {
    const v = bakedVertices(o) // flat triangle soup, 9 floats per triangle
    const triCount = Math.floor(v.length / 9)
    if (triCount === 0) continue

    lines.push(`o ${names[objects.indexOf(o)]}`)
    lines.push(`usemtl ${o.material === 'metal' ? MTL_METAL : MTL_GEM}`)

    const vertsHere = triCount * 3
    for (let i = 0; i < vertsHere * 3; i += 3) {
      // trim trailing zeros for compactness while staying lossless enough for CAM
      lines.push(`v ${fmt(v[i])} ${fmt(v[i + 1])} ${fmt(v[i + 2])}`)
    }
    for (let t = 0; t < triCount; t++) {
      const a = base + t * 3 + 1
      lines.push(`f ${a} ${a + 1} ${a + 2}`)
    }
    base += vertsHere
  }

  return lines.join('\n') + '\n'
}

/** A minimal companion .mtl so the two groups arrive with sane colours. */
export function blueFlameMtl(): string {
  return [
    '# Blue Flame materials',
    `newmtl ${MTL_METAL}`,
    'Ka 0.20 0.16 0.09',
    'Kd 0.83 0.68 0.38', // warm gold
    'Ks 0.90 0.80 0.55',
    'Ns 120',
    'illum 2',
    '',
    `newmtl ${MTL_GEM}`,
    'Ka 0.05 0.08 0.10',
    'Kd 0.40 0.70 0.90', // cool stone
    'Ks 0.95 0.95 0.95',
    'Ns 220',
    'd 0.55', // translucent
    'illum 2',
    '',
  ].join('\n')
}

function fmt(n: number): string {
  if (!isFinite(n)) return '0'
  // round to 1e-4 mm (0.1 micron) — well past any casting/print tolerance
  const r = Math.round(n * 1e4) / 1e4
  return Object.is(r, -0) ? '0' : String(r)
}
