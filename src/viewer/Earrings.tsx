import type { DesignSpec } from '../spec/types'
import { stoneOnPiece } from '../spec/types'
import { alloyById } from '../catalog'
import { isHidden } from '../lib/features'
import { useDesign } from '../state/design'
import { stoneDims } from './Stone'
import { Head } from './Head'
import { useMetalMaterial } from './material'

/** One earring: stone facing the viewer on a post, optionally on a drop. */
function One({ spec, x, explode }: { spec: DesignSpec; x: number; explode: number }) {
  const alloy = alloyById(spec.metal.alloyId)
  const metal = useMetalMaterial(alloy, spec.finish)
  const headMetalMat = useMetalMaterial(alloyById(spec.metal.headAlloyId ?? spec.metal.alloyId), spec.finish)
  const headMetal = spec.metal.twoTone && spec.metal.headAlloyId ? headMetalMat : metal
  const { postGauge, postLength, dropLength } = spec.earring
  const dropY = dropLength > 0 ? dropLength : 0

  return (
    <group position={[x, 0, 0]}>
      {/* Drop link, if any, hangs the head below the ear line */}
      {dropY > 0 && (
        <mesh material={metal} position={[0, dropY / 2, 0]}>
          <cylinderGeometry args={[postGauge * 0.6, postGauge * 0.6, dropY, 8]} />
        </mesh>
      )}
      {stoneOnPiece(spec) && (
        <group position={[0, -dropY / 2, explode * 6]} rotation={[Math.PI / 2, 0, 0]}>
          <Head material={headMetal} shapeId={spec.center.shapeId} stoneTypeId={spec.center.stoneTypeId}
            carat={spec.center.carat} settingId={spec.setting.typeId} grading={spec.center.grading} seat={spec.center.seat ?? 0}
            showStone={!isHidden(spec, 'stone')} showSetting={!isHidden(spec, 'head')} />
        </group>
      )}
      {/* Post, behind the stone */}
      {!isHidden(spec, 'posts') && (
        <mesh material={metal} position={[0, -dropY / 2, -postLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[postGauge / 2, postGauge / 2, postLength, 8]} />
        </mesh>
      )}
    </group>
  )
}

export function Earrings({ spec }: { spec: DesignSpec }) {
  const explode = useDesign(s => s.explode)
  const d = stoneDims(spec.center.shapeId, spec.center.carat)
  const gap = d.width * 1.6 + 4 + explode * 6        // exploded: spread the pair apart
  return (
    <group position={[0, 2, 0]}>
      <One spec={spec} x={-gap} explode={explode} />
      {spec.earring.pair && <One spec={spec} x={gap} explode={explode} />}
    </group>
  )
}
