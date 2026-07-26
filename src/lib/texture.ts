/**
 * Surface texturing for metal parts — hammered, sandblast stipple, and Florentine
 * cross-hatch. Works directly on a triangle soup by displacing each vertex along
 * the averaged surface normal at its position by a deterministic noise field.
 *
 * The key trick for staying watertight: displacement is a pure function of a
 * vertex's *position*, and the normal is accumulated per unique position. Two
 * triangles that share a corner therefore move that corner identically, so the
 * mesh doesn't crack open along shared edges.
 */

export type TextureStyle = 'hammered' | 'stipple' | 'florentine'

// cheap deterministic hash → [0,1); no Math.random (keeps runs reproducible)
function hash(n: number): number {
  const s = Math.sin(n) * 43758.5453
  return s - Math.floor(s)
}

// smooth value noise in 3D from lattice hashes
function valueNoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const sm = (t: number) => t * t * (3 - 2 * t)
  const u = sm(xf), v = sm(yf), w = sm(zf)
  const corner = (i: number, j: number, k: number) => hash((xi + i) * 127.1 + (yi + j) * 311.7 + (zi + k) * 74.7)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const x00 = lerp(corner(0, 0, 0), corner(1, 0, 0), u)
  const x10 = lerp(corner(0, 1, 0), corner(1, 1, 0), u)
  const x01 = lerp(corner(0, 0, 1), corner(1, 0, 1), u)
  const x11 = lerp(corner(0, 1, 1), corner(1, 1, 1), u)
  const y0 = lerp(x00, x10, v)
  const y1 = lerp(x01, x11, v)
  return lerp(y0, y1, w) // 0..1
}

/** The displacement field for a style at a point, in the range about [-1, 1]. */
function field(style: TextureStyle, x: number, y: number, z: number, scale: number): number {
  const s = Math.max(1e-3, scale)
  if (style === 'hammered') {
    // broad, rounded dents
    return valueNoise(x / s, y / s, z / s) * 2 - 1
  }
  if (style === 'stipple') {
    // fine, high-frequency roughness
    const f = valueNoise(x / (s * 0.4), y / (s * 0.4), z / (s * 0.4))
    return (f * 2 - 1) * 0.6
  }
  // florentine: parallel engraved lines, jittered so they read hand-cut
  const jitter = valueNoise(x / (s * 3), y / (s * 3), z / (s * 3)) * 0.6
  return Math.sin((x + z) / (s * 0.5) + jitter) // -1..1
}

const qkey = (x: number, y: number, z: number) => `${Math.round(x * 1e3)},${Math.round(y * 1e3)},${Math.round(z * 1e3)}`

/**
 * Return a new triangle soup with a texture displaced into the surface.
 * `amp` is the peak displacement in mm; `scale` sets the feature size in mm.
 */
export function textureSoup(verts: number[], style: TextureStyle, amp: number, scale: number): number[] {
  const n = verts.length
  // 1) accumulate a normal per unique position
  const acc = new Map<string, [number, number, number]>()
  for (let i = 0; i + 8 < n; i += 9) {
    const ax = verts[i], ay = verts[i + 1], az = verts[i + 2]
    const bx = verts[i + 3], by = verts[i + 4], bz = verts[i + 5]
    const cx = verts[i + 6], cy = verts[i + 7], cz = verts[i + 8]
    const ux = bx - ax, uy = by - ay, uz = bz - az
    const vx = cx - ax, vy = cy - ay, vz = cz - az
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    for (const [px, py, pz] of [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] as const) {
      const k = qkey(px, py, pz)
      const cur = acc.get(k)
      if (cur) { cur[0] += nx; cur[1] += ny; cur[2] += nz }
      else acc.set(k, [nx, ny, nz])
    }
  }
  // 2) displace each vertex along its averaged normal by the noise field
  const out = new Array<number>(n)
  for (let i = 0; i + 2 < n; i += 3) {
    const x = verts[i], y = verts[i + 1], z = verts[i + 2]
    const nrm = acc.get(qkey(x, y, z))
    let dx = 0, dy = 0, dz = 0
    if (nrm) {
      const len = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1
      const d = amp * field(style, x, y, z, scale)
      dx = (nrm[0] / len) * d; dy = (nrm[1] / len) * d; dz = (nrm[2] / len) * d
    }
    out[i] = x + dx; out[i + 1] = y + dy; out[i + 2] = z + dz
  }
  return out
}
