import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Html, Line } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useModeler } from '../state/modeler'
import { free3DSegCurve, buildLoopFillVertices, type Seg3DStyle } from '../lib/sculpt'

const DEFAULT_SEG: Seg3DStyle = { curved: false, thickness: 1.2, depth: 1.2 }

/** Reference box: extent and grid-line spacing, in mm. */
const PLANE_SIZE = 60
const GRID_STEP = 5
/** How close (on screen, in pixels) a dragged vertex's cursor must get to
 *  another vertex before it snaps onto it. Screen-space rather than a raw mm
 *  distance so the target feels the same size whether the view is zoomed in
 *  tight or pulled back to see the whole piece — a fixed mm threshold shrinks
 *  to almost nothing once you're zoomed out, which made closing a loop feel
 *  fiddly. */
const SNAP_PX = 26
const tmpNdcA = new THREE.Vector3()
const tmpNdcB = new THREE.Vector3()

/**
 * True free-form 3D building — no starting template. A wireframe box frames
 * the working volume; double-click its floor or back wall to drop a vertex
 * (floor for ground level, wall for picking a height directly) — a single
 * click is left free for orbiting the view without accidentally placing a
 * point. But nothing
 * is stuck to those two surfaces — press and drag any placed vertex directly
 * and it follows the cursor on a plane facing the camera, so orbiting the
 * view and dragging again reaches literally any point inside (or outside)
 * the box, not just axis-aligned gizmo moves. Dragging near another vertex
 * snaps onto it (handy for lining two points up exactly) — and snapping the
 * last point back onto the first automatically closes the loop and fills its
 * interior with a solid panel, so the shape is built the moment the outline
 * meets itself. Right-click a vertex to delete it. Points connect in click
 * order into a wire preview, each segment labeled with its length in mm as
 * you build. Click a segment to select it: toggle it between a hard straight
 * line and a smoothed curve, and dial in its own thickness (width) and depth
 * (height) — an elliptical cross-section, so one stretch can read as a flat
 * band and the next as a round wire. Done sweeps the styled path (and any
 * fill) into a solid.
 */
export function Free3DSketch() {
  const points = useModeler(s => s.sketch3DPoints)
  const closed = useModeler(s => s.sketch3DClosed)
  const fill = useModeler(s => s.sketch3DFill)
  const wire = useModeler(s => s.sketch3DWire)
  const segs = useModeler(s => s.sketch3DSegs)
  const add = useModeler(s => s.add3DPoint)
  const move = useModeler(s => s.move3DPoint)
  const removePt = useModeler(s => s.remove3DPoint)
  const setClosed = useModeler(s => s.set3DClosed)
  const setSegCurved = useModeler(s => s.setSeg3DCurved)
  const setSegThickness = useModeler(s => s.setSeg3DThickness)
  const setSegDepth = useModeler(s => s.setSeg3DDepth)

  const controls = useThree(s => s.controls) as { enabled: boolean } | null
  const size = useThree(s => s.size)

  const [pick, setPick] = useState<number | null>(null)
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const planeRef = useRef(new THREE.Plane())
  const hitRef = useRef(new THREE.Vector3())
  const normalRef = useRef(new THREE.Vector3())
  const [selSeg, setSelSeg] = useState<number | null>(null)
  // Which other vertex the point being dragged is currently close enough to
  // snap onto — highlighted live so the snap target is obvious before you
  // let go, not just discovered after the fact.
  const [snapTarget, setSnapTarget] = useState<number | null>(null)

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

  // Double-click to place — a single click is reserved for orbiting/selecting
  // so a normal drag-to-orbit gesture (which fires a click on release) can't
  // accidentally drop a vertex.
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
    const rawX = Math.round(hit.x * 10) / 10, rawY = Math.round(hit.y * 10) / 10, rawZ = Math.round(hit.z * 10) / 10
    let x = rawX, y = rawY, z = rawZ
    // Snap onto the nearest other vertex once the cursor gets close to it on
    // screen — compared in the same raw hit position for every candidate so
    // the nearest one wins regardless of scan order.
    tmpNdcA.set(rawX, rawY, rawZ).project(e.camera)
    let bestPx = SNAP_PX
    let snapTo = -1
    for (let j = 0; j < points.length; j++) {
      if (j === i) continue
      const [ox, oy, oz] = points[j]
      tmpNdcB.set(ox, oy, oz).project(e.camera)
      const dx = (tmpNdcA.x - tmpNdcB.x) * size.width / 2
      const dy = (tmpNdcA.y - tmpNdcB.y) * size.height / 2
      const dpx = Math.hypot(dx, dy)
      if (dpx < bestPx) { bestPx = dpx; x = ox; y = oy; z = oz; snapTo = j }
    }
    setSnapTarget(snapTo >= 0 ? snapTo : null)
    move(i, [x, y, z])
    // Snapping one end of the path onto the other closes the loop — and,
    // with fill on, builds the shape's interior automatically.
    const last = points.length - 1
    if (!closed && points.length > 2 && ((i === 0 && snapTo === last) || (i === last && snapTo === 0))) {
      setClosed(true)
    }
  }
  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return
    e.stopPropagation()
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    draggingRef.current = false
    setDragging(false)
    setSnapTarget(null)
    if (controls) controls.enabled = true
  }
  const del = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    removePt(i)
    if (pick === i) setPick(null)
    else if (pick != null && pick > i) setPick(p => (p == null ? p : p - 1))
    setSelSeg(null)
  }

  // Click a segment to select it — opens the curve/thickness/depth panel for
  // that one edge. Clicking the same segment again closes it.
  const segClick = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    if (draggingRef.current) return
    e.stopPropagation()
    setSelSeg(s => (s === i ? null : i))
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

  // Number of edges: consecutive points, plus a closing edge back to the
  // start once the loop is closed.
  const segCount = closed && points.length > 2 ? points.length : points.length - 1
  const styleAt = (i: number): Seg3DStyle => segs[i] ?? DEFAULT_SEG

  // Each edge's own path — a hard line, or (once curved) the same smoothed
  // curve the final solid is built from, so the preview matches the result.
  const segPolylines = useMemo(() => {
    const out: THREE.Vector3[][] = []
    for (let i = 0; i < segCount; i++) {
      const st = styleAt(i)
      out.push(free3DSegCurve(points, i, st.curved, closed).getPoints(st.curved ? 20 : 1))
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, segCount, segs, closed])

  // A length label at the midpoint of every edge as it's created — the real
  // curve length once an edge is curved, not the straight-line distance.
  const segments = useMemo(() => {
    const out: { mid: THREE.Vector3; mm: number }[] = []
    for (let i = 0; i < segCount; i++) {
      const st = styleAt(i)
      const curve = free3DSegCurve(points, i, st.curved, closed)
      out.push({ mid: curve.getPoint(0.5), mm: curve.getLength() })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, segCount, segs, closed])

  // A live preview of the auto-fill: once the loop is closed (and fill is
  // on), the interior panel that Done will actually build.
  const fillGeom = useMemo(() => {
    if (!closed || !fill || points.length < 3) return null
    const verts = buildLoopFillVertices(points, wire)
    if (!verts.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(Float32Array.from(verts), 3))
    g.computeVertexNormals()
    return g
  }, [points, closed, fill, wire])
  useEffect(() => () => fillGeom?.dispose(), [fillGeom])

  return (
    <>
      {/* The box itself — pure framing, not clickable */}
      <lineSegments geometry={boxEdges} position={[0, PLANE_SIZE / 2, 0]} raycast={() => null}>
        <lineBasicMaterial color="#3a3448" transparent opacity={0.35} />
      </lineSegments>

      {/* Construction floor — click anywhere to drop the next vertex at height 0 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onDoubleClick={groundClick}>
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
        <meshBasicMaterial color="#0E1113" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {gridLines.map((l, i) => <Line key={'g' + i} points={l} color="#242c2f" lineWidth={1} />)}

      {/* Vertical wall, standing on the floor's back edge — click to drop a
          vertex at any height directly, instead of placing on the floor and
          dragging it up. */}
      <mesh position={[0, PLANE_SIZE / 2, WALL_Z]} onDoubleClick={wallClick}>
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
        <meshBasicMaterial color="#140F1B" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {wallGridLines.map((l, i) => <Line key={'w' + i} points={l} color="#2A2438" lineWidth={1} />)}

      {/* Once the loop closes, a preview of the panel Done will actually
          build across the interior — not clickable, just a heads-up. */}
      {fillGeom && (
        <mesh geometry={fillGeom} renderOrder={4} raycast={() => null}>
          <meshStandardMaterial color="#C6A265" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* Live wire preview through the placed points — one Line per edge so
          each can be clicked and styled on its own. */}
      {segPolylines.map((pl, i) => (
        <Line
          key={'seg' + i}
          points={pl}
          color={selSeg === i ? '#7FC8FF' : '#E7C989'}
          lineWidth={selSeg === i ? 4.5 : 2.5}
          onClick={segClick(i)}
        />
      ))}

      {/* A length readout on every segment, live while dragging */}
      {segments.map((s, i) => (
        <Html key={i} position={s.mid} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            whiteSpace: 'nowrap', font: '700 11px ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
            padding: '2px 7px', borderRadius: 4, color: '#0C1114', background: selSeg === i ? '#7FC8FF' : '#E7C989',
            boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
          }}>{s.mm.toFixed(2)} mm</div>
        </Html>
      ))}

      {/* Selected-edge panel: toggle straight/curved, dial in this edge's own
          thickness and depth (an elliptical cross-section, not just round wire). */}
      {selSeg != null && selSeg < segCount && (
        <Html position={segments[selSeg].mid} center zIndexRange={[40, 0]} style={{ pointerEvents: 'auto' }}>
          <div className="seg3d-panel" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="seg3d-head">
              <b>Line {selSeg + 1}</b>
              <button className="seg3d-x" onClick={() => setSelSeg(null)} aria-label="Close">×</button>
            </div>
            <button
              className="seg3d-curve"
              aria-pressed={styleAt(selSeg).curved}
              onClick={() => setSegCurved(selSeg, !styleAt(selSeg).curved)}
            >
              {styleAt(selSeg).curved ? 'Curved — click to straighten' : 'Straight — click to curve'}
            </button>
            <label className="sk-slider">Thickness {styleAt(selSeg).thickness.toFixed(1)} mm
              <input
                type="range" min={0.3} max={6} step={0.1}
                value={styleAt(selSeg).thickness}
                onChange={e => setSegThickness(selSeg, +e.target.value)}
              />
            </label>
            <label className="sk-slider">Depth {styleAt(selSeg).depth.toFixed(1)} mm
              <input
                type="range" min={0.3} max={6} step={0.1}
                value={styleAt(selSeg).depth}
                onChange={e => setSegDepth(selSeg, +e.target.value)}
              />
            </label>
          </div>
        </Html>
      )}

      {/* While dragging, a glowing ring around whatever vertex is currently
          in snap range — confirms the target before you let go. */}
      {dragging && snapTarget != null && (
        <mesh position={points[snapTarget]} renderOrder={11} raycast={() => null}>
          <sphereGeometry args={[0.9, 16, 14]} />
          <meshBasicMaterial color="#7FFFB0" toneMapped={false} transparent opacity={0.4} depthTest={false} wireframe />
        </mesh>
      )}

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
