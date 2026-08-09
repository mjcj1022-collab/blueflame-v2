import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Html, Line } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useModeler } from '../state/modeler'

/** Reference box: extent and grid-line spacing, in mm. */
const PLANE_SIZE = 60
const GRID_STEP = 5
/** How close (mm) a dragged vertex must get to another before it snaps onto it. */
const SNAP_MM = 1.2

/**
 * True free-form 3D building — no starting template. A wireframe box frames
 * the working volume; its floor and back wall are clickable to drop a vertex
 * (floor for ground level, wall for picking a height directly). But nothing
 * is stuck to those two surfaces — press and drag any placed vertex directly
 * and it follows the cursor on a plane facing the camera, so orbiting the
 * view and dragging again reaches literally any point inside (or outside)
 * the box, not just axis-aligned gizmo moves. Dragging near another vertex
 * snaps onto it (handy for closing a loop or lining two points up exactly).
 * Right-click a vertex to delete it. Points connect in click order into a
 * wire preview, each segment labeled with its length in mm as you build;
 * Done sweeps a solid tube through them, building a real object from nothing.
 */
export function Free3DSketch() {
  const points = useModeler(s => s.sketch3DPoints)
  const closed = useModeler(s => s.sketch3DClosed)
  const add = useModeler(s => s.add3DPoint)
  const move = useModeler(s => s.move3DPoint)
  const removePt = useModeler(s => s.remove3DPoint)

  const controls = useThree(s => s.controls) as { enabled: boolean } | null

  const [pick, setPick] = useState<number | null>(null)
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const planeRef = useRef(new THREE.Plane())
  const hitRef = useRef(new THREE.Vector3())
  const normalRef = useRef(new THREE.Vector3())

  // Full box outline so the working volume reads as an enclosing box, not just
  // a floor and a wall.
  const boxEdges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(PLANE_SIZE, PLANE_SIZE, PLANE_SIZE)),
    []
  )
  useEffect(() => () => boxEdges.dispose(), [boxEdges])

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
  // so the two grids read as one corner of the box rather than two disconnected planes.
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
    if (draggingRef.current) return
    e.stopPropagation()
    add([Math.round(e.point.x * 10) / 10, 0, Math.round(e.point.z * 10) / 10])
  }
  const wallClick = (e: ThreeEvent<MouseEvent>) => {
    if (draggingRef.current) return
    e.stopPropagation()
    add([Math.round(e.point.x * 10) / 10, Math.round(e.point.y * 10) / 10, WALL_Z])
  }

  // Press a placed vertex and drag — it follows the cursor across a plane
  // facing the camera, the same free-drag feel as the mesh sculpting tool.
  // Orbit is suspended for the duration so the drag doesn't fight the camera.
  const startDrag = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setPick(i)
    const p = points[i]
    const worldP = new THREE.Vector3(p[0], p[1], p[2])
    e.camera.getWorldDirection(normalRef.current)
    planeRef.current.setFromNormalAndCoplanarPoint(normalRef.current, worldP)
    draggingRef.current = true
    setDragging(true)
    if (controls) controls.enabled = false
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onDragMove = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current || pick !== i) return
    e.stopPropagation()
    const hit = e.ray.intersectPlane(planeRef.current, hitRef.current)
    if (!hit) return
    let x = Math.round(hit.x * 10) / 10, y = Math.round(hit.y * 10) / 10, z = Math.round(hit.z * 10) / 10
    // Snap onto the nearest other vertex once the drag gets close to it.
    let bestD = SNAP_MM
    for (let j = 0; j < points.length; j++) {
      if (j === i) continue
      const [ox, oy, oz] = points[j]
      const d = Math.hypot(x - ox, y - oy, z - oz)
      if (d < bestD) { bestD = d; x = ox; y = oy; z = oz }
    }
    move(i, [x, y, z])
  }
  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return
    e.stopPropagation()
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    draggingRef.current = false
    setDragging(false)
    if (controls) controls.enabled = true
  }
  const del = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    removePt(i)
    if (pick === i) setPick(null)
    else if (pick != null && pick > i) setPick(p => (p == null ? p : p - 1))
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

  // A length label at the midpoint of every segment as it's created — updates
  // live while dragging so you can watch a dimension change as you adjust it.
  const segments = useMemo(() => {
    const segs: { mid: THREE.Vector3; mm: number }[] = []
    const seg = (a: [number, number, number], b: [number, number, number]) => {
      const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b)
      segs.push({ mid: av.clone().lerp(bv, 0.5), mm: av.distanceTo(bv) })
    }
    for (let i = 0; i < points.length - 1; i++) seg(points[i], points[i + 1])
    if (closed && points.length > 2) seg(points[points.length - 1], points[0])
    return segs
  }, [points, closed])

  return (
    <>
      {/* The box itself — pure framing, not clickable */}
      <lineSegments geometry={boxEdges} position={[0, PLANE_SIZE / 2, 0]} raycast={() => null}>
        <lineBasicMaterial color="#3a3448" transparent opacity={0.35} />
      </lineSegments>

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

      {/* A length readout on every segment, live while dragging */}
      {segments.map((s, i) => (
        <Html key={i} position={s.mid} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            whiteSpace: 'nowrap', font: '700 11px ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
            padding: '2px 7px', borderRadius: 4, color: '#0C1114', background: '#E7C989',
            boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
          }}>{s.mm.toFixed(2)} mm</div>
        </Html>
      ))}

      {/* Placed vertices — press and drag to move anywhere in 3D, right-click
          to delete. Small and see-through so they mark a spot without hiding
          the object forming underneath. */}
      {points.map((p, i) => {
        const active = i === pick && dragging
        return (
          <mesh
            key={i}
            position={p}
            onPointerDown={startDrag(i)}
            onPointerMove={onDragMove(i)}
            onPointerUp={endDrag}
            onContextMenu={del(i)}
            renderOrder={10}
          >
            <sphereGeometry args={[active ? 0.6 : 0.5, 14, 12]} />
            <meshBasicMaterial
              color={active ? '#E7C989' : i === 0 ? '#7FC8FF' : '#C6A265'}
              toneMapped={false}
              depthTest={false}
              transparent
              opacity={active ? 0.75 : 0.55}
            />
          </mesh>
        )
      })}
    </>
  )
}
