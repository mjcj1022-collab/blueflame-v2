import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Html, TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useModeler, type SculptObject } from '../state/modeler'
import { pointInPolygon, groupCentroid } from '../lib/vertexSelect'
import { circleSprite } from './circleSprite'

/**
 * ArcGIS-style vertex tools for an editable mesh:
 *   - Lasso: hold left-drag to rubber-band a freehand outline; every vertex whose
 *     screen position falls inside is selected.
 *   - Group move: a translate gizmo at the selection's centroid drags the whole
 *     group together.
 *   - Delete: the Delete/Backspace key drops every triangle using a selected
 *     vertex.
 * Rendered alongside VertexSculptor while a mesh is in Vertices mode.
 */
export function VertexTools({ o }: { o: SculptObject }) {
  const tool = useModeler(s => s.vertexTool)
  const selectedVerts = useModeler(s => s.selectedVerts)
  const setSelectedVerts = useModeler(s => s.setSelectedVerts)
  const moveVertsGroup = useModeler(s => s.moveVertsGroup)
  const deleteVertsGroup = useModeler(s => s.deleteVertsGroup)

  return (
    <>
      {tool === 'lasso' && <LassoLayer o={o} onSelect={setSelectedVerts} />}
      {selectedVerts.length > 0 && (
        <GroupGizmo
          o={o}
          indices={selectedVerts}
          onMove={d => moveVertsGroup(o.id, selectedVerts, d)}
          onDelete={() => deleteVertsGroup(o.id, selectedVerts)}
        />
      )}
    </>
  )
}

/** Freehand lasso over the mesh: draws the outline as an SVG overlay and selects
 *  the vertices whose projected screen position lands inside it. */
function LassoLayer({ o, onSelect }: { o: SculptObject; onSelect: (idx: number[]) => void }) {
  const { camera, gl, size, controls } = useThree(s => ({ camera: s.camera, gl: s.gl, size: s.size, controls: s.controls as { enabled: boolean } | null }))
  const [path, setPath] = useState<[number, number][]>([])
  const pathRef = useRef<[number, number][]>([])
  const drawingRef = useRef(false)

  useEffect(() => {
    const el = gl.domElement
    const rect = () => el.getBoundingClientRect()
    const pt = (e: PointerEvent): [number, number] => { const r = rect(); return [e.clientX - r.left, e.clientY - r.top] }

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      drawingRef.current = true
      pathRef.current = [pt(e)]
      setPath(pathRef.current.slice())
      if (controls) controls.enabled = false
    }
    const move = (e: PointerEvent) => {
      if (!drawingRef.current) return
      pathRef.current.push(pt(e))
      setPath(pathRef.current.slice())
    }
    const up = () => {
      if (!drawingRef.current) return
      drawingRef.current = false
      if (controls) controls.enabled = true
      const poly = pathRef.current
      pathRef.current = []
      setPath([])
      if (poly.length < 3) { onSelect([]); return }
      // Project every vertex to screen px and keep those inside the lasso.
      const v = o.vertices ?? []
      const w = size.width, h = size.height
      const p = new THREE.Vector3()
      const picked: number[] = []
      for (let i = 0; i + 2 < v.length; i += 3) {
        p.set(v[i], v[i + 1], v[i + 2]).project(camera)
        if (p.z > 1) continue // behind the camera
        const sx = (p.x + 1) / 2 * w
        const sy = (1 - p.y) / 2 * h
        if (pointInPolygon(sx, sy, poly)) picked.push(i / 3)
      }
      onSelect(picked)
    }

    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (controls) controls.enabled = true
    }
  }, [gl, camera, size, controls, o.vertices, onSelect])

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {path.length > 1 && (
          <polyline
            points={path.map(p => p.join(',')).join(' ')}
            fill="rgba(31,138,107,0.12)" stroke="#1F8A6B" strokeWidth={1.5} strokeDasharray="5 4"
          />
        )}
      </svg>
    </Html>
  )
}

/** Highlights the selected vertices and gives them a single translate gizmo. */
function GroupGizmo({ o, indices, onMove, onDelete }: { o: SculptObject; indices: number[]; onMove: (d: [number, number, number]) => void; onDelete: () => void }) {
  const ref = useRef<THREE.Object3D>(null)
  const centroid = useMemo(() => groupCentroid(o.vertices ?? [], indices), [o.vertices, indices])

  // Keep the gizmo anchored on the current centroid (after each committed move
  // the vertices shift, so this re-centres it).
  useEffect(() => { ref.current?.position.set(centroid[0], centroid[1], centroid[2]) }, [centroid])

  // Delete / Backspace removes the selected vertices' triangles.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onDelete() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onDelete])

  // Bright dots on the selected vertices.
  const dots = useMemo(() => {
    const v = o.vertices ?? []
    const arr: number[] = []
    for (const i of indices) { const b = i * 3; if (b + 2 < v.length) arr.push(v[b], v[b + 1], v[b + 2]) }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(Float32Array.from(arr), 3))
    return g
  }, [o.vertices, indices])
  useEffect(() => () => dots.dispose(), [dots])

  const commit = () => {
    const m = ref.current
    if (!m) return
    const d: [number, number, number] = [m.position.x - centroid[0], m.position.y - centroid[1], m.position.z - centroid[2]]
    if (Math.hypot(d[0], d[1], d[2]) > 1e-5) onMove(d)
  }

  return (
    <>
      <points geometry={dots} raycast={() => null}>
        <pointsMaterial
          size={0.55}
          sizeAttenuation
          map={circleSprite()}
          alphaTest={0.5}
          transparent
          color="#FF5D8F"
          toneMapped={false}
        />
      </points>
      <TransformControls mode="translate" size={0.7} onMouseUp={commit}>
        <object3D ref={ref} />
      </TransformControls>
    </>
  )
}
