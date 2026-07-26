import type { DesignSpec } from '../spec/types'
import { alloyById, shapeById, stoneMm } from '../catalog'
import { isHidden } from '../lib/features'
import { stoneDims } from './Stone'
import { Head } from './Head'
import { useMetalMaterial } from './material'

const TWO_PI = Math.PI * 2

/** Bracelet / bangle / cuff / tennis, rendered as a loop worn around the wrist. */
export function Bracelet({ spec }: { spec: DesignSpec }) {
  const alloy = alloyById(spec.metal.alloyId)
  const metal = useMetalMaterial(alloy, spec.finish)
  const { kind, wristCircumference, fitAllowance, width, thickness, linkCount } = spec.bracelet
  const length = wristCircumference + fitAllowance
  const R = length / TWO_PI
  const tube = Math.max(thickness, width * 0.5) / 2

  // Tennis: small set stones around the top of the loop, per-stone carat.
  const shownStones = Math.min(linkCount, 30)
  const perStone = spec.center.carat / Math.max(linkCount, 1)
  const d = stoneDims(spec.center.shapeId, Math.max(perStone, 0.02))
  const shape = shapeById(spec.center.shapeId)
  const sW = stoneMm(shape, Math.max(perStone, 0.02)).width

  if (kind === 'tennis') {
    return (
      <group>
        {!isHidden(spec, 'band') && (
          <mesh material={metal} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[R, Math.max(sW * 0.35, 0.8), 16, 160]} />
          </mesh>
        )}
        {Array.from({ length: shownStones }).map((_, i) => {
          const a = (i / shownStones) * TWO_PI
          return (
            <group key={i} position={[Math.cos(a) * R, tube + d.pavH * 0.5, Math.sin(a) * R]}
              scale={0.9}>
              <Head material={metal} shapeId={spec.center.shapeId} stoneTypeId={spec.center.stoneTypeId}
                carat={Math.max(perStone, 0.02)} settingId={spec.setting.typeId} seat={spec.center.seat ?? 0}
                showStone={!isHidden(spec, 'stone')} showSetting={!isHidden(spec, 'head')} />
            </group>
          )
        })}
      </group>
    )
  }

  if (isHidden(spec, 'band')) return <group />

  if (kind === 'chain') {
    return (
      <mesh material={metal} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R, Math.max(thickness * 0.5, 0.7), 14, 160]} />
      </mesh>
    )
  }

  // bangle (full) or cuff (open gap toward the viewer)
  const theta = kind === 'cuff' ? TWO_PI * 0.78 : TWO_PI
  const scaleY = Math.max(width / Math.max(thickness, 0.1), 1)
  return (
    <group scale={[1, scaleY, 1]}>
      <mesh material={metal} rotation={[Math.PI / 2, kind === 'cuff' ? Math.PI * 0.61 : 0, 0]}>
        <torusGeometry args={[R, tube, 20, 180, theta]} />
      </mesh>
    </group>
  )
}
