import { useMemo } from 'react'
import * as THREE from 'three'
import { settingById, type Grading } from '../catalog'
import { Stone, stoneDims } from './Stone'

/**
 * A set stone in its head — prongs or bezel plus a gallery rail — centred on the
 * stone. Consumers position the whole group. Shared by rings, pendants,
 * earrings and tennis links so the setting is modelled once.
 */
export function Head({ material, shapeId, stoneTypeId, carat, settingId, grading, seat = 0, showStone = true, showSetting = true }: {
  material: THREE.Material
  shapeId: string
  stoneTypeId: string
  carat: number
  settingId: string
  grading?: Grading
  seat?: number   // mm the stone is raised (+) / set deeper (−) within the mount
  showStone?: boolean
  showSetting?: boolean
}) {
  const setting = settingById(settingId)
  const d = stoneDims(shapeId, carat)
  const prongR = 0.42 + d.width * 0.012

  const prongs = useMemo(() => {
    if (setting.bezel) return []
    const out: { pos: [number, number, number]; rot: [number, number, number]; h: number }[] = []
    const h = d.pavH * 0.75 + d.crownH * 1.1
    for (let i = 0; i < setting.prongs; i++) {
      const a = (i / setting.prongs) * Math.PI * 2 + Math.PI / setting.prongs
      out.push({
        pos: [Math.cos(a) * d.r * 0.99, -d.pavH * 0.2 + (h / 2) * 0.15, Math.sin(a) * d.r * 0.99 * d.lwRatio],
        rot: [Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1],
        h
      })
    }
    return out
  }, [setting, d])

  return (
    <group>
      {showStone && (
        <group position={[0, seat, 0]}>
          <Stone shapeId={shapeId} stoneTypeId={stoneTypeId} carat={carat} grading={grading} />
        </group>
      )}

      {showSetting && (
      <>
      {/* Gallery rail */}
      <mesh material={material} rotation={[Math.PI / 2, 0, 0]} position={[0, -d.pavH * 0.55, 0]} scale={[1, 1, d.lwRatio]}>
        <torusGeometry args={[d.r * 0.8, prongR * 0.85, 10, 44]} />
      </mesh>

      {setting.bezel ? (
        <mesh material={material} position={[0, d.crownH * 0.25, 0]} scale={[1, 1, d.lwRatio]}>
          <cylinderGeometry args={[d.r * 1.13, d.r * 1.06, d.girdleH + d.crownH * 1.2, 48, 1, true]} />
        </mesh>
      ) : (
        prongs.map((p, i) => (
          <group key={i}>
            <mesh material={material} position={p.pos} rotation={p.rot}>
              <cylinderGeometry args={[prongR * 0.85, prongR, p.h, 10]} />
            </mesh>
            <mesh material={material} position={[p.pos[0] * 0.94, d.crownH * 0.85, p.pos[2] * 0.94]}>
              <sphereGeometry args={[prongR * 0.9, 12, 10]} />
            </mesh>
          </group>
        ))
      )}
      </>
      )}
    </group>
  )
}
