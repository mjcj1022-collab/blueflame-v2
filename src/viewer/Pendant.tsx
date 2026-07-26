import type { DesignSpec } from '../spec/types'
import { stoneOnPiece } from '../spec/types'
import { alloyById } from '../catalog'
import { isHidden } from '../lib/features'
import { useDesign } from '../state/design'
import { stoneDims } from './Stone'
import { Head } from './Head'
import { useMetalMaterial } from './material'

/** A set stone facing the viewer, hung from a bail, with a short chain hint. */
export function Pendant({ spec }: { spec: DesignSpec }) {
  const alloy = alloyById(spec.metal.alloyId)
  const metal = useMetalMaterial(alloy, spec.finish)
  const headMetalMat = useMetalMaterial(alloyById(spec.metal.headAlloyId ?? spec.metal.alloyId), spec.finish)
  const headMetal = spec.metal.twoTone && spec.metal.headAlloyId ? headMetalMat : metal
  const explode = useDesign(s => s.explode)
  const d = stoneDims(spec.center.shapeId, spec.center.carat)
  const { bailInner, bailGauge, hasChain } = spec.pendant

  // Stone rotated so its table faces the camera; its length axis now runs in Y.
  const halfH = d.r * d.lwRatio
  const bailY = halfH + bailGauge + bailInner / 2
  const topY = bailY + bailInner / 2 + bailGauge

  return (
    <group position={[0, 2, 0]}>
      {stoneOnPiece(spec) && (
        <group position={[0, -explode * 6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <Head material={headMetal} shapeId={spec.center.shapeId} stoneTypeId={spec.center.stoneTypeId}
            carat={spec.center.carat} settingId={spec.setting.typeId} grading={spec.center.grading}
            showStone={!isHidden(spec, 'stone')} showSetting={!isHidden(spec, 'head')} />
        </group>
      )}

      {/* Bail */}
      {!isHidden(spec, 'bail') && (
        <mesh material={metal} position={[0, bailY, 0]}>
          <torusGeometry args={[bailInner / 2 + bailGauge / 2, bailGauge / 2, 12, 32]} />
        </mesh>
      )}

      {hasChain && !isHidden(spec, 'chain') && [-1, 1].map(s => (
        <mesh key={s} material={metal} position={[s * topY * 0.5, topY + halfH * 0.6, 0]} rotation={[0, 0, s * 0.5]}>
          <cylinderGeometry args={[bailGauge * 0.35, bailGauge * 0.35, halfH * 1.8, 8]} />
        </mesh>
      ))}
    </group>
  )
}
