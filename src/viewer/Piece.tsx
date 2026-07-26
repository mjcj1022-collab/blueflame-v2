import type { DesignSpec } from '../spec/types'
import { Ring } from './Ring'
import { Pendant } from './Pendant'
import { Earrings } from './Earrings'
import { Bracelet } from './Bracelet'
import { Necklace } from './Necklace'
import { BodyJewelry } from './BodyJewelry'

const TWO_PI = Math.PI * 2

/**
 * Uniform display scale so every category frames nicely in the fixed camera.
 * Rings render at true mm; loops (bracelet, necklace) are metres-scale and get
 * shrunk so their radius lands near the target view size.
 */
export function displayScale(spec: DesignSpec): number {
  switch (spec.category) {
    case 'ring': return 1
    case 'pendant': return 1.7
    case 'earring': return 1.5
    case 'bracelet': {
      const R = (spec.bracelet.wristCircumference + spec.bracelet.fitAllowance) / TWO_PI
      return 11 / R
    }
    case 'necklace': {
      const R = (spec.necklace.length * 25.4) / TWO_PI
      return 12 / R
    }
    case 'body': {
      // Small mm-scale pieces; frame to a target extent regardless of style.
      const extent = Math.max(spec.body.size, spec.body.ballSize * 2, 6)
      return 14 / extent
    }
  }
}

/** Vertical framing target for the orbit camera, per category. */
export function viewTarget(spec: DesignSpec): [number, number, number] {
  switch (spec.category) {
    case 'ring': return [0, 4, 0]
    case 'pendant': return [0, 3, 0]
    case 'earring': return [0, 2, 0]
    default: return [0, 0, 0]
  }
}

export function Piece({ spec }: { spec: DesignSpec }) {
  const scale = displayScale(spec)
  return (
    <group scale={scale}>
      {spec.category === 'ring' && <Ring spec={spec} />}
      {spec.category === 'pendant' && <Pendant spec={spec} />}
      {spec.category === 'earring' && <Earrings spec={spec} />}
      {spec.category === 'bracelet' && <Bracelet spec={spec} />}
      {spec.category === 'necklace' && <Necklace spec={spec} />}
      {spec.category === 'body' && <BodyJewelry spec={spec} />}
    </group>
  )
}
