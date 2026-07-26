import { useMemo } from 'react'
import * as THREE from 'three'
import type { Material } from 'three'
import type { NecklaceMotif } from '../spec/types'
import { CelticKnot } from './CelticKnot'

const TWO_PI = Math.PI * 2

/** A flat heart plate, built once from a parametric heart curve and extruded. */
function heartGeometry(R: number, thick: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape()
  const n = 60
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TWO_PI
    // classic heart curve, scaled to ~R and centred
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    pts.push([(x / 16) * R, (y / 16) * R])
  }
  s.moveTo(pts[0][0], pts[0][1])
  pts.slice(1).forEach(([x, y]) => s.lineTo(x, y))
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelSize: thick * 0.25, bevelThickness: thick * 0.25, bevelSegments: 2, steps: 1 })
  g.center()
  return g
}

/**
 * Renders a decorative motif medallion at the origin, sized to base radius R.
 * Each motif is real geometry (not a texture) so it reads correctly from any
 * angle and casts a true silhouette. Shared by the necklace pendant slot.
 */
export function Motif({ motif, material, R, gauge }: { motif: NecklaceMotif; material: Material; R: number; gauge: number }) {
  const t = Math.max(gauge * 1.4, 2.4)          // bar / wire thickness
  const heart = useMemo(() => (motif === 'heart' ? heartGeometry(R, t) : null), [motif, R, t])

  switch (motif) {
    case 'none':
      return null

    case 'celtic':
      return <CelticKnot material={material} radius={R * 0.9} tube={Math.max(gauge * 0.7, 1.2)} />

    case 'cross':
      return (
        <group>
          <mesh material={material}><boxGeometry args={[t, R * 2.2, t]} /></mesh>
          <mesh material={material} position={[0, R * 0.35, 0]}><boxGeometry args={[R * 1.5, t, t]} /></mesh>
        </group>
      )

    case 'infinity':
      return (
        <group rotation={[0, 0, 0]}>
          {[-1, 1].map(s => (
            <mesh key={s} material={material} position={[s * R * 0.62, 0, 0]}>
              <torusGeometry args={[R * 0.62, t * 0.45, 14, 48]} />
            </mesh>
          ))}
        </group>
      )

    case 'heart':
      return heart ? <mesh material={material} geometry={heart} /> : null

    case 'halo':
      return (
        <group>
          <mesh material={material} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[R, t * 0.5, 14, 64]} /></mesh>
          <mesh material={material}><sphereGeometry args={[R * 0.42, 24, 18]} /></mesh>
        </group>
      )

    case 'cluster':
      return (
        <group>
          <mesh material={material}><sphereGeometry args={[R * 0.34, 22, 16]} /></mesh>
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * TWO_PI
            return <mesh key={i} material={material} position={[Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, 0]}><sphereGeometry args={[R * 0.3, 20, 14]} /></mesh>
          })}
        </group>
      )

    case 'floral':
      return (
        <group>
          <mesh material={material}><sphereGeometry args={[R * 0.32, 22, 16]} /></mesh>
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * TWO_PI
            return (
              <mesh key={i} material={material} position={[Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, 0]} scale={[1, 0.5, 0.5]}>
                <sphereGeometry args={[R * 0.42, 18, 12]} />
              </mesh>
            )
          })}
        </group>
      )
  }
}
