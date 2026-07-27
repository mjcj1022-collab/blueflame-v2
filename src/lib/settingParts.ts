import * as THREE from 'three'

/**
 * Setting sub-assemblies as real geometry — the parts that make a mount a proper
 * setting rather than bare claws. A BASKET (upper + lower gallery rings joined by
 * vertical wires, the cradle a stone sits in) and a GALLERY RAIL (a single
 * decorative/structural hoop). Baked triangle soups (mm, centred at the top ring),
 * so the modeler adds them as metal parts. Pure + deterministic.
 */

function push(out: number[], g: THREE.BufferGeometry, m?: THREE.Matrix4) {
  if (m) g.applyMatrix4(m)
  const ni = g.index ? g.toNonIndexed() : g
  const p = ni.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) out.push(p.getX(i), p.getY(i), p.getZ(i))
  ni.dispose(); if (ni !== g) g.dispose()
}

/** Classic basket: an upper ring (at y=0) and a slightly smaller lower ring
 *  (at y=-height), joined by `wires` vertical struts. */
export function basketVertices(topR: number, height = topR * 1.1, wires = 4): number[] {
  const out: number[] = []
  const wire = Math.max(0.35, topR * 0.12)
  const botR = topR * 0.72
  // upper + lower gallery rings (torus lies in XZ plane → rotate the default XY torus)
  const upper = new THREE.TorusGeometry(topR, wire, 10, 40); upper.rotateX(Math.PI / 2)
  push(out, upper)
  const lower = new THREE.TorusGeometry(botR, wire, 10, 40); lower.rotateX(Math.PI / 2); lower.translate(0, -height, 0)
  push(out, lower)
  // vertical struts, tilted inward to meet the smaller lower ring
  for (let i = 0; i < wires; i++) {
    const a = (i / wires) * Math.PI * 2 + Math.PI / wires
    const ux = Math.cos(a) * topR, uz = Math.sin(a) * topR
    const lx = Math.cos(a) * botR, lz = Math.sin(a) * botR
    const mx = (ux + lx) / 2, mz = (uz + lz) / 2
    const len = Math.hypot(ux - lx, height, uz - lz)
    const strut = new THREE.CylinderGeometry(wire, wire, len, 8)
    // orient the Y-axis cylinder along the strut direction
    const dir = new THREE.Vector3(lx - ux, -height, lz - uz).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const m = new THREE.Matrix4().compose(new THREE.Vector3(mx, -height / 2, mz), q, new THREE.Vector3(1, 1, 1))
    push(out, strut, m)
  }
  return out
}

/** A single decorative gallery rail (a hoop) of radius `r`. */
export function galleryRailVertices(r: number): number[] {
  const out: number[] = []
  const g = new THREE.TorusGeometry(r, Math.max(0.3, r * 0.1), 10, 48); g.rotateX(Math.PI / 2)
  push(out, g)
  return out
}
