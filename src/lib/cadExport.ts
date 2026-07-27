import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { zipSync, strToU8 } from 'fflate'
import { bakedVertices, bakedGeometry } from './sculpt'
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

/* ---------- Binary STL ---------- */

/** Binary STL of the whole piece — the compact, slicer-standard mesh format.
 *  Smaller and faster to load than ASCII; a caster/printer imports it directly. */
export function modelerToStlBinary(objects: SculptObject[], opts: ObjExportOptions = {}): ArrayBuffer {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  for (const o of objects) {
    if (opts.metalOnly && o.material !== 'metal') continue
    const g = bakedGeometry(o); geos.push(g)
    group.add(new THREE.Mesh(g))
  }
  const dv = new STLExporter().parse(group, { binary: true }) as unknown as DataView
  geos.forEach(g => g.dispose())
  return (dv.buffer as ArrayBuffer).slice(dv.byteOffset, dv.byteOffset + dv.byteLength)
}

/* ---------- 3MF (zipped, per-part objects) ---------- */

const xmlNum = (n: number) => (Math.round(n * 1e4) / 1e4).toString()

/** 3MF package — the modern manufacturing container (millimetres, per-part
 *  objects, colour). A zip of model XML + rels, valid for Cura/PrusaSlicer/CAD. */
export function modelerTo3mf(objects: SculptObject[], opts: ObjExportOptions = {}): Uint8Array {
  const names = uniqueNames(objects)
  const chosen = objects.filter(o => (opts.metalOnly ? o.material === 'metal' : true))

  const objXml: string[] = []
  const buildXml: string[] = []
  let id = 1
  for (const o of chosen) {
    const v = bakedVertices(o)
    const triCount = Math.floor(v.length / 9)
    if (!triCount) continue
    const verts: string[] = []
    const tris: string[] = []
    for (let i = 0; i < triCount * 3; i++) {
      verts.push(`<vertex x="${xmlNum(v[i * 3])}" y="${xmlNum(v[i * 3 + 1])}" z="${xmlNum(v[i * 3 + 2])}"/>`)
    }
    for (let t = 0; t < triCount; t++) tris.push(`<triangle v1="${t * 3}" v2="${t * 3 + 1}" v3="${t * 3 + 2}"/>`)
    objXml.push(
      `<object id="${id}" type="model" name="${names[objects.indexOf(o)]}"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`
    )
    buildXml.push(`<item objectid="${id}"/>`)
    id++
  }

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <metadata name="Application">Blue Flame</metadata>
 <resources>${objXml.join('')}</resources>
 <build>${buildXml.join('')}</build>
</model>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`

  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(model),
  })
}

/* ---------- Batch STL (collection zip) ---------- */

/** Zip a set of named part-lists as individual binary STLs — hand a caster the
 *  whole collection in one file. Names are slugged and de-duplicated. */
export function batchStlZip(designs: { name: string; objects: SculptObject[] }[]): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  const used = new Map<string, number>()
  for (const d of designs) {
    let base = (d.name || 'design').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, '') || 'design'
    const n = used.get(base) ?? 0; used.set(base, n + 1)
    if (n > 0) base = `${base}_${n + 1}`
    const buf = modelerToStlBinary(d.objects)
    files[`${base}.stl`] = new Uint8Array(buf)
  }
  return zipSync(files)
}

/* ---------- STL import ---------- */

/** Parse an STL file (binary or ASCII) into a world-space triangle soup a maker
 *  can drop onto the bench to modify — an existing model, a scan, a supplier part. */
export function stlToVertices(buffer: ArrayBuffer): number[] {
  const geo = new STLLoader().parse(buffer)
  const pos = geo.getAttribute('position')
  if (!pos) { geo.dispose(); return [] }
  const out = Array.from(pos.array as Float32Array)
  geo.dispose()
  return out
}

/** Parse an OBJ file (text) into a merged world-space triangle soup — bring a
 *  model out of Blender / ZBrush / another CAD onto the bench to modify. */
export function objToVertices(text: string): number[] {
  const group = new OBJLoader().parse(text)
  const out: number[] = []
  group.traverse(n => {
    const mesh = n as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry) as THREE.BufferGeometry
    const pos = g.getAttribute('position') as THREE.BufferAttribute | undefined
    if (pos) for (let i = 0; i < pos.count; i++) out.push(pos.getX(i), pos.getY(i), pos.getZ(i))
    if (g !== mesh.geometry) g.dispose()
  })
  return out
}
