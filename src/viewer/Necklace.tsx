import { useMemo } from 'react'
import * as THREE from 'three'
import type { DesignSpec } from '../spec/types'
import { alloyById } from '../catalog'
import { isHidden } from '../lib/features'
import { stoneDims } from './Stone'
import { Head } from './Head'
import { Motif } from './Motif'
import { Stone } from './Stone'
import { useDesign } from '../state/design'
import { useMetalMaterial } from './material'
import { necklaceChainVertices } from '../lib/necklaceChain'

const MM_PER_INCH = 25.4

/** Necklace / chain hanging as a loop, optionally carrying a pendant. */
export function Necklace({ spec }: { spec: DesignSpec }) {
  const alloy = alloyById(spec.metal.alloyId)
  const metal = useMetalMaterial(alloy, spec.finish)
  const headMetalMat = useMetalMaterial(alloyById(spec.metal.headAlloyId ?? spec.metal.alloyId), spec.finish)
  const headMetal = spec.metal.twoTone && spec.metal.headAlloyId ? headMetalMat : metal
  const explode = useDesign(s => s.explode)
  const { length, gauge, hasPendant, chainStyle, motif, station } = spec.necklace
  const hasMotif = !!motif && motif !== 'none'
  const circ = length * MM_PER_INCH
  const R = circ / (Math.PI * 2)

  // Station stones spaced along the chain ("rubies every other inch").
  const stations = useMemo(() => {
    if (!station || station.everyIn <= 0 || station.carat <= 0) return []
    const count = Math.max(1, Math.min(120, Math.round(length / station.everyIn)))
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + Math.PI / 2 // start at the bottom of the drape
      return [Math.cos(a) * R, Math.sin(a) * R * 1.15, 0] as [number, number, number]
    })
  }, [station, length, R])
  const d = stoneDims(spec.center.shapeId, spec.center.carat)

  // Real interlocking chain around the neckline loop (regenerated on style/size).
  const chainGeo = useMemo(() => {
    const soup = necklaceChainVertices(R, Math.max(gauge * 0.5, 0.4), chainStyle ?? 'cable')
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(Float32Array.from(soup), 3))
    g.computeVertexNormals()
    return g
  }, [R, gauge, chainStyle])

  return (
    <group>
      {/* Chain loop, hanging in the view plane — vertical drape via a slight Y stretch */}
      {!isHidden(spec, 'chain') && (
        <mesh geometry={chainGeo} material={metal} scale={[1, 1.15, 1]} />
      )}

      {/* Station stones spaced around the chain (rubies-by-the-yard) */}
      {station && !isHidden(spec, 'stone') && stations.map((p, i) => (
        <group key={i} position={p}>
          <Stone shapeId={station.shapeId} stoneTypeId={station.stoneId} carat={station.carat} />
        </group>
      ))}

      {/* Decorative motif medallion hangs at the base of the loop, in place of a stone head */}
      {hasMotif && !isHidden(spec, 'head') && (
        <group position={[0, -R * 1.15 - Math.max(R * 0.16, 6) - explode * 14, 0]}>
          <Motif motif={motif!} material={headMetal} R={Math.max(R * 0.16, 6)} gauge={gauge} />
        </group>
      )}

      {!hasMotif && hasPendant && (
        <group position={[0, -R * 1.15 - d.r * d.lwRatio - explode * 14, 0]}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <Head material={headMetal} shapeId={spec.center.shapeId} stoneTypeId={spec.center.stoneTypeId}
              carat={spec.center.carat} settingId={spec.setting.typeId} grading={spec.center.grading} seat={spec.center.seat ?? 0}
              showStone={!isHidden(spec, 'stone')} showSetting={!isHidden(spec, 'head')} />
          </group>
        </group>
      )}
    </group>
  )
}
