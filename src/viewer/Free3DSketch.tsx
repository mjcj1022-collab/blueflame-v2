import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Line, TransformControls } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useModeler } from '../state/modeler'

/** Reference floor grid: extent and line spacing, in mm. */
const PLANE_SIZE = 60
const GRID_STEP = 5

/**
 * True free-form 3D building — no starting template. Two reference grids meet
 * at a shared back-bottom edge, like an open box corner: the floor (flat,
 * height 0) and a vertical wall standing up behind it. Click either one to
 * drop a vertex — the floor for anything at ground level, the wall for
 * picking a height directly instead of placing-then-dragging. Click a placed
 * vertex to select it and drag its gizmo to reposition it in full 3D (any
 * axis, not just the grid it started on); right-click a vertex to delete it.
 * Points connect in click order into a wire preview; Done sweeps a solid tube
 * through them, building a real object from nothing.
 */
export function Free3DSketch() {
  const points = useModeler(s => s.sketch3DPoints)
  const closed = useModeler(s => s.sketch3DClosed)
  const add = useModeler(s => s.add3DPoint)
  const move = useModeler(s => s.move3DPoint)
  const removePt = useModeler(s => s.remove3DPoint)

  const [pick, setPick] = useState<number | null>(null)
  const [pickKey, setPickKey] = useState(0)
  const handleRef = useRef<THREE.Mesh>(null)

  const gridLines = useMemo(() => {
    const n = Math.round(PLANE_SIZE / GRID_STEP)
    const lines: [THREE.Vector3, THREE.Vector3][] = []
    for (let i = 0; i <= n; i++) {
      const p = -PLANE_SIZE / 2 + i * GRID_STEP
      lines.push([new THREE.Vector3(p, 0, -PLANE_SIZE / 2), new THREE.Vector3(p, 0, PLANE_SIZE / 2)])
      lines.push([new THREE.Vector3(-PLANE_SIZE / 2, 0, p), new THREE.Vector3(PLANE_SIZE / 2, 0, p)])
    }
    return lines
  }, [])

  // The wall stands upright behind the floor, sharing its back edge (z = -PLANE_SIZE/2)
  // so the two grids read as one open corner instead of two disconnected planes.
  const WALL_Z = -PLANE_SIZE / 2
  const wallGridLines = useMemo(() => {
    const n = Math.round(PLANE_SIZE / GRID_STEP)
    const lines: [THREE.Vector3, THREE.Vector3][] = []
    for (let i = 0; i <= n; i++) {
      const x = -PLANE_SIZE / 2 + i * GRID_STEP
      lines.push([new THREE.Vector3(x, 0, WALL_Z), new THREE.Vector3(x, PLANE_SIZE, WALL_Z)])
      const y = i * GRID_STEP
      lines.push([new THREE.Vector3(-PLANE_SIZE / 2, y, WALL_Z), new THREE.Vector3(PLANE_SIZE / 2, y, WALL_Z)])
    }
    return lines
  }, [])

  const groundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    add([Math.round(e.point.x * 10) / 10, 0, Math.round(e.point.z * 10) / 10])
  }
  const wallClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    add([Math.round(e.point.x * 10) / 10, Math.round(e.point.y * 10) / 10, WALL_Z])
  }
  const grab = (i: number) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setPick(i); setPickKey(k => k + 1) }
  const del = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    removePt(i)
    if (pick === i) setPick(null)
    else if (pick != null && pick > i) setPick(p => (p == null ? p : p - 1))
  }
  const drag = () => {
    if (pick == null || !handleRef.current) return
    const p = handleRef.current.position
    move(pick, [p.x, p.y, p.z])
  }

  // Delete/Backspace removes the currently selected vertex.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pick == null) return
      const t = e.target as HTMLElement
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removePt(pick); setPick(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pick, removePt])

  const linePoints = useMemo(() => {
    const pts = points.map(p => new THREE.Vector3(p[0], p[1], p[2]))
    if (closed && pts.length > 2) pts.push(pts[0].clone())
    return pts
  }, [points, closed])

  return (
    <>
      {/* Construction floor — click anywhere to drop the next vertex at height 0 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={groundClick}>
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
        <meshBasicMaterial color="#0E1113" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {gridLines.map((l, i) => <Line key={'g' + i} points={l} color="#242c2f" lineWidth={1} />)}

      {/* Vertical wall, standing on the floor's back edge — click to drop a
          vertex at any height directly, instead of placing on the floor and
          dragging it up. */}
      <mesh position={[0, PLANE_SIZE / 2, WALL_Z]} onClick={wallClick}>
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
        <meshBasicMaterial color="#140F1B" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {wallGridLines.map((l, i) => <Line key={'w' + i} points={l} color="#2A2438" lineWidth={1} />)}

      {/* Live wire preview through the placed points */}
      {linePoints.length > 1 && <Line points={linePoints} color="#E7C989" lineWidth={2.5} />}

      {/* Placed vertices — click to select, right-click to delete. Small and
          see-through so they mark a spot without hiding the object forming
          underneath. */}
      {points.map((p, i) => (i === pick) ? null : (
        <mesh key={i} position={p} onClick={grab(i)} onContextMenu={del(i)} renderOrder={10}>
          <sphereGeometry args={[0.5, 14, 12]} />
          <meshBasicMaterial color={i === 0 ? '#7FC8FF' : '#C6A265'} toneMapped={false} depthTest={false} transparent opacity={0.55} />
        </mesh>
      ))}

      {/* Selected vertex — drag the gizmo to move it anywhere in 3D */}
      {pick != null && points[pick] && (
        <TransformControls key={pickKey} mode="translate" size={0.7} onObjectChange={drag} onMouseUp={drag}>
          <mesh ref={handleRef} position={points[pick]} onContextMenu={del(pick)} renderOrder={11}>
            <sphereGeometry args={[0.55, 14, 12]} />
            <meshBasicMaterial color="#E7C989" toneMapped={false} depthTest={false} transparent opacity={0.6} />
          </mesh>
        </TransformControls>
      )}
    </>
  )
}
