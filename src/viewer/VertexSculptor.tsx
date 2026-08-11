import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { sculptPull, addVertexInTriangle, removeVertexNear } from '../lib/sculpt'
import { circleSprite } from './circleSprite'
import type { VertexTool } from '../state/modeler'

export interface VertexSculptorProps {
  /** Flat triangle-soup positions (x,y,z,…) at identity transform. */
  vertices: number[]
  color: number
  falloff: number
  symmetry: boolean
  /** 'select' = click only highlights a vertex; 'edit' = grab + drag it. */
  tool: VertexTool
  /** Index of the currently highlighted vertex, or null. */
  selectedVertex: number | null
  /** Called with the nearest vertex when the surface is clicked. */
  onPick: (index: number, pos: [number, number, number]) => void
  /** Called once per drag on release, with the new positions. */
  onCommit: (vertices: number[]) => void
}

/**
 * Direct vertex sculpting for a flat triangle soup, shared by the Sculpt tab
 * (a baked SculptObject) and the Design tab (the parametric piece baked to a
 * mesh). The mesh renders at the scene root (identity), so world and local
 * coordinates coincide.
 *
 * Edit tool: **left-click a spot on the surface and drag** — the nearest vertex
 * follows the cursor across a camera-facing plane, and surrounding vertices come
 * with it under a smooth falloff (the "Region" radius). Orbit is suspended for
 * the duration of the drag and restored on release; the edit is pushed to the
 * store once per drag. Select tool: a click only highlights the nearest vertex,
 * leaving orbit live.
 */
export function VertexSculptor({ vertices, color, falloff, symmetry, tool, selectedVertex, onPick, onCommit }: VertexSculptorProps) {
  const controls = useThree(s => s.controls) as { enabled: boolean } | null

  // Live, mutable geometry — edits write straight into this buffer for instant
  // feedback; we only report to the store on release. Rebuilt when the stored
  // vertices change identity (a committed edit or undo/redo) — never mid-drag.
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(Float32Array.from(vertices), 3))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }, [vertices])
  useEffect(() => () => geom.dispose(), [geom])

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.25, envMapIntensity: 1.3 }),
    [color]
  )
  useEffect(() => () => material.dispose(), [material])

  const baseRef = useRef<Float32Array | null>(null)
  const centerRef = useRef(new THREE.Vector3())
  const planeRef = useRef(new THREE.Plane())
  const hitRef = useRef(new THREE.Vector3())
  const normalRef = useRef(new THREE.Vector3())
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  // The nearest vertex under the cursor, live — separate from the clicked
  // `selectedVertex` so a vertex can light up just by hovering it, before
  // it's picked.
  const [hoverVertex, setHoverVertex] = useState<number | null>(null)

  const endDrag = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    if (controls) controls.enabled = true
  }
  // If the tool switches or the component unmounts mid-drag, release orbit.
  useEffect(() => { if (tool === 'select') endDrag() /* eslint-disable-next-line */ }, [tool])
  useEffect(() => () => { if (controls) controls.enabled = true }, [controls])

  const nearest = (p: THREE.Vector3): number => {
    const pos = geom.getAttribute('position') as THREE.BufferAttribute
    let bi = 0, bd = Infinity
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - p.x, dy = pos.getY(i) - p.y, dz = pos.getZ(i) - p.z
      const d = dx * dx + dy * dy + dz * dz
      if (d < bd) { bd = d; bi = i }
    }
    return bi
  }

  const down = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return                       // left button only
    if (tool === 'add' || tool === 'remove' || tool === 'lasso') return  // add/remove: click/dblclick; lasso: own overlay
    e.stopPropagation()
    const pos = geom.getAttribute('position') as THREE.BufferAttribute
    const lp = e.eventObject.worldToLocal(e.point.clone())
    const bi = nearest(lp)
    const c = new THREE.Vector3(pos.getX(bi), pos.getY(bi), pos.getZ(bi))
    onPick(bi, [c.x, c.y, c.z])
    if (tool !== 'edit') return                      // Select tool: highlight only

    baseRef.current = (pos.array as Float32Array).slice()
    centerRef.current.copy(c)
    // Drag on a plane through the vertex that faces the camera, so the vertex
    // tracks the cursor in screen space.
    e.camera.getWorldDirection(normalRef.current)
    planeRef.current.setFromNormalAndCoplanarPoint(normalRef.current, e.point)
    draggingRef.current = true
    setDragging(true)
    if (controls) controls.enabled = false
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) {
      // Not dragging — just track which vertex the cursor is nearest to, so
      // it can highlight on hover before it's actually picked. Only for the
      // tools where picking a single vertex matters.
      if (tool === 'select' || tool === 'edit') {
        const lp = e.eventObject.worldToLocal(e.point.clone())
        setHoverVertex(nearest(lp))
      }
      return
    }
    const base = baseRef.current
    if (!base) return
    e.stopPropagation()
    const hit = e.ray.intersectPlane(planeRef.current, hitRef.current)
    if (!hit) return
    const c = centerRef.current
    const pos = geom.getAttribute('position') as THREE.BufferAttribute
    sculptPull(base, [c.x, c.y, c.z], [hit.x - c.x, hit.y - c.y, hit.z - c.z], falloff, symmetry, pos.array as Float32Array)
    pos.needsUpdate = true
    geom.computeVertexNormals()
  }

  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return
    e.stopPropagation()
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    endDrag()
    const pos = geom.getAttribute('position') as THREE.BufferAttribute
    onCommit(Array.from(pos.array as Float32Array))
  }

  // Add tool: a single click splits the clicked triangle, adding a vertex.
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (tool !== 'add' || e.faceIndex == null) return
    e.stopPropagation()
    const lp = e.eventObject.worldToLocal(e.point.clone())
    onCommit(addVertexInTriangle(vertices, e.faceIndex, [lp.x, lp.y, lp.z]))
  }

  // Remove tool: a double click deletes the vertex nearest the cursor.
  const dbl = (e: ThreeEvent<MouseEvent>) => {
    if (tool !== 'remove') return
    e.stopPropagation()
    const lp = e.eventObject.worldToLocal(e.point.clone())
    onCommit(removeVertexNear(vertices, [lp.x, lp.y, lp.z]))
  }

  // The highlighted vertex, in the mesh's current (possibly mid-edit) space.
  const marker = useMemo(() => {
    if (selectedVertex == null) return null
    const pos = geom.getAttribute('position') as THREE.BufferAttribute
    if (selectedVertex >= pos.count) return null
    return new THREE.Vector3(pos.getX(selectedVertex), pos.getY(selectedVertex), pos.getZ(selectedVertex))
  }, [geom, selectedVertex])

  // Show the actual vertices as dots so grab points are visible; skipped on
  // dense meshes. The overlay never raycasts, so drags still hit the surface
  // (hover/pick both come from the surface mesh's own pointer events).
  const showPoints = geom.getAttribute('position').count <= 20000
  const dotSize = tool === 'select' ? 0.5 : 0.38
  const sprite = circleSprite()

  // The hovered vertex, in the mesh's current (possibly mid-edit) space —
  // same lookup as the selected-vertex marker below.
  const hoverMarker = useMemo(() => {
    if (hoverVertex == null || hoverVertex === selectedVertex) return null
    const pos = geom.getAttribute('position') as THREE.BufferAttribute
    if (hoverVertex >= pos.count) return null
    return new THREE.Vector3(pos.getX(hoverVertex), pos.getY(hoverVertex), pos.getZ(hoverVertex))
  }, [geom, hoverVertex, selectedVertex])

  return (
    <>
      <mesh
        geometry={geom}
        material={material}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerOut={() => setHoverVertex(null)}
        onClick={click}
        onDoubleClick={dbl}
        castShadow
      >
        <Edges scale={1.002} threshold={20} color="#3d454a" />
      </mesh>
      {showPoints && (
        <points geometry={geom} raycast={() => null}>
          <pointsMaterial
            size={dotSize}
            sizeAttenuation
            map={sprite}
            alphaTest={0.5}
            transparent
            color="#9BB4C6"
            opacity={tool === 'select' ? 0.85 : 0.7}
          />
        </points>
      )}

      {/* Hover feedback — lights up the nearest vertex to the cursor before
          it's clicked. Hidden once that same vertex becomes the real pick,
          and mid-drag since the surface itself is the live feedback. */}
      {hoverMarker && !dragging && (
        <mesh position={hoverMarker} raycast={() => null}>
          <sphereGeometry args={[0.32, 16, 12]} />
          <meshBasicMaterial color="#EAF4FF" toneMapped={false} transparent opacity={0.55} depthTest={false} />
        </mesh>
      )}

      {/* Highlight the picked vertex; hidden mid-drag since the surface itself
          is the live feedback. */}
      {marker && !dragging && (
        <mesh position={marker} raycast={() => null}>
          <sphereGeometry args={[0.3, 18, 14]} />
          <meshBasicMaterial color={tool === 'select' ? '#7FC8FF' : '#C6A265'} toneMapped={false} transparent opacity={0.7} depthTest={false} />
        </mesh>
      )}
    </>
  )
}
