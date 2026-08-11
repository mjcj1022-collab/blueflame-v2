import { useMemo } from 'react'
import * as THREE from 'three'
import { shapeById, stoneById, stoneMm, isGradeable, colorTint, clarityOptics, type Grading } from '../catalog'
import { brilliantGeometry } from '../lib/gem'
import { useDesign } from '../state/design'

interface Props { shapeId: string; stoneTypeId: string; carat: number; grading?: Grading }

/**
 * A faceted cut stone. Girdle diameter drives the proportions; the shape's
 * facet count sets the outline and elongated shapes scale along Z by the
 * length-to-width ratio. Flat-shaded facets sparkle against the transmissive
 * material. When the stone is gradeable, colour grade warms the tint and
 * clarity grade hazes it.
 */
export function Stone({ shapeId, stoneTypeId, carat, grading }: Props) {
  const shape = shapeById(shapeId)
  const stone = stoneById(stoneTypeId)
  const { width } = stoneMm(shape, carat)

  const geometry = useMemo(() => brilliantGeometry(width, shape.segments), [width, shape.segments])

  const override = useDesign(s => s.colorwork.stone)   // custom colour from the Color studio
  const gemOpacity = useDesign(s => s.gemOpacity)       // global "how see-through" slider
  const graded = grading && isGradeable(stoneTypeId)
  const material = useMemo(() => {
    const optics = graded ? clarityOptics(grading!.clarity) : null
    const color = override ?? (graded ? colorTint(grading!.color) : stone.color)
    return new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: optics ? optics.roughness : 0.02,
      transmission: (optics ? optics.transmission : (stone.transparent ? 0.94 : 0.3)) * gemOpacity,
      thickness: width * 0.5,
      ior: stone.ior,
      envMapIntensity: 2.8,
      clearcoat: 1,
      clearcoatRoughness: 0,
      flatShading: true,
      transparent: true,
      opacity: (stone.transparent ? 1 : 0.97) * gemOpacity
    })
  }, [stone, width, graded, grading, override, gemOpacity])

  return (
    <group scale={[1, 1, shape.lwRatio]}>
      <mesh geometry={geometry} material={material} />
    </group>
  )
}

export function stoneDims(shapeId: string, carat: number) {
  const shape = shapeById(shapeId)
  const { width } = stoneMm(shape, carat)
  return { width, r: width / 2, crownH: width * 0.16, pavH: width * 0.43, girdleH: width * 0.03, lwRatio: shape.lwRatio }
}
