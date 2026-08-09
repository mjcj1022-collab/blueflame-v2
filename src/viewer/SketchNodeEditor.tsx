import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import * as THREE from 'three'
import { TransformControls, Edges, Html, Line } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useModeler, type SculptObject } from '../state/modeler'
import { renderGeometry, objectMatrix, editSketchPoint, profileDistance } from '../lib/sculpt'

/**
 * Drag a sketch's profile control points directly in the 3D render. Each node
 * sits on the generated surface (at the revolve's front for a lathe, or the
 * front face for an extrude); moving it rewrites that profile point, so the
 * whole parametric shape regenerates live — no baking to a mesh.
 */
/** mm grid the node handles snap to when Snap is on (matches object-move snap). */
const GRID_MM = 0.5
const snapMm = (v: number) => Math.round(v / GRID_MM) * GRID_MM

export function SketchNodeEditor({ o }: { o: SculptObject }) {
  const setObjectSketch = useModeler(s => s.setObjectSketch)
  const snap = useModeler(s => s.snap)
  const editMode = useModeler(s => s.editMode)
  const mode = useModeler(s => s.mode)
  const measuring = useModeler(s => s.measuring)
  const update = useModeler(s => s.update)
  const select = useModeler(s => s.select)
  const sk = o.params!.sketch!
  const objRef = useRef<THREE.Mesh>(null)

  const geom = useMemo(() => renderGeometry(o), [o.id, JSON.stringify(o.params)])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: o.color, metalness: 1, roughness: 0.25, envMapIntensity: 1.3 }), [o.color])
  const matrix = useMemo(() => objectMatrix(o), [o.position, o.rotation, o.scale])
  const inv = useMemo(() => matrix.clone().invert(), [matrix])

  const handleLocal = (p: [number, number]) =>
    sk.mode === 'revolve' ? new THREE.Vector3(p[0], p[1], 0) : new THREE.Vector3(p[0], p[1], sk.depth / 2)
  const handleWorld = (p: [number, number]) => handleLocal(p).applyMatrix4(matrix)

  const [pick, setPick] = useState<number | null>(null)
  const [pickKey, setPickKey] = useState(0)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<[string, string]>(['', ''])
  const [mPicks, setMPicks] = useState<number[]>([])   // up to 2 nodes for the measure tool
  const handleRef = useRef<THREE.Mesh>(null)

  // Reset the measurement when measuring turns off, the object changes, or a node vanishes.
  useEffect(() => { setMPicks(p => p.filter(i => i < sk.points.length)) }, [sk.points.length])
  useEffect(() => { if (!measuring) setMPicks([]) }, [measuring])
  useEffect(() => { setMPicks([]); setPick(null); setEditIdx(null) }, [o.id])

  const grab = (i: number) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setPick(i); setPickKey(k => k + 1) }
  // Measure mode: click nodes to pick the pair (toggle off; keep the last two).
  const measurePick = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setMPicks(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].slice(-2))
  }

  // The two axis labels for a profile point, by mode.
  const axes: [string, string] = sk.mode === 'revolve' ? ['r', 'h'] : ['x', 'y']
  // Live mm readout for a profile point: radius·height (revolve) or x·y (extrude).
  const readout = (p: [number, number]) =>
    sk.mode === 'revolve'
      ? `r ${p[0].toFixed(1)} · h ${p[1].toFixed(1)}`
      : `${p[0].toFixed(1)} · ${p[1].toFixed(1)}`

  const startEdit = (i: number) => (e: ReactMouseEvent) => {
    e.stopPropagation()
    const p = sk.points[i]
    setDraft([p[0].toFixed(1), p[1].toFixed(1)])
    setPick(i); setPickKey(k => k + 1); setEditIdx(i)
  }
  const commitEdit = (i: number) => {
    const np = editSketchPoint(sk.points, i, sk.mode, parseFloat(draft[0]), parseFloat(draft[1]))
    if (np !== sk.points) setObjectSketch(o.id, { ...sk, points: np })
    setEditIdx(null)
  }

  // Arrow-key nudge the selected node by one grid step (Shift = coarse). Left/Right
  // move radius|x, Up/Down move height|y. Ignored while typing in a field.
  useEffect(() => {
    if (pick == null || editIdx != null) return
    const onKey = (e: KeyboardEvent) => {
      const t = document.activeElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const dir: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
      }
      const d = dir[e.key]; const p = sk.points[pick]
      if (!d || !p) return
      e.preventDefault()
      const step = (e.shiftKey ? 5 : 1) * GRID_MM
      let a = p[0] + d[0] * step, b = p[1] + d[1] * step
      if (snap) { a = snapMm(a); b = snapMm(b) }
      const np = editSketchPoint(sk.points, pick, sk.mode, a, b)
      if (np !== sk.points) setObjectSketch(o.id, { ...sk, points: np })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pick, editIdx, snap, sk, o.id, setObjectSketch])

  const pillStyle: CSSProperties = {
    transform: 'translateY(-14px)', whiteSpace: 'nowrap',
    font: '600 10px ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em', padding: '1px 5px', borderRadius: 4,
    background: 'rgba(12,14,17,0.82)', border: '1px solid rgba(255,255,255,0.08)',
  }
  const inputStyle: CSSProperties = {
    width: 34, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(231,201,137,0.5)',
    borderRadius: 3, color: '#E7C989', font: '600 10px ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums', textAlign: 'right', padding: '0 2px', outline: 'none',
  }

  const nodeLabel = (i: number, p: [number, number], active: boolean) => (
    <Html position={handleWorld(p)} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      {editIdx === i ? (
        <div
          style={{ ...pillStyle, display: 'inline-flex', gap: 3, alignItems: 'center', pointerEvents: 'auto' }}
          onPointerDown={e => e.stopPropagation()}
          // Commit only when focus leaves the whole editor — not when tabbing
          // between the two fields (which would close it after the first).
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitEdit(i) }}
        >
          {([0, 1] as const).map(k => (
            <span key={k} style={{ display: 'inline-flex', gap: 2, alignItems: 'center', color: '#9BB4C6' }}>
              {axes[k]}
              <input
                autoFocus={k === 0}
                type="number" step={0.1} value={draft[k]} style={inputStyle}
                onChange={e => setDraft(d => (k === 0 ? [e.target.value, d[1]] : [d[0], e.target.value]))}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(i); else if (e.key === 'Escape') setEditIdx(null) }}
              />
            </span>
          ))}
          <span style={{ color: '#6b7580' }}>mm</span>
        </div>
      ) : (
        <div
          onClick={startEdit(i)}
          title="Click to type an exact value"
          style={{ ...pillStyle, cursor: 'text', pointerEvents: 'auto', color: active ? '#E7C989' : '#9BB4C6', opacity: active ? 1 : 0.85 }}
        >{readout(p)} mm</div>
      )}
    </Html>
  )

  const drag = () => {
    if (pick == null || !handleRef.current) return
    const local = handleRef.current.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)
    let [x, y] = [local.x, local.y]
    if (snap) { x = snapMm(x); y = snapMm(y) }   // land on the 0.5 mm grid
    const np = sk.points.map((pt, i): [number, number] =>
      i !== pick ? pt : sk.mode === 'revolve' ? [Math.max(0, x), y] : [x, y])
    setObjectSketch(o.id, { ...sk, points: np })
  }

  // profile coordinate of a world-space point on the surface
  const toProfile = (world: THREE.Vector3): [number, number] => {
    const l = world.clone().applyMatrix4(inv)
    return sk.mode === 'revolve' ? [Math.hypot(l.x, l.z), l.y] : [l.x, l.y]
  }

  // click the surface to insert a node at the nearest profile segment
  const addNode = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const np = toProfile(e.point)
    if (snap) { np[0] = Math.max(0, snapMm(np[0])); np[1] = snapMm(np[1]) }
    let at = sk.points.length, best = Infinity
    for (let i = 0; i < sk.points.length - 1; i++) {
      const mx = (sk.points[i][0] + sk.points[i + 1][0]) / 2, my = (sk.points[i][1] + sk.points[i + 1][1]) / 2
      const d = (mx - np[0]) ** 2 + (my - np[1]) ** 2
      if (d < best) { best = d; at = i + 1 }
    }
    const out = [...sk.points]; out.splice(at, 0, np)
    setObjectSketch(o.id, { ...sk, points: out })
  }

  // right-click a node to delete it
  const delNode = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (sk.points.length <= 2) return
    setObjectSketch(o.id, { ...sk, points: sk.points.filter((_, j) => j !== i) })
    if (pick === i) setPick(null); else if (pick != null && pick > i) setPick(pick - 1)
  }

  // Move/rotate/scale the whole sketch (object mode, when no node is grabbed).
  const commitObject = () => {
    const m = objRef.current
    if (!m) return
    const g = Math.PI / 12
    update(o.id, {
      position: snap ? [snapMm(m.position.x), snapMm(m.position.y), snapMm(m.position.z)] : [m.position.x, m.position.y, m.position.z],
      rotation: snap ? [Math.round(m.rotation.x / g) * g, Math.round(m.rotation.y / g) * g, Math.round(m.rotation.z / g) * g] : [m.rotation.x, m.rotation.y, m.rotation.z],
      scale: [m.scale.x, m.scale.y, m.scale.z],
    })
  }

  const baseMesh = (
    <mesh ref={objRef} geometry={geom} material={material} position={o.position} rotation={o.rotation} scale={o.scale}
      onClick={editMode === 'vertex' ? addNode : e => { e.stopPropagation(); select(o.id) }} castShadow>
      <Edges scale={1.003} threshold={20} color="#3d454a" />
    </mesh>
  )
  const showObjGizmo = editMode === 'object' && pick == null && !measuring
  const measurePair = measuring && mPicks.length === 2 && mPicks.every(i => sk.points[i])

  return (
    <>
      {showObjGizmo
        ? <TransformControls mode={mode} size={0.8} translationSnap={snap ? GRID_MM : null} onMouseUp={commitObject}>{baseMesh}</TransformControls>
        : baseMesh}

      {sk.points.map((p, i) => (!measuring && i === pick) ? null : (
        <group key={i}>
          <mesh position={handleWorld(p)} onClick={measuring ? measurePick(i) : grab(i)} onContextMenu={delNode(i)} renderOrder={10}>
            <sphereGeometry args={[measuring && mPicks.includes(i) ? 0.6 : 0.5, 14, 12]} />
            <meshBasicMaterial color={measuring && mPicks.includes(i) ? '#5FD0E0' : '#9BB4C6'} toneMapped={false} depthTest={false} depthWrite={false} transparent opacity={0.55} />
          </mesh>
          {nodeLabel(i, p, false)}
        </group>
      ))}

      {!measuring && pick != null && sk.points[pick] && (
        <>
          <TransformControls key={pickKey} mode="translate" size={0.6} showZ={false} translationSnap={snap ? GRID_MM : null} onObjectChange={drag} onMouseUp={drag}>
            <mesh ref={handleRef} position={handleWorld(sk.points[pick])} onContextMenu={delNode(pick)} renderOrder={11}>
              <sphereGeometry args={[0.55, 14, 12]} />
              <meshBasicMaterial color="#C6A265" toneMapped={false} depthTest={false} depthWrite={false} transparent opacity={0.6} />
            </mesh>
          </TransformControls>
          {nodeLabel(pick, sk.points[pick], true)}
        </>
      )}

      {measurePair && (() => {
        const a = handleWorld(sk.points[mPicks[0]]), b = handleWorld(sk.points[mPicks[1]])
        const mid = a.clone().lerp(b, 0.5)
        const dist = profileDistance(sk.points[mPicks[0]], sk.points[mPicks[1]])
        return (
          <>
            <Line points={[a, b]} color="#5FD0E0" lineWidth={2} dashed dashSize={0.6} gapSize={0.4} depthTest={false} renderOrder={12} />
            <Html position={mid} center zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>
              <div style={{
                whiteSpace: 'nowrap', font: '700 11px ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
                padding: '2px 7px', borderRadius: 4, color: '#0C1114', background: '#5FD0E0',
                boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
              }}>{dist.toFixed(2)} mm</div>
            </Html>
          </>
        )
      })()}
    </>
  )
}
