import * as THREE from 'three'

/**
 * Necklace rendered as a real interlocking chain around the neckline loop (a
 * circle in the XY view plane) instead of a smooth torus. Links are placed along
 * the circle, each oriented to the local tangent with alternating 90° twist so
 * consecutive links thread through one another. Several classic chain styles vary
 * the link size, spacing and shape. Returns a triangle soup (flat [x,y,z,...]).
 */

export type NecklaceStyle =
  | 'cable' | 'curb' | 'cuban' | 'rope' | 'figaro' | 'bead'
  | 'box' | 'snake' | 'mariner' | 'herringbone' | 'rolo'

export const NECKLACE_STYLES: [NecklaceStyle, string][] = [
  ['cable', 'Cable'], ['rolo', 'Rolo / belcher'], ['curb', 'Curb'], ['cuban', 'Cuban (chunky curb)'],
  ['figaro', 'Figaro'], ['rope', 'Rope'], ['box', 'Box / Venetian'], ['snake', 'Snake'],
  ['herringbone', 'Herringbone'], ['mariner', 'Mariner / anchor'], ['bead', 'Bead / ball'],
]

interface StyleSpec { link: number; spacing: number; minorK: number; oval: number }
// link = link major radius ÷ wire; spacing = centre-to-centre ÷ link; minorK = wire scale; oval = long-axis stretch
const STYLE: Record<NecklaceStyle, StyleSpec> = {
  cable:  { link: 2.1, spacing: 1.05, minorK: 1.0, oval: 1.0 },
  rolo:   { link: 2.0, spacing: 1.0,  minorK: 1.25, oval: 1.0 },
  curb:   { link: 2.4, spacing: 0.82, minorK: 1.15, oval: 1.15 },
  cuban:  { link: 2.6, spacing: 0.72, minorK: 1.35, oval: 1.25 },
  rope:   { link: 1.5, spacing: 0.72, minorK: 0.9, oval: 1.0 },
  figaro: { link: 2.1, spacing: 1.0, minorK: 1.0, oval: 1.0 },   // long link every 4th (handled below)
  bead:   { link: 1.7, spacing: 1.25, minorK: 1.0, oval: 1.0 },
  box:    { link: 1.6, spacing: 1.0, minorK: 1.2, oval: 1.0 },
  snake:  { link: 1.1, spacing: 0.85, minorK: 0.75, oval: 1.0 },
  mariner:{ link: 2.2, spacing: 1.08, minorK: 1.0, oval: 1.35 },
  herringbone: { link: 1.8, spacing: 0.55, minorK: 1.0, oval: 1.0 },
}

function pushGeo(out: number[], g: THREE.BufferGeometry, m: THREE.Matrix4) {
  g.applyMatrix4(m)
  const ni = g.index ? g.toNonIndexed() : g
  const pos = ni.getAttribute('position') as THREE.BufferAttribute
  for (let k = 0; k < pos.count; k++) out.push(pos.getX(k), pos.getY(k), pos.getZ(k))
  ni.dispose()
  if (ni !== g) g.dispose()
}

export function necklaceChainVertices(R: number, wireR: number, style: NecklaceStyle = 'cable'): number[] {
  const s = STYLE[style]
  const wire = Math.max(0.25, wireR) * s.minorK
  const linkR = wire * s.link
  const step = linkR * 2 * s.spacing            // centre-to-centre arc length
  const N = Math.max(16, Math.round((2 * Math.PI * R) / step))
  const out: number[] = []

  const P = new THREE.Vector3(), T = new THREE.Vector3(), Nz = new THREE.Vector3(0, 0, 1), Rd = new THREE.Vector3()

  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2
    const c = Math.cos(th), sn = Math.sin(th)
    P.set(c * R, sn * R, 0)
    T.set(-sn, c, 0)          // tangent (chain direction)
    Rd.set(c, sn, 0)          // radial

    // Twisting basis: even links stand perpendicular to the necklace plane,
    // odd links lie in it (so links thread through one another).
    const mAlt = new THREE.Matrix4()
    if (i % 2 === 0) mAlt.makeBasis(T, Nz, Rd)
    else mAlt.makeBasis(T, Rd, Nz)
    mAlt.setPosition(P)
    // Flat/consistent basis for continuous chains (box, snake, herringbone).
    const mFlat = new THREE.Matrix4().makeBasis(T, Nz, Rd).setPosition(P)

    switch (style) {
      case 'bead':
        pushGeo(out, new THREE.SphereGeometry(linkR * 0.72, 14, 12), mAlt)
        break
      case 'snake':
        // Tight small beads read as a smooth, flexible snake chain.
        pushGeo(out, new THREE.SphereGeometry(linkR * 0.62, 12, 10), mFlat)
        break
      case 'box': {
        // Square segments abutting into a Venetian / box chain.
        const w = linkR * 1.25
        pushGeo(out, new THREE.BoxGeometry(step * 0.98, w, w), mFlat)
        break
      }
      case 'herringbone': {
        // Flat plates laid in an alternating V — the classic woven ribbon.
        const g = new THREE.BoxGeometry(step * 1.05, linkR * 1.7, wire * 0.8)
        g.rotateX(i % 2 === 0 ? 0.42 : -0.42)
        pushGeo(out, g, mFlat)
        break
      }
      case 'mariner': {
        // Oval link with a centre bar (anchor / mariner).
        const link = new THREE.TorusGeometry(linkR, wire, 8, 22)
        link.scale(s.oval, 1, 1)
        pushGeo(out, link, mAlt)
        const bar = new THREE.BoxGeometry(wire * 1.8, linkR * 1.7, wire * 1.8)
        pushGeo(out, bar, mAlt)
        break
      }
      case 'rolo': {
        // Round, symmetrical links — belcher chain.
        pushGeo(out, new THREE.TorusGeometry(linkR, wire, 10, 24), mAlt)
        break
      }
      default: {
        // cable / curb / cuban / figaro — torus links, some stretched/flattened.
        const long = style === 'figaro' && i % 4 === 0 ? 1.8 : s.oval
        const g = new THREE.TorusGeometry(linkR, wire, 8, 22)
        if (long !== 1) g.scale(long, 1, 1)          // stretch along the tangent
        if (style === 'cuban') g.scale(1, 1, 0.6)     // flatten — chunky Cuban look
        pushGeo(out, g, mAlt)
      }
    }
  }
  return out
}
