import { bakedVertices } from './sculpt'
import type { SculptObject } from '../state/modeler'

/**
 * STEP (AP214) export as a faceted solid B-rep. A true CAD kernel can't run in
 * the browser, so we can't produce smooth NURBS — but we CAN write a valid STEP
 * MANIFOLD_SOLID_BREP whose faces are the model's triangles (each a planar
 * ADVANCED_FACE over a welded point set). Rhino, Fusion, SolidWorks and Matrix
 * import that as a solid, closing the interoperability gap that mesh formats
 * (STL/OBJ/3MF) leave open. Millimetres. Deterministic + testable.
 */

const QUANT = 1e4   // weld tolerance, 1e-4 mm — matches the DFM/repair audit
const num = (n: number) => {
  const r = Math.round(n * 1e6) / 1e6
  return (Object.is(r, -0) ? 0 : r).toString()
}

interface V3 { x: number; y: number; z: number }

/** Build the STEP text for the metal (default) or all geometry. */
export function modelerToStep(objects: SculptObject[], opts: { metalOnly?: boolean } = {}): string {
  const metalOnly = opts.metalOnly !== false
  // Weld vertices so faces share CARTESIAN_POINTs (a manifold, not a soup).
  const pointMap = new Map<string, number>()   // welded key -> point index
  const points: V3[] = []
  const idOf = (x: number, y: number, z: number): number => {
    const k = `${Math.round(x * QUANT)},${Math.round(y * QUANT)},${Math.round(z * QUANT)}`
    let n = pointMap.get(k)
    if (n === undefined) { n = points.length; pointMap.set(k, n); points.push({ x, y, z }) }
    return n
  }
  const tris: [number, number, number][] = []
  for (const o of objects) {
    if (metalOnly && o.material !== 'metal') continue
    const v = bakedVertices(o)
    for (let i = 0; i + 8 < v.length; i += 9) {
      const a = idOf(v[i], v[i + 1], v[i + 2])
      const b = idOf(v[i + 3], v[i + 4], v[i + 5])
      const c = idOf(v[i + 6], v[i + 7], v[i + 8])
      if (a !== b && b !== c && c !== a) tris.push([a, b, c])
    }
  }

  // ---- entity emitter ----
  let id = 0
  const lines: string[] = []
  const E = (body: string): number => { id++; lines.push(`#${id}=${body};`); return id }

  // Product / context boilerplate (AP214).
  const appCtx = E(`APPLICATION_CONTEXT('automotive design')`)
  E(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${appCtx})`)
  const prodCtx = E(`PRODUCT_CONTEXT('',#${appCtx},'mechanical')`)
  const product = E(`PRODUCT('Mandrel','Mandrel','',(#${prodCtx}))`)
  const pdf = E(`PRODUCT_DEFINITION_FORMATION('','',#${product})`)
  const pdCtx = E(`PRODUCT_DEFINITION_CONTEXT('part definition',#${appCtx},'design')`)
  const pd = E(`PRODUCT_DEFINITION('design','',#${pdf},#${pdCtx})`)
  const pds = E(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`)

  // Units: length = mm, plane angle = rad, solid angle = sr.
  const lenUnit = E(`( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )`)
  const angUnit = E(`( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )`)
  const solUnit = E(`( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )`)
  const unc = E(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-04),#${lenUnit},'distance_accuracy_value','confusion accuracy')`)
  const geoCtx = E(`( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${unc})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lenUnit},#${angUnit},#${solUnit})) REPRESENTATION_CONTEXT('','') )`)

  // Cartesian points, one per welded vertex.
  const pointIds = points.map(p => E(`CARTESIAN_POINT('',(${num(p.x)},${num(p.y)},${num(p.z)}))`))

  // A shared Z direction for reference axes we don't strictly constrain.
  const faceIds: number[] = []
  const cross = (u: V3, w: V3): V3 => ({ x: u.y * w.z - u.z * w.y, y: u.z * w.x - u.x * w.z, z: u.x * w.y - u.y * w.x })
  const normalize = (v: V3): V3 => { const L = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / L, y: v.y / L, z: v.z / L } }

  for (const [a, b, c] of tris) {
    const pa = points[a], pb = points[b], pc = points[c]
    // Skip zero-area (collinear) triangles: their face normal is (0,0,0), which
    // would emit an invalid DIRECTION('',(0.,0.,0.)) that strict importers reject.
    const raw = cross({ x: pb.x - pa.x, y: pb.y - pa.y, z: pb.z - pa.z }, { x: pc.x - pa.x, y: pc.y - pa.y, z: pc.z - pa.z })
    if (Math.hypot(raw.x, raw.y, raw.z) < 1e-9) continue
    const n = normalize(raw)
    const ref = normalize({ x: pb.x - pa.x, y: pb.y - pa.y, z: pb.z - pa.z })
    const origin = E(`CARTESIAN_POINT('',(${num(pa.x)},${num(pa.y)},${num(pa.z)}))`)
    const axis = E(`DIRECTION('',(${num(n.x)},${num(n.y)},${num(n.z)}))`)
    const refDir = E(`DIRECTION('',(${num(ref.x)},${num(ref.y)},${num(ref.z)}))`)
    const placement = E(`AXIS2_PLACEMENT_3D('',#${origin},#${axis},#${refDir})`)
    const plane = E(`PLANE('',#${placement})`)
    const loop = E(`POLY_LOOP('',(#${pointIds[a]},#${pointIds[b]},#${pointIds[c]}))`)
    const bound = E(`FACE_OUTER_BOUND('',#${loop},.T.)`)
    faceIds.push(E(`ADVANCED_FACE('',(#${bound}),#${plane},.T.)`))
  }

  // Only emit a solid when there are real faces — an empty CLOSED_SHELL /
  // MANIFOLD_SOLID_BREP is an invalid (empty) solid.
  if (faceIds.length) {
    const shell = E(`CLOSED_SHELL('',(${faceIds.map(f => `#${f}`).join(',')}))`)
    const brep = E(`MANIFOLD_SOLID_BREP('Mandrel',#${shell})`)
    const repr = E(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(#${brep}),#${geoCtx})`)
    E(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${repr})`)
  }

  const header = [
    'ISO-10303-21;',
    'HEADER;',
    `FILE_DESCRIPTION(('Mandrel faceted solid'),'2;1');`,
    `FILE_NAME('mandrel.step','',(''),(''),'Mandrel','Mandrel','');`,
    `FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));`,
    'ENDSEC;',
    'DATA;',
  ]
  return [...header, ...lines, 'ENDSEC;', 'END-ISO-10303-21;', ''].join('\n')
}
