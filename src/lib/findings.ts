import * as THREE from 'three'

/**
 * Findings — the manufactured components a maker assembles a piece from: clasps,
 * jump rings, bails, ear posts and backs, toggles, head pins. Each is a small
 * parametric part baked to a triangle soup (millimetres, centred at origin) that
 * drops onto the bench as a metal mesh, ready to position and solder. Real pieces
 * are assemblies of findings + the design; this is the library that supplies them.
 */

export interface Finding {
  id: string
  name: string
  blurb: string
  category: 'clasp' | 'ring' | 'ear' | 'bail' | 'pin'
}

export const FINDINGS: Finding[] = [
  { id: 'jump', name: 'Jump ring', blurb: 'Open round link, 5 mm', category: 'ring' },
  { id: 'splitring', name: 'Split ring', blurb: 'Double-wound link', category: 'ring' },
  { id: 'spring', name: 'Spring-ring clasp', blurb: 'Round spring clasp', category: 'clasp' },
  { id: 'lobster', name: 'Lobster clasp', blurb: 'Trigger clasp, 12 mm', category: 'clasp' },
  { id: 'togglebar', name: 'Toggle bar', blurb: 'T-bar half of a toggle', category: 'clasp' },
  { id: 'togglering', name: 'Toggle ring', blurb: 'Ring half of a toggle', category: 'clasp' },
  { id: 'bail', name: 'Bail', blurb: 'Pendant loop', category: 'bail' },
  { id: 'earpost', name: 'Ear post', blurb: 'Friction post', category: 'ear' },
  { id: 'earnut', name: 'Ear nut / back', blurb: 'Friction back', category: 'ear' },
  { id: 'headpin', name: 'Head pin', blurb: 'Ball-end pin, 20 mm', category: 'pin' },
]

export const findingById = (id: string): Finding | undefined => FINDINGS.find(f => f.id === id)

/** Bake a THREE geometry (with a transform) into a flat triangle soup. */
function push(out: number[], g: THREE.BufferGeometry, m?: THREE.Matrix4) {
  if (m) g.applyMatrix4(m)
  const ni = g.index ? g.toNonIndexed() : g
  const p = ni.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) out.push(p.getX(i), p.getY(i), p.getZ(i))
  ni.dispose(); if (ni !== g) g.dispose()
}
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z)

/** Triangle soup (mm, centred) for a finding. */
export function findingVertices(id: string): number[] {
  const out: number[] = []
  switch (id) {
    case 'jump':
      push(out, new THREE.TorusGeometry(2.5, 0.5, 12, 28))
      break
    case 'splitring':
      push(out, new THREE.TorusGeometry(2.6, 0.45, 12, 28), at(0, 0.3, 0))
      push(out, new THREE.TorusGeometry(2.6, 0.45, 12, 28), at(0, -0.3, 0))
      break
    case 'spring':
      push(out, new THREE.TorusGeometry(4.5, 0.9, 14, 30))                 // ring body
      push(out, new THREE.CylinderGeometry(1.6, 1.6, 1.4, 16), at(4.5, 0, 0)) // knuckle
      break
    case 'lobster': {
      // Oval body + a small trigger lever — the classic lobster/trigger clasp.
      const body = new THREE.TorusGeometry(4, 1, 14, 30); body.scale(1, 1.5, 1)
      push(out, body)
      push(out, new THREE.CapsuleGeometry(0.7, 4, 6, 10), at(-1.4, 0, 1.1))  // lever
      break
    }
    case 'togglebar':
      push(out, new THREE.CylinderGeometry(0.9, 0.9, 14, 16), new THREE.Matrix4().makeRotationZ(Math.PI / 2)) // bar
      push(out, new THREE.SphereGeometry(1.3, 14, 12), at(7, 0, 0))
      push(out, new THREE.SphereGeometry(1.3, 14, 12), at(-7, 0, 0))
      push(out, new THREE.TorusGeometry(1.6, 0.5, 10, 20), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(at(0, 3, 0))) // link loop
      break
    case 'togglering':
      push(out, new THREE.TorusGeometry(5, 1, 14, 32))
      push(out, new THREE.TorusGeometry(1.6, 0.5, 10, 20), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(at(0, 6.4, 0)))
      break
    case 'bail': {
      const loop = new THREE.TorusGeometry(3, 0.8, 14, 30, Math.PI * 1.6) // open-bottom loop
      loop.rotateZ(-Math.PI * 0.3)
      push(out, loop)
      break
    }
    case 'earpost':
      push(out, new THREE.CylinderGeometry(0.4, 0.4, 10, 12), at(0, 5, 0))     // post
      push(out, new THREE.SphereGeometry(1.4, 14, 12), at(0, 0, 0))            // pad/cup
      break
    case 'earnut':
      push(out, new THREE.CylinderGeometry(2.2, 2.2, 1.2, 18))                 // disc
      push(out, new THREE.CylinderGeometry(0.7, 0.7, 2.4, 12))                 // sleeve
      break
    case 'headpin':
      push(out, new THREE.CylinderGeometry(0.35, 0.35, 20, 12), at(0, 10, 0))  // pin
      push(out, new THREE.SphereGeometry(1.1, 14, 12), at(0, 0, 0))            // ball end
      break
    default:
      push(out, new THREE.TorusGeometry(2.5, 0.5, 12, 28))
  }
  return out
}
