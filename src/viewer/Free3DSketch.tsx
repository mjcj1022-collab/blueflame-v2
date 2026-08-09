import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Line, TransformControls } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useModeler } from '../state/modeler'

/** Reference floor grid: extent and line spacing, in mm. */
const PLANE_SIZE = 60
const GRID_STEP = 5

/**
 * True free-form 3D building — no starting template. Click the floor grid to
 * drop a vertex anywhere; click a placed vertex to select it and drag its
 * gizmo to reposition it in full 3D (any axis, not just the floor); right-click
 * a vertex to delete it. Points connect in click order into a wire preview;
 * Done sweeps a solid tube through them, building a real object from nothing.
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

  const groundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    add([Math.round(e.point.x * 10) / 10, 0, Math.round(e.point.z * 10) / 10])
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

  const linePoints = useMemo(() => {
    const pts = points.map(p => new THREE.Vector3(p[0], p[1], p[2]))
    if (closed && pts.length > 2) pts.push(pts[0].clone())
    return pts
  }, [points, closed])

  return (
    <>
      {/* Construction floor — click anywhere to drop the next vertex */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={groundClick}>
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
        <meshBasicMaterial color="#0E1113" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {gridLines.map((l, i) => <Line key={i} points={l} color="#242c2f" lineWidth={1} />)}

      {/* Live wire preview through the placed points */}
      {linePoints.length > 1 && <Line points={linePoints} color="#E7C989" lineWidth={2.5} />}

      {/* Placed vertices — click to select, right-click to delete */}
      {points.map((p, i) => (i === pick) ? null : (
        <mesh key={i} position={p} onClick={grab(i)} onContextMenu={del(i)} renderOrder={10}>
          <sphereGeometry args={[0.8, 14, 12]} />
          <meshBasicMaterial color={i === 0 ? '#7FC8FF' : '#C6A265'} toneMapped={false} depthTest={false} />
        </mesh>
      ))}

      {/* Selected vertex — drag the gizmo to move it anywhere in 3D */}
      {pick != null && points[pick] && (
        <TransformControls key={pickKey} mode="translate" size={0.7} onObjectChange={drag} onMouseUp={drag}>
          <mesh ref={handleRef} position={points[pick]} onContextMenu={del(pick)} renderOrder={11}>
            <sphereGeometry args={[0.9, 14, 12]} />
            <meshBasicMaterial color="#E7C989" toneMapped={false} depthTest={false} />
          </mesh>
        </TransformControls>
      )}
    </>
  )
}
