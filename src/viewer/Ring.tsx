import { useMemo } from 'react'
import type { DesignSpec } from '../spec/types'
import { stoneOnPiece, NO_STONE } from '../spec/types'
import { useDesign } from '../state/design'
import { alloyById, settingById } from '../catalog'
import { sizeToDiameter } from '../lib/sizing'
import { shankGeometry } from '../lib/sculpt'
import { isHidden } from '../lib/features'
import { stoneDims } from './Stone'
import { Head } from './Head'
import { HaloRing } from './HaloRing'
import { EternityBand } from './EternityBand'
import { EngravingText } from './EngravingText'
import { useMetalMaterial } from './material'

export function Ring({ spec }: { spec: DesignSpec }) {
  const alloy = alloyById(spec.metal.alloyId)
  const metal = useMetalMaterial(alloy, spec.finish)
  const headMetalMat = useMetalMaterial(alloyById(spec.metal.headAlloyId ?? spec.metal.alloyId), spec.finish)
  const headMetal = spec.metal.twoTone && spec.metal.headAlloyId ? headMetalMat : metal
  const d = stoneDims(spec.center.shapeId, spec.center.carat)
  const { size, width, thickness, profile } = spec.ring

  const insideR = sizeToDiameter(size) / 2
  const tube = thickness / 2
  const centreR = insideR + tube
  const seatY = centreR + tube * 0.2
  const stoneY = seatY + d.pavH * 0.55

  // Round keeps the proven torus; other profiles use a real swept band.
  const bandGeo = useMemo(
    () => (profile && profile !== 'round' ? shankGeometry({ ringSize: size, profile, width, thickness }) : null),
    [profile, size, width, thickness]
  )

  const setting = settingById(spec.setting.typeId)
  const halo = stoneOnPiece(spec) && (setting.id === 'hal' || setting.id === 'hl2') && (setting.melee ?? 0) > 0
  const eternity = (setting.allAround ?? false) && (setting.melee ?? 0) > 0 && !isHidden(spec, 'halo')
  const explode = useDesign(s => s.explode)
  const tryOn = useDesign(s => s.tryOn)
  const skin = useDesign(s => s.skinTone)

  return (
    <group>
      {tryOn && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <cylinderGeometry args={[insideR * 0.92, insideR * 0.84, 70, 28]} />
          <meshStandardMaterial color={skin} roughness={0.75} metalness={0} />
        </mesh>
      )}

      {!isHidden(spec, 'band') && (bandGeo
        ? <mesh material={metal} geometry={bandGeo} />
        : <mesh material={metal} scale={[1, 1, width / thickness]}><torusGeometry args={[centreR, tube, 24, 180]} /></mesh>)}

      {!isHidden(spec, 'engraving') && spec.engraving.text.trim() && <EngravingText spec={spec} />}

      {eternity && (
        <EternityBand
          material={headMetal}
          centreR={centreR}
          tube={tube}
          count={spec.setting.melee?.count ?? setting.melee ?? 22}
          accentCt={spec.setting.melee?.caratEach ?? setting.accentCt ?? 0.05}
          stoneTypeId={spec.setting.melee?.stoneId ?? (spec.center.stoneTypeId === NO_STONE ? 'dia' : spec.center.stoneTypeId)}
        />
      )}

      {stoneOnPiece(spec) && (
        <group position={[0, stoneY + explode * 7, 0]}>
          <Head material={headMetal} shapeId={spec.center.shapeId} stoneTypeId={spec.center.stoneTypeId}
            carat={spec.center.carat} settingId={spec.setting.typeId} grading={spec.center.grading} seat={spec.center.seat ?? 0}
            showStone={!isHidden(spec, 'stone')} showSetting={!isHidden(spec, 'head')} />
          {halo && !isHidden(spec, 'halo') && (
            <HaloRing
              material={headMetal}
              centerStoneWidth={d.width}
              count={spec.setting.melee?.count ?? setting.melee ?? 16}
              accentCt={spec.setting.melee?.caratEach ?? setting.accentCt ?? 0.01}
              stoneTypeId={spec.setting.melee?.stoneId ?? spec.center.stoneTypeId}
              double={setting.id === 'hl2'}
            />
          )}
        </group>
      )}
    </group>
  )
}
