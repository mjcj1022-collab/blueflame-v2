/**
 * Dome the top of a part into a cabochon / comfort bulge. Vertices in the upper
 * region are pushed up along Y, most at the centre axis and tapering to nothing
 * at the rim, so a flat signet top or a slab becomes a smooth dome. Displacement
 * is a pure function of position, so shared triangle corners move together and
 * the mesh stays welded.
 */
export function domeSoup(verts: number[], height: number): number[] {
  const n = verts.length
  if (n < 9) return verts.slice()
  let minY = Infinity, maxY = -Infinity, cx = 0, cz = 0, minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  for (let i = 0; i + 2 < n; i += 3) {
    minY = Math.min(minY, verts[i + 1]); maxY = Math.max(maxY, verts[i + 1])
    minX = Math.min(minX, verts[i]); maxX = Math.max(maxX, verts[i])
    minZ = Math.min(minZ, verts[i + 2]); maxZ = Math.max(maxZ, verts[i + 2])
  }
  cx = (minX + maxX) / 2; cz = (minZ + maxZ) / 2
  const midY = (minY + maxY) / 2
  const topR = Math.max(1e-3, Math.max(maxX - minX, maxZ - minZ) / 2)
  const span = Math.max(1e-6, maxY - midY)

  const out = new Array<number>(n)
  for (let i = 0; i + 2 < n; i += 3) {
    const x = verts[i], y = verts[i + 1], z = verts[i + 2]
    out[i] = x; out[i + 1] = y; out[i + 2] = z
    if (y <= midY) continue // only the top half domes
    const up = (y - midY) / span // 0 at mid, 1 at the very top
    const r = Math.hypot(x - cx, z - cz) / topR // 0 at centre axis, 1 at rim
    const radial = Math.max(0, 1 - r * r) // parabolic falloff to the rim
    out[i + 1] = y + height * up * radial
  }
  return out
}
