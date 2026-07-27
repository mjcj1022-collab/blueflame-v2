import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { TransformControls, Edges } from '@react-three/drei'
import { useModeler, type SculptObject } from '../state/modeler'
import { renderGeometry } from '../lib/sculpt'
import { wallThicknessColors, HEATMAP_MIN_WALL } from '../lib/heatmap'
import { VertexEditor } from './VertexEditor'
import { SketchNodeEditor } from './SketchNodeEditor'
import { SurfaceDraw } from './SurfaceDraw'

function useSculptMaterial(o: SculptObject) {
  return useMemo(() => {
    if (o.material === 'gem') {
      return new THREE.MeshPhysicalMaterial({
        color: o.color, metalness: 0, roughness: 0.02, transmission: 0.9,
        thickness: 4, ior: 2.0, clearcoat: 1, flatShading: true, transparent: true
      })
    }
    return new THREE.MeshStandardMaterial({ color: o.color, metalness: 1, roughness: 0.22, envMapIntensity: 1.3 })
  }, [o.material, o.color])
}

const snapTo = (v: number, step: number) => Math.round(v / step) * step

export function SculptMesh({ o }: { o: SculptObject }) {
  const { selectedId, select, mode, update, snap, editMode, sketching, sketchEditId, bakeToMesh } = useModeler()
  const ref = useRef<THREE.Mesh>(null)
  const geom = useMemo(() => renderGeometry(o), [o.kind, o.size, o.vertices, JSON.stringify(o.params)])
  const material = useSculptMaterial(o)
  const selected = selectedId === o.id

  // Wall-thickness heat-map: recolour metal parts by local thickness on demand.
  const heatmap = useModeler(s => s.heatmap)
  const heatMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.75, envMapIntensity: 0.4 }), [])
  const heatGeom = useMemo(() => {
    if (!heatmap || o.material !== 'metal') return null
    const g = geom.clone()
    const colors = wallThicknessColors(g, HEATMAP_MIN_WALL)
    if (!colors) { g.dispose(); return null }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return g
  }, [heatmap, geom, o.material])
  const showHeat = heatmap && heatGeom !== null
  const dispGeom = showHeat ? heatGeom! : geom
  const dispMat = showHeat ? heatMat : material

  // Entering Vertices mode on a template/primitive auto-converts it to an
  // editable mesh, so its moveable vertices appear at once — no separate
  // "Make editable" step. Sketches (their own node editor) and meshes are skipped.
  const needsBake = selected && editMode === 'vertex' && o.kind !== 'mesh' && o.kind !== 'sketch'
  useEffect(() => { if (needsBake) bakeToMesh(o.id) }, [needsBake, o.id, bakeToMesh])

  // A sketch always shows its draggable nodes when selected (Object or Vertices
  // mode) or while it's being drawn — a sketch is its nodes. In Object mode the
  // whole-shape move gizmo is still available (until you grab a node).
  if (o.kind === 'sketch' && o.params?.sketch && ((selected && editMode !== 'surface') || (sketching && o.id === sketchEditId))) return <SketchNodeEditor o={o} />
  if (selected && editMode === 'vertex' && o.kind === 'mesh') return <VertexEditor o={o} />
  // Surface-draw mode: emboss/cut a stroke on the selected part (any kind).
  if (selected && editMode === 'surface') return <SurfaceDraw o={o} />

  const mesh = (
    <mesh
      ref={ref}
      geometry={dispGeom}
      material={dispMat}
      position={o.position}
      rotation={o.rotation}
      scale={o.scale}
      onClick={e => {
        e.stopPropagation()
        // While a stone is armed for placement, clicking a part drops the stone
        // ON that surface point ("anywhere on the feature"); otherwise select.
        const p = useModeler.getState().placing
        if (p) useModeler.getState().addStone({ ...p, position: [e.point.x, e.point.y, e.point.z] })
        else select(o.id)
      }}
      castShadow
    >
      {selected && <Edges scale={1.03} threshold={15} color="#C6A265" />}
    </mesh>
  )

  if (!selected) return mesh

  const commit = () => {
    const m = ref.current
    if (!m) return
    const g = Math.PI / 12   // 15° rotation grid
    update(o.id, {
      position: snap ? [snapTo(m.position.x, 0.5), snapTo(m.position.y, 0.5), snapTo(m.position.z, 0.5)] : [m.position.x, m.position.y, m.position.z],
      rotation: snap ? [snapTo(m.rotation.x, g), snapTo(m.rotation.y, g), snapTo(m.rotation.z, g)] : [m.rotation.x, m.rotation.y, m.rotation.z],
      scale: [m.scale.x, m.scale.y, m.scale.z]
    })
  }

  return (
    <TransformControls mode={mode} onMouseUp={commit} size={0.8}>
      {mesh}
    </TransformControls>
  )
}
