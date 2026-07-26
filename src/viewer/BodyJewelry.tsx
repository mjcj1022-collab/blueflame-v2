import type { DesignSpec } from '../spec/types'
import type { Material } from 'three'
import { alloyById } from '../catalog'
import { isHidden } from '../lib/features'
import { useMetalMaterial } from './material'

const TWO_PI = Math.PI * 2

/** A metal ball / bead at a point. */
function ball(material: Material, p: [number, number, number], d: number, key?: string) {
  return (
    <mesh key={key} material={material} position={p} castShadow>
      <sphereGeometry args={[d / 2, 28, 22]} />
    </mesh>
  )
}

/**
 * Body jewelry rendered at true millimetre scale — barbells, rings and plugs.
 * Every style is built from the same primitives (a wire/shaft, balls and the odd
 * disc) so the piece stays light and reads cleanly in the fixed studio camera.
 */
export function BodyJewelry({ spec }: { spec: DesignSpec }) {
  const alloy = alloyById(spec.metal.alloyId)
  const metal = useMetalMaterial(alloy, spec.finish)
  if (isHidden(spec, 'band')) return <group />

  const { style, gauge, size, ballSize } = spec.body
  const r = Math.max(gauge, 0.4) / 2
  const ringR = Math.max(size, 3) / 2      // ring inner radius for loop styles

  switch (style) {
    case 'barbell': {
      const L = Math.max(size, 3)
      return (
        <group>
          <mesh material={metal}><cylinderGeometry args={[r, r, L, 24]} /></mesh>
          {ball(metal, [0, L / 2, 0], ballSize)}
          {ball(metal, [0, -L / 2, 0], ballSize)}
        </group>
      )
    }

    case 'curved': {
      // A shallow banana: a torus arc symmetric about +X, ends carrying the balls.
      const R = Math.max(size, 4) * 0.85
      const arc = 1.5
      const ex = R * Math.cos(arc / 2)
      const ey = R * Math.sin(arc / 2)
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh material={metal} rotation={[0, 0, -arc / 2]}>
            <torusGeometry args={[R, r, 16, 80, arc]} />
          </mesh>
          {ball(metal, [ex, ey, 0], ballSize)}
          {ball(metal, [ex, -ey, 0], ballSize * 0.85)}
        </group>
      )
    }

    case 'cbr': {
      // Full wire ring with a captive bead straddling the top.
      return (
        <group>
          <mesh material={metal} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[ringR, r, 18, 120]} />
          </mesh>
          {ball(metal, [0, ringR, 0], Math.max(ballSize, gauge * 1.6))}
        </group>
      )
    }

    case 'circular': {
      // Horseshoe: ~83% ring open toward −X, a ball on each end.
      const arc = TWO_PI * 0.83
      const half = arc / 2
      const ex = ringR * Math.cos(half)
      const ey = ringR * Math.sin(half)
      return (
        <group>
          <mesh material={metal} rotation={[0, 0, -half]}>
            <torusGeometry args={[ringR, r, 16, 110, arc]} />
          </mesh>
          {ball(metal, [ex, ey, 0], ballSize)}
          {ball(metal, [ex, -ey, 0], ballSize)}
        </group>
      )
    }

    case 'septum': {
      // Mostly-closed ring with a heavier decorative front bar at +X.
      const arc = TWO_PI * 0.86
      const half = arc / 2
      return (
        <group>
          <mesh material={metal} rotation={[0, 0, -half]}>
            <torusGeometry args={[ringR, r, 16, 110, arc]} />
          </mesh>
          <mesh material={metal} position={[ringR, 0, 0]}>
            <cylinderGeometry args={[r * 1.5, r * 1.5, ringR * 0.9, 20]} />
          </mesh>
        </group>
      )
    }

    case 'labret': {
      // Vertical post, a flat backing disc at the bottom, a ball/gem at the top.
      const L = Math.max(size, 3)
      return (
        <group>
          <mesh material={metal}><cylinderGeometry args={[r, r, L, 20]} /></mesh>
          <mesh material={metal} position={[0, -L / 2, 0]}>
            <cylinderGeometry args={[ballSize * 0.7, ballSize * 0.7, 0.9, 28]} />
          </mesh>
          {ball(metal, [0, L / 2, 0], ballSize)}
        </group>
      )
    }

    case 'plug': {
      // Double-flared tube: a central barrel with a flared lip at each end.
      const R = Math.max(size, 4) / 2
      const H = Math.max(size * 0.7, 4)
      const lip = 1.0
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh material={metal}><cylinderGeometry args={[R, R, H, 40]} /></mesh>
          <mesh material={metal} position={[0, H / 2 + 0.6, 0]}>
            <cylinderGeometry args={[R + lip, R, 1.2, 40]} />
          </mesh>
          <mesh material={metal} position={[0, -H / 2 - 0.6, 0]}>
            <cylinderGeometry args={[R, R + lip, 1.2, 40]} />
          </mesh>
        </group>
      )
    }

    case 'hoop':
      // A plain seamless ring — no bead, no gap.
      return (
        <mesh material={metal} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ringR, r, 20, 140]} />
        </mesh>
      )

    case 'tunnel': {
      // Hollow eyelet: an open barrel with a rim at each end (rendered as a thin
      // large-radius torus so the bore reads as truly hollow).
      const R = Math.max(size, 4) / 2
      const H = Math.max(size * 0.6, 4)
      const wall = 1.2
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh material={metal}><cylinderGeometry args={[R + wall, R + wall, H, 48, 1, true]} /></mesh>
          <mesh material={metal} position={[0, H / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[R + wall * 0.5, wall * 0.6, 12, 48]} />
          </mesh>
          <mesh material={metal} position={[0, -H / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[R + wall * 0.5, wall * 0.6, 12, 48]} />
          </mesh>
        </group>
      )
    }

    case 'taper': {
      // A stretching taper: a long cone from the gauge up to the ball diameter.
      const L = Math.max(size, 6)
      return (
        <mesh material={metal} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[Math.max(ballSize, gauge) / 2, L, 28]} />
        </mesh>
      )
    }

    case 'spike': {
      // Straight shaft with a conical spike on each end.
      const L = Math.max(size, 3)
      const sh = Math.max(ballSize, gauge) * 1.6
      return (
        <group>
          <mesh material={metal}><cylinderGeometry args={[r, r, L, 24]} /></mesh>
          <mesh material={metal} position={[0, L / 2 + sh / 2, 0]}><coneGeometry args={[ballSize / 2, sh, 24]} /></mesh>
          <mesh material={metal} position={[0, -L / 2 - sh / 2, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[ballSize / 2, sh, 24]} /></mesh>
        </group>
      )
    }

    case 'nostril': {
      // A short post with a small gem/ball at the top (worn in the nostril).
      const L = Math.max(size * 0.6, 4)
      return (
        <group>
          <mesh material={metal}><cylinderGeometry args={[r, r, L, 20]} /></mesh>
          {ball(metal, [0, L / 2, 0], ballSize)}
        </group>
      )
    }

    case 'nipple': {
      // A barbell with a flat decorative shield plate around the centre.
      const L = Math.max(size, 3)
      return (
        <group>
          <mesh material={metal}><cylinderGeometry args={[r, r, L, 24]} /></mesh>
          <mesh material={metal} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[ballSize * 1.2, ballSize * 1.2, 0.7, 40]} />
          </mesh>
          {ball(metal, [0, L / 2, 0], ballSize)}
          {ball(metal, [0, -L / 2, 0], ballSize)}
        </group>
      )
    }

    case 'pincher': {
      // A thick tapered talon bent into a ~200° open arc.
      const arc = TWO_PI * 0.56
      const half = arc / 2
      const thick = Math.max(r * 1.8, 1.2)
      const ex = ringR * Math.cos(half), ey = ringR * Math.sin(half)
      return (
        <group>
          <mesh material={metal} rotation={[0, 0, -half]}>
            <torusGeometry args={[ringR, thick, 18, 90, arc]} />
          </mesh>
          <mesh material={metal} position={[ex, ey, 0]} rotation={[0, 0, half]}><coneGeometry args={[thick, thick * 2.4, 20]} /></mesh>
          <mesh material={metal} position={[ex, -ey, 0]} rotation={[Math.PI, 0, half]}><coneGeometry args={[thick, thick * 2.4, 20]} /></mesh>
        </group>
      )
    }
  }
}
