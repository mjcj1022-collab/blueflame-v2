import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg'
import { shapeById, stoneMm, alloyById, stoneById } from '../catalog'
import { sizeToDiameter } from './sizing'
import { brilliantGeometry } from './gem'
import { MARKET } from './market'
import { settingLaborFor, finishingFee } from './labor'
import type { SculptObject, PrimitiveKind, SculptParams, ShankProfile } from '../state/modeler'

export type BooleanOp = 'union' | 'subtract' | 'intersect'
const OP = { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION } as const
const JEWELRY = new Set(['shank', 'gem', 'head', 'bezel'])

/* ---------- primitives ---------- */

export function primitiveGeometry(kind: PrimitiveKind, size: number): THREE.BufferGeometry {
  const r = size / 2
  switch (kind) {
    case 'box': return new THREE.BoxGeometry(size, size, size)
    case 'sphere': return new THREE.SphereGeometry(r, 40, 28)
    case 'cylinder': return new THREE.CylinderGeometry(r, r, size, 40)
    case 'cone': return new THREE.ConeGeometry(r, size, 40)
    case 'torus': return new THREE.TorusGeometry(r, size / 4, 24, 64)
    case 'tube': return new THREE.TorusGeometry(r, size / 10, 18, 72)
  }
}

/* ---------- jewelry builders ---------- */

/** Cross-section of a shank, in mm. X = radial (thickness), Y = axial (width). */
function profileShape(profile: ShankProfile, width: number, thickness: number): THREE.Shape {
  const s = new THREE.Shape()
  const hw = width / 2, ht = thickness / 2
  switch (profile) {
    case 'round':
      s.absellipse(0, 0, ht, hw, 0, Math.PI * 2, false, 0); break
    case 'knife':
      s.moveTo(-ht, 0); s.lineTo(0, hw); s.lineTo(ht, 0); s.lineTo(0, -hw); s.closePath(); break
    case 'comfort':
      // rounded (domed) interior on the -X side
      s.moveTo(ht, -hw); s.lineTo(ht, hw); s.quadraticCurveTo(-ht * 1.6, 0, ht, -hw); s.closePath(); break
    case 'dshape':
      s.moveTo(-ht, -hw); s.lineTo(-ht, hw); s.quadraticCurveTo(ht * 1.5, 0, -ht, -hw); s.closePath(); break
    default: // flat
      s.moveTo(-ht, -hw); s.lineTo(ht, -hw); s.lineTo(ht, hw); s.lineTo(-ht, hw); s.closePath()
  }
  return s
}

export function shankGeometry(p: SculptParams): THREE.BufferGeometry {
  const ringSize = p.ringSize ?? 7
  const profile = p.profile ?? 'round'
  const width = p.width ?? 2.2
  const thickness = p.thickness ?? 1.8
  const R = sizeToDiameter(ringSize) / 2 + thickness / 2   // centreline radius

  const pts: THREE.Vector3[] = []
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0))
  }
  const path = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0)
  // 96 steps keeps the band visually smooth while roughly halving the triangle
  // count vs. 200 — so a baked band stays responsive to vertex sculpting.
  const geo = new THREE.ExtrudeGeometry(profileShape(profile, width, thickness), {
    steps: 96, curveSegments: 8, bevelEnabled: false, extrudePath: path
  })
  geo.computeVertexNormals()
  return geo
}

function gemGeometry(p: SculptParams): THREE.BufferGeometry {
  const shape = shapeById(p.shapeId ?? 'rd')
  const width = stoneMm(shape, Math.max(p.carat ?? 1, 0.02)).width
  const geo = brilliantGeometry(width, shape.segments)
  geo.scale(1, 1, shape.lwRatio)
  geo.computeVertexNormals()
  return geo
}

function headGeometry(p: SculptParams): THREE.BufferGeometry {
  const prongs = p.prongs ?? 4
  const stoneW = p.stoneW ?? 6.5
  const h = p.height ?? 4
  const r = stoneW / 2
  const prongR = 0.42 + stoneW * 0.012

  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < prongs; i++) {
    const a = (i / prongs) * Math.PI * 2 + Math.PI / prongs
    const c = new THREE.CylinderGeometry(prongR * 0.85, prongR, h, 12)
    c.translate(Math.cos(a) * r * 0.99, 0, Math.sin(a) * r * 0.99)
    parts.push(c)
    const bead = new THREE.SphereGeometry(prongR * 0.9, 10, 8)
    bead.translate(Math.cos(a) * r * 0.94, h / 2, Math.sin(a) * r * 0.94)
    parts.push(bead)
  }
  const gallery = new THREE.TorusGeometry(r * 0.82, prongR * 0.85, 10, 44)
  gallery.rotateX(Math.PI / 2); gallery.translate(0, -h * 0.3, 0)
  parts.push(gallery)

  const merged = mergeGeometries(parts, false) ?? gallery
  merged.computeVertexNormals()
  return merged
}

function bezelGeometry(p: SculptParams): THREE.BufferGeometry {
  const stoneW = p.stoneW ?? 6.5
  const height = p.height ?? 3
  const wall = p.wall ?? 0.6
  const rIn = stoneW / 2, rOut = stoneW / 2 + wall
  const pts = [
    new THREE.Vector2(rIn, 0), new THREE.Vector2(rOut, 0),
    new THREE.Vector2(rOut, height), new THREE.Vector2(rIn, height),
    new THREE.Vector2(rIn, 0)
  ]
  const geo = new THREE.LatheGeometry(pts, 56)
  geo.computeVertexNormals()
  return geo
}

function jewelryGeometry(kind: string, params: SculptParams): THREE.BufferGeometry {
  switch (kind) {
    case 'shank': return shankGeometry(params)
    case 'gem': return gemGeometry(params)
    case 'head': return headGeometry(params)
    case 'bezel': return bezelGeometry(params)
    default: return new THREE.BoxGeometry(1, 1, 1)
  }
}

/* ---------- shared geometry access ---------- */

function geomFromVertices(vertices: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  g.computeVertexNormals()
  return g
}

function baseGeometry(o: SculptObject): THREE.BufferGeometry {
  if (o.kind === 'mesh' && o.vertices) return geomFromVertices(o.vertices)
  if (o.kind === 'sketch' && o.params?.sketch) {
    const sk = o.params.sketch
    return geomFromVertices(sketchToVertices(sk.points, sk.mode, sk.depth, sk.segments, sk.arc ?? 360))
  }
  if (JEWELRY.has(o.kind)) return jewelryGeometry(o.kind, o.params ?? {})
  return primitiveGeometry(o.kind as PrimitiveKind, o.size)
}

export const renderGeometry = (o: SculptObject): THREE.BufferGeometry => baseGeometry(o)

/* ---------- editable-mesh conversion + free-draw ---------- */

/** Positions as a flat triangle soup, converting only when indexed (avoids a
 *  noisy three.js warning on geometry that is already non-indexed). */
function soupPositions(geo: THREE.BufferGeometry): number[] {
  const g = geo.getIndex() ? geo.toNonIndexed() : geo
  const arr = Array.from(g.getAttribute('position').array as Float32Array)
  if (g !== geo) g.dispose()
  return arr
}

/** Triangle-soup positions of an object with its transform baked in — used to
 *  flatten a parametric part into an editable 'mesh' at identity transform. */
export function bakedVertices(o: SculptObject): number[] {
  const g = bakedGeometry(o)
  const arr = soupPositions(g)
  g.dispose()
  return arr
}

export type SketchMode = 'revolve' | 'extrude'

/**
 * Set profile point `i` to a typed value (mm). Revolve clamps the radius to ≥0
 * (it's a distance from the spin axis); extrude allows negative x/y. Non-finite
 * input leaves the profile unchanged. Returns a new array; others are untouched.
 */
export function editSketchPoint(
  points: [number, number][], i: number, mode: SketchMode, a: number, b: number
): [number, number][] {
  if (!Number.isFinite(a) || !Number.isFinite(b) || i < 0 || i >= points.length) return points
  return points.map((pt, j): [number, number] =>
    j !== i ? pt : mode === 'revolve' ? [Math.max(0, a), b] : [a, b])
}

/** Straight-line distance (mm) between two profile points, in design space. */
export function profileDistance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Resample a closed polygon to exactly `n` points, spaced evenly by arc length. */
export function resampleClosed(pts: [number, number][], n: number): [number, number][] {
  const m = pts.length
  if (m === 0) return Array.from({ length: n }, () => [0, 0] as [number, number])
  if (m === 1) return Array.from({ length: n }, () => [pts[0][0], pts[0][1]] as [number, number])
  const seg: { a: [number, number]; b: [number, number]; len: number }[] = []
  let total = 0
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % m]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    seg.push({ a, b, len }); total += len
  }
  if (total === 0) return Array.from({ length: n }, () => [pts[0][0], pts[0][1]] as [number, number])
  const step = total / n
  const out: [number, number][] = []
  let si = 0, acc = 0
  for (let k = 0; k < n; k++) {
    const d = k * step
    while (si < seg.length - 1 && acc + seg[si].len < d) { acc += seg[si].len; si++ }
    const s = seg[si], t = s.len > 0 ? (d - acc) / s.len : 0
    out.push([s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t])
  }
  return out
}

/**
 * Loft (blend) between two profiles: place profile A at z=0 and profile B at
 * z=length, ease the cross-section from one to the other with a smooth-step,
 * and skin the walls plus cap both ends into a watertight solid. Both profiles
 * are resampled to a common point count so corresponding points connect.
 */
export function loftVertices(
  profileA: [number, number][],
  profileB: [number, number][],
  length = 8,
  sections = 16,
): number[] {
  const n = Math.max(profileA.length, profileB.length, 3)
  const A = resampleClosed(profileA, n)
  const B = resampleClosed(profileB, n)
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const loops: [number, number, number][][] = []
  for (let s = 0; s <= sections; s++) {
    const t = s / sections, e = smooth(t), z = t * length
    const loop: [number, number, number][] = []
    for (let i = 0; i < n; i++) {
      loop.push([A[i][0] + (B[i][0] - A[i][0]) * e, A[i][1] + (B[i][1] - A[i][1]) * e, z])
    }
    loops.push(loop)
  }
  const out: number[] = []
  const tri = (p: number[], q: number[], r: number[]) => out.push(p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2])
  for (let s = 0; s < sections; s++) {                 // skin the side walls
    const lo = loops[s], hi = loops[s + 1]
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      tri(lo[i], hi[i], hi[j]); tri(lo[i], hi[j], lo[j])
    }
  }
  const cap = (loop: [number, number, number][], up: boolean) => {   // fan-triangulate an end
    let cx = 0, cy = 0; const z = loop[0][2]
    for (const p of loop) { cx += p[0]; cy += p[1] }
    const c = [cx / n, cy / n, z]
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      if (up) tri(c, loop[i], loop[j]); else tri(c, loop[j], loop[i])
    }
  }
  cap(loops[0], false); cap(loops[sections], true)
  return out
}

/**
 * Proportional vertex pull for direct mesh sculpting. Moves each vertex of
 * `base` (flat xyz) toward `delta`, weighted by a smooth-step falloff of its
 * distance to `center`: the grabbed vertex (distance 0) gets the full delta,
 * vertices at/after `radius` are untouched. With `symmetry`, the pull is also
 * mirrored across the X=0 plane. Writes into `out` and returns it.
 */
export function sculptPull(
  base: ArrayLike<number>,
  center: readonly [number, number, number],
  delta: readonly [number, number, number],
  radius: number,
  symmetry: boolean,
  out: Float32Array,
): Float32Array {
  const [cx, cy, cz] = center
  const [dx, dy, dz] = delta
  const wt = (d: number) => { if (d >= radius) return 0; const t = 1 - d / radius; return t * t * (3 - 2 * t) }
  for (let i = 0; i < base.length; i += 3) {
    const bx = base[i], by = base[i + 1], bz = base[i + 2]
    const w = wt(Math.hypot(bx - cx, by - cy, bz - cz))
    let nx = bx + dx * w, ny = by + dy * w, nz = bz + dz * w
    if (symmetry) {
      const w2 = wt(Math.hypot(bx + cx, by - cy, bz - cz))
      nx += -dx * w2; ny += dy * w2; nz += dz * w2
    }
    out[i] = nx; out[i + 1] = ny; out[i + 2] = nz
  }
  return out
}

/**
 * Add a vertex by splitting the clicked triangle at `point`: triangle ABC in the
 * flat soup at `faceIndex` becomes PAB, PBC, PCA, so P is a new, draggable
 * vertex on the surface. Returns a new positions array (the input is untouched).
 */
export function addVertexInTriangle(verts: number[], faceIndex: number, point: readonly [number, number, number]): number[] {
  const i = faceIndex * 9
  if (i < 0 || i + 9 > verts.length) return verts
  const a = [verts[i], verts[i + 1], verts[i + 2]]
  const b = [verts[i + 3], verts[i + 4], verts[i + 5]]
  const c = [verts[i + 6], verts[i + 7], verts[i + 8]]
  const p = [point[0], point[1], point[2]]
  const out = verts.slice()
  out.splice(i, 9, ...p, ...a, ...b, ...p, ...b, ...c, ...p, ...c, ...a)
  return out
}

/**
 * Remove the vertex nearest `point`: drop every triangle that touches that
 * vertex position (leaving a hole where it was). Returns a new positions array;
 * refuses to empty the mesh entirely.
 */
export function removeVertexNear(verts: number[], point: readonly [number, number, number]): number[] {
  if (verts.length < 9) return verts
  let bi = 0, bd = Infinity
  for (let i = 0; i < verts.length; i += 3) {
    const dx = verts[i] - point[0], dy = verts[i + 1] - point[1], dz = verts[i + 2] - point[2]
    const d = dx * dx + dy * dy + dz * dz
    if (d < bd) { bd = d; bi = i }
  }
  const qx = verts[bi], qy = verts[bi + 1], qz = verts[bi + 2]
  const EPS = 1e-4
  const near = (j: number) => Math.abs(verts[j] - qx) < EPS && Math.abs(verts[j + 1] - qy) < EPS && Math.abs(verts[j + 2] - qz) < EPS
  const out: number[] = []
  for (let t = 0; t + 9 <= verts.length; t += 9) {
    if (near(t) || near(t + 3) || near(t + 6)) continue
    for (let k = 0; k < 9; k++) out.push(verts[t + k])
  }
  return out.length >= 9 ? out : verts
}

/** Distance from point p to segment a→b (mm). */
function pointToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const abx = b[0] - a[0], aby = b[1] - a[1]
  const len2 = abx * abx + aby * aby
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2)) : 0
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * aby))
}

/** Castable/printable minimum section for jewelry (mm). */
export const MIN_SECTION_MM = 0.8

/**
 * Thinnest section of a profile (mm): the closest the outline folds toward
 * itself (a thin wall), and for a revolve also the thinnest turned stem
 * (interior diameter = 2·radius). Returns Infinity if there's nothing to check.
 */
export function profileThinnest(points: [number, number][], mode: SketchMode): number {
  const n = points.length
  if (n < 3) return mode === 'revolve' && n >= 1 ? Infinity : Infinity
  const segs: [number, number][] = []
  for (let i = 0; i < n - 1; i++) segs.push([i, i + 1])
  if (mode === 'extrude') segs.push([n - 1, 0])   // extrude outline is a closed loop
  let min = Infinity
  for (let i = 0; i < n; i++) {
    for (const [a, b] of segs) {
      if (a === i || b === i) continue           // skip segments that touch this vertex
      min = Math.min(min, pointToSegment(points[i], points[a], points[b]))
    }
  }
  if (mode === 'revolve') {                        // thin turned stem near the axis
    for (let i = 1; i < n - 1; i++) min = Math.min(min, 2 * Math.max(0, points[i][0]))
  }
  return min
}

export interface SketchSummary {
  mode: SketchMode
  nodes: number
  /** revolve only: overall outer diameter (2 × max radius), mm */
  diameter?: number
  /** extrude only: outline width (Δx), mm */
  width?: number
  /** overall profile height (Δy), mm */
  height: number
  /** extrude only: extrusion depth, mm */
  depth?: number
}

/** Overall envelope of a sketch profile: max diameter/width × height (× depth). */
export function sketchSummary(points: [number, number][], mode: SketchMode, depth = 3): SketchSummary {
  const n = points.length
  if (!n) return { mode, nodes: 0, height: 0, ...(mode === 'revolve' ? { diameter: 0 } : { width: 0, depth }) }
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const height = Math.max(...ys) - Math.min(...ys)
  return mode === 'revolve'
    ? { mode, nodes: n, diameter: Math.max(0, ...xs) * 2, height }
    : { mode, nodes: n, width: Math.max(...xs) - Math.min(...xs), height, depth }
}

/**
 * Turn a hand-drawn 2D profile (points in mm) into mesh vertices.
 * - revolve: spin the profile around the Y axis (x = radius ≥ 0, y = height).
 * - extrude: treat the points as a closed outline in XY, extruded along Z.
 */
export function sketchToVertices(points: [number, number][], mode: SketchMode, depth = 3, segments = 64, arcDeg = 360): number[] {
  if (points.length < 2) return []
  let geo: THREE.BufferGeometry
  if (mode === 'revolve') {
    const pts = points.map(([x, y]) => new THREE.Vector2(Math.max(0.02, x), y))
    const arc = Math.max(1, Math.min(360, arcDeg)) * Math.PI / 180
    geo = new THREE.LatheGeometry(pts, Math.max(3, Math.round(segments)), 0, arc)
  } else {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
    geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 })
    geo.translate(0, 0, -depth / 2)
  }
  const arr = soupPositions(geo)
  geo.dispose()
  return arr
}

/** A closed, capped tube swept along a surface stroke (world-space points).
 *  Union it onto a part to emboss a raised line, or subtract it to cut a groove.
 *  Built by hand (with end caps) so it's a watertight solid the CSG can boolean;
 *  an open TubeGeometry produces no result. */
export function strokeTubeVertices(points: [number, number, number][], radius: number): number[] {
  if (points.length < 2) return []
  const r = Math.max(0.05, radius)
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])))
  const N = Math.max(3, Math.ceil(curve.getLength() / (r * 0.7)))   // tubular segments
  const R = 8                                                       // radial segments
  const frames = curve.computeFrenetFrames(N, false)
  const centers: THREE.Vector3[] = []
  const rings: THREE.Vector3[][] = []
  for (let i = 0; i <= N; i++) {
    const c = curve.getPoint(i / N); centers.push(c)
    const nrm = frames.normals[i], bin = frames.binormals[i]
    const ring: THREE.Vector3[] = []
    for (let j = 0; j < R; j++) {
      const a = (j / R) * Math.PI * 2
      ring.push(c.clone().addScaledVector(nrm, r * Math.cos(a)).addScaledVector(bin, r * Math.sin(a)))
    }
    rings.push(ring)
  }
  const soup: number[] = []
  const P = (v: THREE.Vector3) => soup.push(v.x, v.y, v.z)
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => { P(a); P(b); P(c) }
  for (let i = 0; i < N; i++) {
    const a = rings[i], b = rings[i + 1]
    for (let j = 0; j < R; j++) { const j1 = (j + 1) % R; tri(a[j], b[j], b[j1]); tri(a[j], b[j1], a[j1]) }
  }
  for (let j = 0; j < R; j++) {   // end caps
    const j1 = (j + 1) % R
    tri(centers[0], rings[0][j1], rings[0][j])
    tri(centers[N], rings[N][j], rings[N][j1])
  }
  return soup
}

/** Style for one edge of a free-built 3D wire: a hard straight corner or a
 *  smoothed curve, plus its own width (thickness) and height (depth) — the
 *  cross-section is an ellipse, not just a round wire, so one stretch can read
 *  as a flat band and the next as a round wire. */
export interface Seg3DStyle { curved: boolean; thickness: number; depth: number }

/** The path for one edge (point i → point i+1, wrapping around for closed
 *  shapes): a hard line, or — when `curved` — a cubic Bezier built from
 *  Catmull-Rom tangent handles so it blends smoothly into its neighbouring
 *  points instead of just bulging in isolation. For an open shape the two
 *  end edges mirror their missing neighbour off the endpoint itself (the
 *  standard Catmull-Rom end condition) rather than wrapping around to the
 *  far side of the shape. Shared by the live sketch preview and the final
 *  solid so what's on screen matches what gets built. */
export function free3DSegCurve(
  points: [number, number, number][], i: number, curved: boolean, closed = false
): THREE.Curve<THREE.Vector3> {
  const n = points.length
  const at = (k: number) => {
    const idx = closed ? ((k % n) + n) % n : Math.max(0, Math.min(n - 1, k))
    return new THREE.Vector3(...points[idx])
  }
  const p0 = at(i), p1 = at(i + 1)
  if (!curved) return new THREE.LineCurve3(p0, p1)
  const pm1 = at(i - 1), p2 = at(i + 2)
  const t0 = p1.clone().sub(pm1).multiplyScalar(1 / 6)
  const t1 = p2.clone().sub(p0).multiplyScalar(1 / 6)
  return new THREE.CubicBezierCurve3(p0, p0.clone().add(t0), p1.clone().sub(t1), p1)
}

/** Sweep a solid tube through free-placed 3D points. Each edge is independently
 *  styled — a hard corner or a smoothed curve — with its own width (thickness)
 *  and height (depth); the elliptical cross-section eases into its neighbour
 *  at each joint instead of stepping abruptly. */
export function buildFree3DTube(
  points: [number, number, number][], segs: Seg3DStyle[], closed: boolean
): number[] {
  const n = points.length
  if (n < 2) return []
  const segCount = closed && n > 2 ? n : n - 1
  if (segCount < 1) return []
  const styleAt = (i: number): Seg3DStyle => segs[i] ?? { curved: false, thickness: 1.2, depth: 1.2 }

  const path = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < segCount; i++) path.add(free3DSegCurve(points, i, styleAt(i).curved, closed))

  let minR = Infinity
  for (let i = 0; i < segCount; i++) { const s = styleAt(i); minR = Math.min(minR, s.thickness, s.depth) }
  minR = Math.max(0.1, (Number.isFinite(minR) ? minR : 1.2) / 2)
  const totalLen = path.getLength()
  const N = Math.max(8, Math.ceil(totalLen / Math.max(0.3, minR * 0.7)))
  const RSEG = 10
  const frames = path.computeFrenetFrames(N, false)
  const centers: THREE.Vector3[] = []
  const rings: THREE.Vector3[][] = []
  for (let i = 0; i <= N; i++) {
    const u = i / N
    centers.push(path.getPointAt(u))
    const segPos = Math.min(segCount - 1e-6, u * segCount)
    const segIdx = Math.min(segCount - 1, Math.floor(segPos))
    const localT = segPos - segIdx
    const curr = styleAt(segIdx)
    const nextIdx = segIdx + 1 < segCount ? segIdx + 1 : (closed ? 0 : segIdx)
    const next = styleAt(nextIdx)
    const blend = localT > 0.8 ? (localT - 0.8) / 0.2 : 0
    const rx = THREE.MathUtils.lerp(curr.thickness, next.thickness, blend) / 2
    const ry = THREE.MathUtils.lerp(curr.depth, next.depth, blend) / 2
    const nrm = frames.normals[i], bin = frames.binormals[i]
    const ring: THREE.Vector3[] = []
    for (let j = 0; j < RSEG; j++) {
      const a = (j / RSEG) * Math.PI * 2
      ring.push(centers[i].clone().addScaledVector(nrm, rx * Math.cos(a)).addScaledVector(bin, ry * Math.sin(a)))
    }
    rings.push(ring)
  }
  const soup: number[] = []
  const P = (v: THREE.Vector3) => soup.push(v.x, v.y, v.z)
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => { P(a); P(b); P(c) }
  for (let i = 0; i < N; i++) {
    const a = rings[i], b = rings[i + 1]
    for (let j = 0; j < RSEG; j++) { const j1 = (j + 1) % RSEG; tri(a[j], b[j], b[j1]); tri(a[j], b[j1], a[j1]) }
  }
  for (let j = 0; j < RSEG; j++) {
    const j1 = (j + 1) % RSEG
    tri(centers[0], rings[0][j1], rings[0][j])
    tri(centers[N], rings[N][j], rings[N][j1])
  }
  return soup
}

/** Lay a run of 3D text flat on the top face of a part (world space), scaled to
 *  fit and straddling the surface for a subtract (engrave) or sitting proud for a
 *  union (emboss). `textVerts` are centred XY letters extruded along Z. */
export function positionTextVertices(textVerts: number[], target: SculptObject, op: 'cut' | 'emboss', depth = 1.2): number[] {
  if (!textVerts.length) return []
  const tg = new THREE.BufferGeometry()
  tg.setAttribute('position', new THREE.Float32BufferAttribute(Float32Array.from(textVerts), 3))
  tg.computeBoundingBox()
  const tb = tg.boundingBox!
  const tw = Math.max(tb.max.x - tb.min.x, 0.01)

  const bg = bakedGeometry(target)
  bg.computeBoundingBox()
  const pb = bg.boundingBox!
  bg.dispose()
  const cx = (pb.max.x + pb.min.x) / 2, cz = (pb.max.z + pb.min.z) / 2, topY = pb.max.y
  const s = Math.min(12, Math.max(0.1, ((pb.max.x - pb.min.x) * 0.7) / tw))   // fit ~70% of the part width

  // scale letters (not depth), lay flat (extrusion → down into the part), place on top
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(cx, op === 'cut' ? topY : topY + depth / 2, cz),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
    new THREE.Vector3(s, s, 1)
  )
  tg.applyMatrix4(m)
  const arr = soupPositions(tg)
  tg.dispose()
  return arr
}

/** Midpoint-subdivide a triangle soup: each triangle becomes four, so vertex
 *  edits land on a finer mesh. Input/output are flat [x,y,z,...] positions. */
export function subdivideSoup(verts: number[]): number[] {
  const out: number[] = []
  const mid = (a: number, b: number): [number, number, number] => [
    (verts[a] + verts[b]) / 2, (verts[a + 1] + verts[b + 1]) / 2, (verts[a + 2] + verts[b + 2]) / 2
  ]
  const tri = (p: [number, number, number]) => out.push(p[0], p[1], p[2])
  const at = (i: number): [number, number, number] => [verts[i], verts[i + 1], verts[i + 2]]
  for (let i = 0; i < verts.length; i += 9) {
    const a = at(i), b = at(i + 3), c = at(i + 6)
    const ab = mid(i, i + 3), bc = mid(i + 3, i + 6), ca = mid(i + 6, i)
    tri(a); tri(ab); tri(ca)
    tri(ab); tri(b); tri(bc)
    tri(ca); tri(bc); tri(c)
    tri(ab); tri(bc); tri(ca)
  }
  return out
}

/** One spatial-Laplacian relax pass: each vertex eases toward the average of
 *  vertices within `radius`, blended by `strength` (0..1). Smooths lumps left
 *  by aggressive vertex pulls. A uniform hash grid keeps it ~O(n), so it stays
 *  responsive even on the dense meshes a baked band produces. */
/* ---------------- deformers ---------------- */
// Free-form deformers operate on a flat triangle soup about its own bounding box.
// Axis is the "length" axis the deform runs along; 0=x, 1=y (default, up), 2=z.

const AXIS_INDEX: Record<'x' | 'y' | 'z', number> = { x: 0, y: 1, z: 2 }

function axisBounds(verts: number[], ai: number): { min: number; max: number; mid: number; span: number } {
  let min = Infinity, max = -Infinity
  for (let i = ai; i < verts.length; i += 3) { const v = verts[i]; if (v < min) min = v; if (v > max) max = v }
  if (!isFinite(min)) { min = 0; max = 0 }
  const span = max - min || 1
  return { min, max, mid: (min + max) / 2, span }
}

/** Twist the soup around `axis`, rotating cross-sections progressively along it
 *  (symmetric about the midpoint) by up to `degrees` end-to-end. */
export function twistSoup(verts: number[], degrees: number, axis: 'x' | 'y' | 'z' = 'y'): number[] {
  const ai = AXIS_INDEX[axis]
  const [u, v] = [0, 1, 2].filter(i => i !== ai)          // the two cross-section axes
  const { mid, span } = axisBounds(verts, ai)
  const rad = (degrees * Math.PI) / 180
  const uB = axisBounds(verts, u), vB = axisBounds(verts, v)
  const out = verts.slice()
  for (let i = 0; i < verts.length; i += 3) {
    const t = (verts[i + ai] - mid) / span                // −0.5 … +0.5
    const a = rad * t
    const cs = Math.cos(a), sn = Math.sin(a)
    const du = out[i + u] - uB.mid, dv = out[i + v] - vB.mid
    out[i + u] = uB.mid + du * cs - dv * sn
    out[i + v] = vB.mid + du * sn + dv * cs
  }
  return out
}

/** Taper the soup along `axis`: cross-section scales from 1× at the low end to
 *  `factor`× at the high end (factor<1 narrows to a point, >1 flares out). */
export function taperSoup(verts: number[], factor: number, axis: 'x' | 'y' | 'z' = 'y'): number[] {
  const ai = AXIS_INDEX[axis]
  const [u, v] = [0, 1, 2].filter(i => i !== ai)
  const { min, span } = axisBounds(verts, ai)
  const uB = axisBounds(verts, u), vB = axisBounds(verts, v)
  const out = verts.slice()
  for (let i = 0; i < verts.length; i += 3) {
    const t = (verts[i + ai] - min) / span                // 0 … 1
    const s = 1 + (factor - 1) * t
    out[i + u] = uB.mid + (out[i + u] - uB.mid) * s
    out[i + v] = vB.mid + (out[i + v] - vB.mid) * s
  }
  return out
}

/** Bend the soup into an arc: it runs along `axis` and curves toward `bend`
 *  (default: length y, bending in x) by `degrees` total across its length. */
export function bendSoup(verts: number[], degrees: number, axis: 'x' | 'y' | 'z' = 'y', bend: 'x' | 'y' | 'z' = 'x'): number[] {
  const ai = AXIS_INDEX[axis], bi = AXIS_INDEX[bend === axis ? (axis === 'x' ? 'y' : 'x') : bend]
  const rad = (degrees * Math.PI) / 180
  const out = verts.slice()
  if (Math.abs(rad) < 1e-4) return out
  const { mid, span } = axisBounds(verts, ai)
  const radius = span / rad
  for (let i = 0; i < verts.length; i += 3) {
    const len = out[i + ai] - mid                          // centered length coord
    const off = out[i + bi]                                // distance from neutral line
    const theta = len / radius
    out[i + ai] = mid + (radius - off) * Math.sin(theta)
    out[i + bi] = radius - (radius - off) * Math.cos(theta)
  }
  return out
}

export function smoothSoup(verts: number[], radius: number, strength = 0.5): number[] {
  const n = verts.length / 3
  const out = verts.slice()
  if (n === 0) return out
  const cell = Math.max(radius, 1e-3)
  const grid = new Map<string, number[]>()
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
  for (let i = 0; i < n; i++) {
    const k = key(verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2])
    const bucket = grid.get(k)
    if (bucket) bucket.push(i); else grid.set(k, [i])
  }
  const r2 = radius * radius
  for (let i = 0; i < n; i++) {
    const xi = verts[i * 3], yi = verts[i * 3 + 1], zi = verts[i * 3 + 2]
    const cx = Math.floor(xi / cell), cy = Math.floor(yi / cell), cz = Math.floor(zi / cell)
    let sx = 0, sy = 0, sz = 0, cnt = 0
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gz = cz - 1; gz <= cz + 1; gz++) {
      const bucket = grid.get(`${gx},${gy},${gz}`)
      if (!bucket) continue
      for (const j of bucket) {
        const dx = verts[j * 3] - xi, dy = verts[j * 3 + 1] - yi, dz = verts[j * 3 + 2] - zi
        if (dx * dx + dy * dy + dz * dz <= r2) { sx += verts[j * 3]; sy += verts[j * 3 + 1]; sz += verts[j * 3 + 2]; cnt++ }
      }
    }
    if (cnt > 0) {
      out[i * 3] = xi + (sx / cnt - xi) * strength
      out[i * 3 + 1] = yi + (sy / cnt - yi) * strength
      out[i * 3 + 2] = zi + (sz / cnt - zi) * strength
    }
  }
  return out
}

export function objectMatrix(o: SculptObject): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...o.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation)),
    new THREE.Vector3(...o.scale)
  )
}

export function bakedGeometry(o: SculptObject): THREE.BufferGeometry {
  const g = baseGeometry(o)
  g.applyMatrix4(objectMatrix(o))
  return g
}

/* ---------- boolean + export ---------- */

export function booleanOp(a: SculptObject, b: SculptObject, op: BooleanOp): number[] {
  const brushA = new Brush(bakedGeometry(a)); brushA.updateMatrixWorld()
  const brushB = new Brush(bakedGeometry(b)); brushB.updateMatrixWorld()
  const evaluator = new Evaluator()
  evaluator.useGroups = false
  evaluator.attributes = ['position', 'normal']   // ignore uv etc. so brushes with different attribute sets can combine
  const result = evaluator.evaluate(brushA, brushB, OP[op])
  const pos = result.geometry.getAttribute('position')
  return Array.from(pos.array as Float32Array)
}

export function modelerToStl(objects: SculptObject[]): string {
  const group = new THREE.Group()
  for (const o of objects) group.add(new THREE.Mesh(bakedGeometry(o)))
  const stl = new STLExporter().parse(group, { binary: false })
  group.traverse(n => { const g = (n as THREE.Mesh).geometry; if (g) g.dispose() })
  return stl
}

/* ---------- volume → weight bridge ---------- */

/** Signed-tetrahedron volume of a geometry, mm³ (geometry already in mm). */
export function meshVolume(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute('position')
  const idx = geo.getIndex()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let vol = 0
  const tri = (i0: number, i1: number, i2: number) => {
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2)
    vol += a.dot(b.clone().cross(c)) / 6
  }
  if (idx) for (let i = 0; i < idx.count; i += 3) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2))
  else for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2)
  return Math.abs(vol)
}

/**
 * Is this triangle soup a closed 2-manifold (a real solid)? Vertices are welded
 * by position, then every edge must be shared by exactly two faces. The signed-
 * tetrahedron volume above is only meaningful for such a surface — an open mesh
 * (an imported STL with holes, a hand-sculpted shell) gives a garbage volume,
 * so callers use this to know whether to trust the number.
 */
export function isClosedManifold(geo: THREE.BufferGeometry): boolean {
  const pos = geo.getAttribute('position')
  if (!pos || pos.count < 3) return false
  const idx = geo.getIndex()
  const n = idx ? idx.count : pos.count
  if (n < 3 || n % 3 !== 0) return false
  const Q = 1e4   // weld to 1e-4 mm, matching the export/repair tolerance
  const vid = new Map<string, number>()
  const wid = (i: number): number => {
    const k = `${Math.round(pos.getX(i) * Q)},${Math.round(pos.getY(i) * Q)},${Math.round(pos.getZ(i) * Q)}`
    let m = vid.get(k); if (m === undefined) { m = vid.size; vid.set(k, m) }
    return m
  }
  const get = idx ? (i: number) => wid(idx.getX(i)) : (i: number) => wid(i)
  const edge = new Map<string, number>()
  const bump = (u: number, v: number) => { const k = u < v ? `${u}_${v}` : `${v}_${u}`; edge.set(k, (edge.get(k) ?? 0) + 1) }
  for (let i = 0; i < n; i += 3) {
    const a = get(i), b = get(i + 1), c = get(i + 2)
    if (a === b || b === c || c === a) continue   // skip degenerate slivers, they don't affect closure
    bump(a, b); bump(b, c); bump(c, a)
  }
  if (edge.size === 0) return false
  for (const cnt of edge.values()) if (cnt !== 2) return false
  return true
}

const UNION_MAX_PARTS = 48   // above this, CSG union is too costly — fall back to the summed estimate

/**
 * CSG union of every metal part into one watertight geometry, so overlapping
 * parts (a prong sunk into a head, a bail fused to a bezel) are counted once,
 * not twice. Returns null when it can't be done cleanly (any open part, too many
 * parts, or a boolean failure), letting the caller fall back to the naive sum.
 * The caller owns the returned geometry and must dispose it.
 */
export function unionMetalGeometry(objects: SculptObject[]): THREE.BufferGeometry | null {
  const metal = objects.filter(o => o.material === 'metal')
  if (metal.length === 0) return null
  if (metal.length > UNION_MAX_PARTS) return null
  const geos = metal.map(bakedGeometry)
  if (metal.length === 1) return geos[0]
  if (!geos.every(isClosedManifold)) { geos.forEach(g => g.dispose()); return null }
  try {
    const evaluator = new Evaluator()
    evaluator.useGroups = false
    evaluator.attributes = ['position', 'normal']
    let acc = new Brush(geos[0]); acc.updateMatrixWorld()
    for (let i = 1; i < geos.length; i++) {
      const b = new Brush(geos[i]); b.updateMatrixWorld()
      const res = evaluator.evaluate(acc, b, ADDITION)
      acc = new Brush(res.geometry); acc.updateMatrixWorld()
    }
    const out = acc.geometry
    geos.forEach(g => g.dispose())
    return out
  } catch {
    geos.forEach(g => g.dispose())
    return null
  }
}

export interface MetalVolumeReport {
  mm3: number
  method: 'exact' | 'union' | 'sum'   // exact = single closed part; union = overlaps merged; sum = fallback
  closed: boolean                      // every metal part is a closed solid
  overlap: boolean                     // parts actually overlap (only known on the union path)
  parts: number
  note?: string                        // human confidence note when the number isn't exact
}

const volCache = new Map<string, MetalVolumeReport>()
const VOL_CACHE_MAX = 64
function metalSignature(objects: SculptObject[]): string {
  const out: string[] = []
  for (const o of objects) {
    if (o.material !== 'metal') continue
    out.push(`${o.id}|${o.kind}|${o.size}|${o.position.join(',')}|${o.rotation.join(',')}|${o.scale.join(',')}|${o.vertices?.length ?? 0}|${o.params ? JSON.stringify(o.params) : ''}`)
  }
  return out.join(';')
}

/**
 * Metal volume of the sculpt (gems excluded), mm³, with a confidence report.
 * Overlapping closed parts are merged via CSG so their shared metal isn't
 * double-counted; open/non-manifold meshes fall back to the summed estimate and
 * are flagged. Memoized on geometry so the many callers stay cheap.
 */
export function metalVolumeReport(objects: SculptObject[]): MetalVolumeReport {
  const sig = metalSignature(objects)
  const cached = volCache.get(sig)
  if (cached) return cached

  const metal = objects.filter(o => o.material === 'metal')
  let report: MetalVolumeReport
  if (metal.length === 0) {
    report = { mm3: 0, method: 'exact', closed: true, overlap: false, parts: 0 }
  } else {
    const geos = metal.map(bakedGeometry)
    const allClosed = geos.every(isClosedManifold)
    const sum = geos.reduce((s, g) => s + meshVolume(g), 0)
    if (metal.length === 1) {
      report = {
        mm3: sum, method: 'exact', closed: allClosed, overlap: false, parts: 1,
        note: allClosed ? undefined : 'Open/non-manifold mesh — volume is approximate.',
      }
    } else {
      const union = unionMetalGeometry(objects)   // rebuilds its own geometries + re-checks closure
      if (union) {
        const uvol = meshVolume(union)
        union.dispose()
        const overlap = sum - uvol > Math.max(1e-6, sum * 1e-3)
        report = {
          mm3: uvol, method: 'union', closed: true, overlap, parts: metal.length,
          note: overlap ? 'Overlapping metal parts merged — shared metal counted once.' : undefined,
        }
      } else {
        report = {
          mm3: sum, method: 'sum', closed: allClosed, overlap: false, parts: metal.length,
          note: !allClosed
            ? 'Open/non-manifold mesh — volume is approximate.'
            : metal.length > UNION_MAX_PARTS
              ? `${metal.length} metal parts — summed without merge; any overlaps may be double-counted.`
              : 'Parts summed; overlapping metal may be double-counted.',
        }
      }
    }
    geos.forEach(g => g.dispose())
  }

  if (volCache.size >= VOL_CACHE_MAX) {
    const oldest = volCache.keys().next().value
    if (oldest !== undefined) volCache.delete(oldest)
  }
  volCache.set(sig, report)
  return report
}

/** Total metal volume of the sculpt (gems excluded), mm³. Overlap-corrected. */
export function sculptMetalVolume(objects: SculptObject[]): number {
  return metalVolumeReport(objects).mm3
}

export function sculptGemCarats(objects: SculptObject[]): number {
  return objects.filter(o => o.kind === 'gem').reduce((s, o) => s + (o.params?.carat ?? 0), 0)
}

/**
 * Uniform scale factor to take a piece from its current cast weight to a target
 * weight. Metal weight scales with volume, i.e. the cube of a linear scale, so
 * the factor is the cube root of the weight ratio. Clamped to a sane range so a
 * fat-fingered target can't explode or vanish the piece.
 */
export function weightScaleFactor(currentGrams: number, targetGrams: number): number {
  if (!(currentGrams > 0) || !(targetGrams > 0)) return 1
  const s = Math.cbrt(targetGrams / currentGrams)
  return Math.min(5, Math.max(0.2, s))
}

/* ---------- sculpt price estimate ---------- */

const OZT_G = 31.1035

export interface SculptEstimate {
  vol: number; castG: number; carats: number; gemCount: number
  metalCost: number; stoneCost: number; settingLabor: number; finishFee: number
  subtotal: number; total: number
}

/**
 * A retail estimate from a sculpt, mirroring the Design tab's engine: exact
 * metal (summed part volume × alloy, at the shared spot factor), catalog stone
 * rates, size-scaled setting labor, mass-scaled cast/finish, × the shop margin.
 */
export function sculptEstimate(objects: SculptObject[], alloyId: string): SculptEstimate {
  const alloy = alloyById(alloyId)
  const vol = sculptMetalVolume(objects)
  const castG = (vol / 1000) * alloy.density
  const metalCost = alloy.precious
    ? ((castG * alloy.fine) / OZT_G) * (alloy.spot * MARKET.spotFactor) * (1 + alloy.premium)
    : castG * alloy.perGram * (1 + alloy.premium)
  const gems = objects.filter(o => o.kind === 'gem')
  const stoneCost = gems.reduce((sum, g) => {
    const st = stoneById(g.params?.stoneTypeId ?? 'dia')
    return sum + st.rate * Math.pow(Math.max(g.params?.carat ?? 0, 0.001), st.exponent)
  }, 0)
  const carats = gems.reduce((s, g) => s + (g.params?.carat ?? 0), 0)
  // Labor tracks the actual work: setting scales with each stone's size, and
  // finishing with the mass of metal that has to be filed and polished.
  const settingLabor = gems.reduce((s, g) => s + settingLaborFor(g.params?.carat ?? 0), 0)
  const finishFee = finishingFee(castG)
  const subtotal = metalCost + stoneCost + settingLabor + finishFee
  return { vol, castG, carats, gemCount: gems.length, metalCost, stoneCost, settingLabor, finishFee, subtotal, total: subtotal * MARKET.margin }
}

/** Minimum wall / feature size, mm — below this, casting or printing gets risky. */
export const MIN_WALL_MM = 0.8

export interface SculptWarning { part: string; text: string }

/** Printability / castability checks over the metal parts (thin sections). */
export function sculptWarnings(objects: SculptObject[]): SculptWarning[] {
  const out: SculptWarning[] = []
  for (const o of objects) {
    if (o.material !== 'metal') continue
    const [w, h, d] = boundingSize(o)
    const min = Math.min(w, h, d)
    if (min > 0 && min < MIN_WALL_MM) {
      out.push({ part: o.name, text: `thin section ${min.toFixed(2)} mm — below ~${MIN_WALL_MM} mm may not cast or print cleanly` })
    }
  }
  return out
}

/** Bounding-box dimensions of one object, in mm [w, h, d]. */
export function boundingSize(o: SculptObject): [number, number, number] {
  const g = bakedGeometry(o)
  g.computeBoundingBox()
  const b = g.boundingBox
  g.dispose()
  if (!b) return [0, 0, 0]
  return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]
}
