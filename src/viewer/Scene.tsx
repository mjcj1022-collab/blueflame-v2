import { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Lightformer, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { useDesign } from '../state/design'
import { alloyById, shapeById, stoneMm } from '../catalog'
import { sizeToDiameter, formatSize } from '../lib/sizing'
import { CATEGORY_LABEL, stoneOnPiece } from '../spec/types'
import { Piece, viewTarget, displayScale } from './Piece'
import { pieceHandle, pieceToEditableVertices } from './exportStl'
import { AttributesOverlay } from '../ui/AttributesOverlay'
import { VertexSculptor } from './VertexSculptor'
import { useDesignEdit } from '../state/designEdit'
import type { VertexTool } from '../state/modeler'
import { captureHandle, downloadHeroPng, downloadSpinGif } from './capture'
import { subdivideSoup, smoothSoup } from '../lib/sculpt'
import { CameraTryOn } from '../ui/CameraTryOn'
import { SuggestBar } from '../ui/SuggestBar'

function Turntable({ on, children }: { on: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (on && ref.current) ref.current.rotation.y += dt * 0.25 })
  return <group ref={ref}>{children}</group>
}

function hudChips(spec: ReturnType<typeof useDesign.getState>['spec']) {
  const alloy = alloyById(spec.metal.alloyId)
  const shape = shapeById(spec.center.shapeId)
  const mm = stoneMm(shape, spec.center.carat)
  const chips: React.ReactNode[] = []

  if (spec.category === 'ring') {
    chips.push(<span key="s" className="chip">Size <b>{formatSize(spec.ring.size)}</b> · <b>{sizeToDiameter(spec.ring.size).toFixed(2)}</b> mm ID</span>)
  } else if (spec.category === 'bracelet') {
    chips.push(<span key="s" className="chip"><b>{CATEGORY_LABEL[spec.category]}</b> · {spec.bracelet.kind} · <b>{((spec.bracelet.wristCircumference + spec.bracelet.fitAllowance) / 25.4).toFixed(1)}</b> in</span>)
  } else if (spec.category === 'necklace') {
    chips.push(<span key="s" className="chip"><b>Necklace</b> · <b>{spec.necklace.length}</b> in</span>)
  } else {
    chips.push(<span key="s" className="chip"><b>{CATEGORY_LABEL[spec.category]}</b></span>)
  }

  if (stoneOnPiece(spec))
    chips.push(<span key="c" className="chip"><b>{spec.center.carat.toFixed(2)} ct</b> {shape.name} · <b>{mm.length.toFixed(2)} × {mm.width.toFixed(2)}</b> mm</span>)

  chips.push(<span key="a" className="chip"><b>{alloy.name}</b> · {alloy.hallmark}</span>)
  return chips
}

interface Lighting {
  label: string; bg: string; envI: number; amb: number
  key: [string, number]; fill: [string, number]
  // procedural studio-rig tint + key/fill intensity for the environment map
  rig: { key: string; keyI: number; fill: number; sparkle: string }
}
const LIGHTING: Record<string, Lighting> = {
  studio:   { label: 'Studio',   bg: '#0E1113', envI: 1.00, amb: 0.28, key: ['#ffffff', 1.5], fill: ['#BFD4FF', 0.65], rig: { key: '#ffffff', keyI: 1.6, fill: 0.6, sparkle: '#ffffff' } },
  daylight: { label: 'Daylight', bg: '#151a1d', envI: 1.15, amb: 0.45, key: ['#FFF7E8', 2.0], fill: ['#CFE0FF', 0.90], rig: { key: '#eaf2ff', keyI: 2.2, fill: 0.9, sparkle: '#ffffff' } },
  case:     { label: 'Case',     bg: '#050607', envI: 0.85, amb: 0.10, key: ['#FFFFFF', 2.6], fill: ['#FFFFFF', 0.20], rig: { key: '#ffffff', keyI: 3.0, fill: 0.12, sparkle: '#ffffff' } },
  candle:   { label: 'Candle',   bg: '#140f0a', envI: 0.80, amb: 0.16, key: ['#FF9C45', 1.6], fill: ['#FFB86A', 0.40], rig: { key: '#ffb271', keyI: 1.8, fill: 0.35, sparkle: '#ffd9a8' } },
  office:   { label: 'Office',   bg: '#10151a', envI: 0.95, amb: 0.50, key: ['#EAF0FF', 1.2], fill: ['#EAF0FF', 0.80], rig: { key: '#f0f4ff', keyI: 1.3, fill: 0.8, sparkle: '#ffffff' } }
}
const SCENES = ['studio', 'daylight', 'case', 'candle', 'office']

/**
 * A procedural studio softbox baked into the environment map — a broad top key,
 * side rims, a front fill and a bright sparkle streak for stone brilliance.
 * No CDN HDRI, so reflections work offline and stay tunable per scenario.
 */
function StudioEnv({ rig, intensity }: { rig: Lighting['rig']; intensity: number }) {
  return (
    <Environment resolution={256} environmentIntensity={intensity}>
      {/* six-face soft surround so transmissive stones refract light, not void */}
      <Lightformer form="rect" intensity={rig.keyI} color={rig.key} scale={[46, 46, 1]} position={[0, 25, 4]} rotation={[-Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={rig.fill * 1.4} color="#ffffff" scale={[46, 46, 1]} position={[0, -25, 4]} rotation={[Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={rig.keyI * 0.9} color={rig.key} scale={[22, 42, 1]} position={[24, 4, 4]} rotation={[0, -Math.PI / 2, 0]} />
      <Lightformer form="rect" intensity={rig.fill * 1.5} color="#ffffff" scale={[22, 42, 1]} position={[-24, 4, 4]} rotation={[0, Math.PI / 2, 0]} />
      <Lightformer form="rect" intensity={rig.fill * 1.3} color="#ffffff" scale={[42, 26, 1]} position={[0, 4, 28]} rotation={[0, 0, 0]} />
      <Lightformer form="rect" intensity={rig.fill * 1.2} color={rig.key} scale={[42, 26, 1]} position={[0, 4, -28]} rotation={[0, Math.PI, 0]} />
      {/* bright sparkle streaks catch the crown facets */}
      <Lightformer form="ring" intensity={rig.keyI * 1.7} color={rig.sparkle} scale={5} position={[9, 15, 18]} />
      <Lightformer form="ring" intensity={rig.keyI * 1.2} color={rig.sparkle} scale={3.5} position={[-11, 9, 16]} />
    </Environment>
  )
}

const SKIN_TONES = ['#E7C1A0', '#C89778', '#A56A43', '#6E4326']

const EDIT_HINT: Record<VertexTool, string> = {
  select: 'Click a vertex to select · orbit freely',
  edit: 'Left-click a vertex and drag to reshape · scroll to zoom',
  add: 'Click the surface to add a vertex · scroll to zoom',
  remove: 'Double-click a vertex to remove it · scroll to zoom',
  lasso: 'Drag a lasso around vertices · move them with the gizmo · Delete key removes them',
}

/** Publishes the renderer/scene/camera so the piece can be captured off-screen. */
function CaptureRig() {
  const gl = useThree(s => s.gl)
  const scene = useThree(s => s.scene)
  const camera = useThree(s => s.camera)
  useEffect(() => {
    captureHandle.current = { gl, scene, camera }
    return () => { captureHandle.current = null }
  }, [gl, scene, camera])
  return null
}

export function Scene({ suggest = false }: { suggest?: boolean } = {}) {
  const spec = useDesign(s => s.spec)
  const wire = useDesign(s => s.viewWire)
  const toggleWire = useDesign(s => s.toggleWire)
  const explode = useDesign(s => s.explode)
  const setExplode = useDesign(s => s.setExplode)
  const tryOn = useDesign(s => s.tryOn)
  const toggleTryOn = useDesign(s => s.toggleTryOn)
  const skinTone = useDesign(s => s.skinTone)
  const setSkinTone = useDesign(s => s.setSkinTone)
  const isRing = spec.category === 'ring'
  const [spin, setSpin] = useState(true)
  const [top, setTop] = useState(false)
  const [scene, setScene] = useState('studio')
  const [reduced, setReduced] = useState(false)
  const L = LIGHTING[scene]
  const [grid, setGrid] = useState(false)
  const [ar, setAr] = useState(false)
  const [editNote, setEditNote] = useState<string | null>(null)
  const [gifPct, setGifPct] = useState<number | null>(null)

  const doSubdivide = () => {
    if (!editVertices) return
    if (editVertices.length / 3 > 90000) { setEditNote('Mesh is already very dense — smooth or reshape instead.'); setTimeout(() => setEditNote(null), 2600); return }
    commitEdit(subdivideSoup(editVertices))
  }
  const doSmooth = () => { if (editVertices) commitEdit(smoothSoup(editVertices, editFalloff)) }

  const exportPhoto = () => { setSpin(false); requestAnimationFrame(() => downloadHeroPng(2)) }
  const exportSpin = async () => {
    if (gifPct != null) return
    setSpin(false); setGifPct(0)
    try { await downloadSpinGif({ onProgress: p => setGifPct(Math.round(p * 100)) }) }
    finally { setGifPct(null) }
  }

  // Freeform vertex editing on the parametric piece (separate store).
  const editActive = useDesignEdit(s => s.active)
  const editVertices = useDesignEdit(s => s.vertices)
  const editTool = useDesignEdit(s => s.tool)
  const editSelVert = useDesignEdit(s => s.selectedVertex)
  const editFalloff = useDesignEdit(s => s.falloff)
  const editSym = useDesignEdit(s => s.symmetry)
  const beginEdit = useDesignEdit(s => s.begin)
  const setEditTool = useDesignEdit(s => s.setTool)
  const setEditFalloff = useDesignEdit(s => s.setFalloff)
  const toggleEditSym = useDesignEdit(s => s.toggleSymmetry)
  const pickEditVert = useDesignEdit(s => s.pick)
  const commitEdit = useDesignEdit(s => s.commit)
  const undoEdit = useDesignEdit(s => s.undo)
  const redoEdit = useDesignEdit(s => s.redo)
  const resetEdit = useDesignEdit(s => s.reset)
  const exitEdit = useDesignEdit(s => s.exit)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    if (mq.matches) setSpin(false)
  }, [])

  // Bake the on-screen piece into an editable triangle soup and enter edit mode.
  // Re-clicking a tool while already editing just switches the active tool.
  const enterEdit = (tool: VertexTool) => {
    if (editActive) { setEditTool(tool); return }
    const root = pieceHandle.current
    if (!root) return
    const mm = pieceToEditableVertices(spec, root)
    if (mm.length < 9) {
      setEditNote('Nothing metal to reshape in this view.')
      setTimeout(() => setEditNote(null), 2600)
      return
    }
    // Bake the display scale into the vertices so the editable mesh renders at
    // the scene root (like the Sculpt tab) — TransformControls misplaces its
    // gizmo when the mesh sits inside a scaled group.
    const s = displayScale(spec)
    const verts = s === 1 ? mm : mm.map(v => v * s)
    setSpin(false)
    beginEdit(verts, tool)
  }

  const target = viewTarget(spec)

  return (
    <div className="stage">
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 30, position: [18, 16, 44] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <color attach="background" args={[L.bg]} />
        <CaptureRig />
        <Suspense fallback={null}>
          <StudioEnv rig={L.rig} intensity={L.envI} />
        </Suspense>
        <ambientLight intensity={L.amb} />
        <directionalLight position={[6, 12, 9]} intensity={L.key[1]} color={L.key[0]} />
        <directionalLight position={[-8, 3, -7]} intensity={L.fill[1]} color={L.fill[0]} />
        <Turntable on={spin && !reduced && !editActive}>
          <group ref={g => { pieceHandle.current = g }}>
            {!editActive && <Piece spec={spec} />}
          </group>
        </Turntable>
        {editActive && editVertices && (
          <VertexSculptor
            vertices={editVertices}
            color={0xD8B36A}
            falloff={editFalloff}
            symmetry={editSym}
            tool={editTool}
            selectedVertex={editSelVert}
            onPick={i => pickEditVert(i)}
            onCommit={v => commitEdit(v)}
          />
        )}
        {grid && <gridHelper args={[80, 40, '#394246', '#252b2e']} position={[0, -13, 0]} />}
        <ContactShadows position={[0, -13, 0]} opacity={0.5} scale={70} blur={2.6} far={26} resolution={512} color="#000000" />
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={16}
          maxDistance={110}
          target={target}
          onStart={() => setSpin(false)}
        />
      </Canvas>

      <div className="stage-hud">{hudChips(spec)}</div>

      <AttributesOverlay />

      <div className="stage-light">
        {SCENES.map(s => (
          <button key={s} className="sbtn" aria-pressed={scene === s} onClick={() => setScene(s)}>{LIGHTING[s].label}</button>
        ))}
      </div>

      <div className="stage-foot">
        <div className="scalebar"><i /> {editActive ? EDIT_HINT[editTool] : 'Drag to orbit · scroll to zoom'}</div>
      </div>

      <div className="stage-toolbar">
        <div className="tbar-grp">
          <span className="tbar-lbl">View</span>
          <button className="sbtn" aria-pressed={spin} onClick={() => setSpin(v => !v)} disabled={editActive}>Turntable</button>
          <button className="sbtn" aria-pressed={top} onClick={() => setTop(v => !v)}>Top view</button>
          <button className="sbtn" aria-pressed={wire} onClick={toggleWire}>Wireframe</button>
          <button className="sbtn" aria-pressed={grid} onClick={() => setGrid(v => !v)}>Grid</button>
          {isRing && <button className="sbtn" aria-pressed={tryOn} onClick={toggleTryOn} disabled={editActive}>Try-on</button>}
          {isRing && <button className="sbtn" onClick={() => setAr(true)} disabled={editActive} title="Try the ring on with your camera">Camera</button>}
        </div>
        <div className="tbar-grp">
          <span className="tbar-lbl">Tools</span>
          <button className="sbtn" aria-pressed={!editActive} onClick={exitEdit} title="View / orbit the parametric piece">Move</button>
          <button className="sbtn" aria-pressed={editActive && editTool === 'select'} onClick={() => enterEdit('select')} title="Select vertices only">Select</button>
          <button className="sbtn" aria-pressed={editActive && editTool === 'edit'} onClick={() => enterEdit('edit')} title="Left-click a vertex and drag to reshape">Edit</button>
          <button className="sbtn" aria-pressed={editActive && editTool === 'add'} onClick={() => enterEdit('add')} title="Click the surface to add a vertex">Add</button>
          <button className="sbtn" aria-pressed={editActive && editTool === 'remove'} onClick={() => enterEdit('remove')} title="Double-click a vertex to remove it">Remove</button>
        </div>
        <div className="tbar-grp">
          <span className="tbar-lbl">Export</span>
          <button className="sbtn" onClick={exportPhoto} title="Download a high-resolution photo of the piece">Photo</button>
          <button className="sbtn" onClick={exportSpin} disabled={gifPct != null} title="Download a spinning 360° GIF">{gifPct != null ? `GIF ${gifPct}%` : '360° GIF'}</button>
        </div>
      </div>

      <div className="stage-tools">
        {editActive && (
          <div className="edit-tools">
            <label className="explode-row">
              <span>Region</span>
              <input type="range" min={0.4} max={8} step={0.1} value={editFalloff} onChange={e => setEditFalloff(+e.target.value)} />
            </label>
            <div className="stage-btns">
              <button className="sbtn" onClick={doSubdivide} title="Refine — split each face for finer control">Subdivide</button>
              <button className="sbtn" onClick={doSmooth} title="Relax — smooth lumps within the region">Smooth</button>
              <button className="sbtn" aria-pressed={editSym} onClick={toggleEditSym} title="Mirror edits across the centre">Mirror</button>
            </div>
            <div className="stage-btns">
              <button className="sbtn" onClick={undoEdit} title="Undo vertex edit">Undo</button>
              <button className="sbtn" onClick={redoEdit} title="Redo vertex edit">Redo</button>
              <button className="sbtn" onClick={resetEdit} title="Back to the freshly-baked shape">Reset</button>
              <button className="sbtn" onClick={exitEdit} title="Leave edit mode (back to parametric)">Done</button>
            </div>
          </div>
        )}
        <label className="explode-row">
          <span>Explode</span>
          <input type="range" min={0} max={1} step={0.02} value={explode} onChange={e => setExplode(+e.target.value)} />
        </label>
        {isRing && tryOn && (
          <div className="skin-row">
            {SKIN_TONES.map(c => (
              <button key={c} className={`skin ${skinTone === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setSkinTone(c)} aria-label="skin tone" />
            ))}
          </div>
        )}
      </div>
      {top && <div className="topview-note">Drag to look straight down — the plan view shows the setting and profile.</div>}
      {editNote && <div className="topview-note">{editNote}</div>}
      {ar && <CameraTryOn onClose={() => setAr(false)} />}
      {suggest && <SuggestBar />}
    </div>
  )
}
