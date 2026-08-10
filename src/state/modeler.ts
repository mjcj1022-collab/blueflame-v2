import { create } from 'zustand'
import { bakedVertices, subdivideSoup, smoothSoup, twistSoup, taperSoup, bendSoup, booleanOp, strokeTubeVertices, positionTextVertices, loftVertices, buildFree3DTube, buildLoopFillVertices, unionTriangleSoups, type SketchMode, type Seg3DStyle } from '../lib/sculpt'
import { textVertices, curvedTextVertices } from '../lib/text3d'
import { bakedGeometry } from '../lib/sculpt'
import { allPresets, addUserPreset, removeUserPreset, cloneSketch, type SketchPreset } from '../lib/sketchPresets'
import { paveSpots, type PaveMode } from '../lib/pave'
import { stoneMm, shapeById, alloyById, stoneById } from '../catalog'
import { gemDiameterMm, surfaceTopAt, objectTop } from '../lib/setting'
import { haloRadius, channelRailSpots, type RailAlong } from '../lib/construction'
import { textureSoup, type TextureStyle } from '../lib/texture'
import { milgrainSpots, milgrainCount, bridgePath } from '../lib/finishing'
import { paveSpots as paveSpotsFn } from '../lib/pave'
import { buildSculptFromDesign, patchFromSpec, designSignature } from '../lib/aiAssemble'
import { repairMesh } from '../lib/meshRepair'
import { findingVertices, findingById } from '../lib/findings'
import { basketVertices, prongsWithSeatsVertices } from '../lib/settingParts'
import { RING_SIZE_MIN, RING_SIZE_MAX } from '../lib/ringSizing'
import type { AiDesignPatch } from '../lib/aiAssistant'
import type { DesignSpec } from '../spec/types'
import { refineDesign } from '../lib/designRules'
import type { ModelerCommand } from '../lib/aiCommands'
import { moveVertsBy, deleteVerticesFromSoup } from '../lib/vertexSelect'
import { domeSoup } from '../lib/dome'
import { symmetrizeSoup } from '../lib/symmetrize'
import { bestPrintOrientation, rotateSoup } from '../lib/printOrient'
import type { Axis } from '../lib/castCheck'

export interface PaveFillOptions {
  count: number
  mode: PaveMode
  carat: number
  gap: number
  shapeId?: string
  center?: [number, number, number]
  y?: number
  radius?: number
  arcDeg?: number
  cutSeats?: boolean
  baseId?: string
  /** Drop each stone onto the actual surface of the base part (raycast down). */
  snapToSurface?: boolean
}

export interface ChannelRailOptions {
  center: [number, number, number]
  length: number
  innerGap: number
  height: number
  thickness: number
  along: RailAlong
}

export type PrimitiveKind = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'tube'
export type JewelryKind = 'shank' | 'gem' | 'head' | 'bezel'
export type SculptKind = PrimitiveKind | JewelryKind
export type SculptMaterial = 'metal' | 'gem'
export type TransformMode = 'translate' | 'rotate' | 'scale'
export type EditMode = 'object' | 'vertex' | 'surface'
/** In Vertices mode: 'select' highlights only; 'edit' left-click-drags a vertex;
 *  'add' single-clicks to add a vertex; 'remove' double-clicks to delete one. */
export type VertexTool = 'select' | 'edit' | 'add' | 'remove' | 'lasso'
export type SurfaceOp = 'emboss' | 'cut'
export type ShankProfile = 'round' | 'flat' | 'dshape' | 'knife' | 'comfort'

/** A free-drawn profile that stays editable — geometry is regenerated from it. */
export interface SketchDef {
  points: [number, number][]   // mm, profile outline
  mode: SketchMode             // revolve (around Y) or extrude (along Z)
  depth: number                // extrude depth, mm
  segments: number             // revolve resolution
  arc?: number                 // revolve sweep, degrees (default 360)
}

/** Parameters for the jewelry-native builders and the free-draw sketch. */
export interface SculptParams {
  ringSize?: number       // shank — US size
  profile?: ShankProfile  // shank
  width?: number          // shank / bezel — mm
  thickness?: number      // shank — mm
  shapeId?: string        // gem — stone shape
  stoneTypeId?: string    // gem — stone material (for pricing)
  carat?: number          // gem
  prongs?: number         // head
  stoneW?: number         // head / bezel — stone width mm
  height?: number         // head / bezel — mm
  wall?: number           // bezel wall — mm
  sketch?: SketchDef      // 'sketch' — a live, re-editable free-draw profile
}

export interface SculptObject {
  id: string
  kind: SculptKind | 'mesh' | 'sketch'
  name: string
  position: [number, number, number]
  rotation: [number, number, number]   // radians
  scale: [number, number, number]
  size: number
  material: SculptMaterial
  color: number
  params?: SculptParams
  vertices?: number[]                   // baked positions for 'mesh' (boolean) results
}

const GOLD = 0xD8B36A
const GEM = 0x8FD0E8
export const SCULPT_COLORS = { metal: GOLD, gem: GEM }

const LABEL: Record<SculptKind, string> = {
  box: 'Box', sphere: 'Sphere', cylinder: 'Cylinder', cone: 'Cone', torus: 'Torus', tube: 'Tube',
  shank: 'Shank', gem: 'Gem', head: 'Prong head', bezel: 'Bezel'
}

const TWO_PI = Math.PI * 2

/** Per-kind spawn defaults. */
function defaults(kind: SculptKind): Pick<SculptObject, 'position' | 'size' | 'material' | 'color' | 'params'> {
  switch (kind) {
    case 'shank':
      return { position: [0, 0, 0], size: 6, material: 'metal', color: GOLD, params: { ringSize: 7, profile: 'round', width: 2.2, thickness: 1.8 } }
    case 'gem':
      return { position: [0, 6, 0], size: 6, material: 'gem', color: GEM, params: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1 } }
    case 'head':
      return { position: [0, 6, 0], size: 6, material: 'metal', color: GOLD, params: { prongs: 4, stoneW: 6.5, height: 4 } }
    case 'bezel':
      return { position: [0, 6, 0], size: 6, material: 'metal', color: GOLD, params: { stoneW: 6.5, height: 3, wall: 0.6 } }
    case 'torus':
    case 'tube':
      return { position: [0, 1.5, 0], size: 6, material: 'metal', color: GOLD }
    default:
      return { position: [0, 3, 0], size: 6, material: 'metal', color: GOLD }
  }
}

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return c?.randomUUID ? c.randomUUID() : 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

/** Apply a soup→soup deform to an object, baking a primitive to an editable
 *  mesh (in world space, transforms reset) first if it isn't one already. */
function deformObject(o: SculptObject, fn: (v: number[]) => number[]): SculptObject {
  const verts = o.kind === 'mesh' && o.vertices ? o.vertices : bakedVertices(o)
  return { ...o, kind: 'mesh', vertices: fn(verts), position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
}

interface ModelerStore {
  objects: SculptObject[]
  selectedId: string | null
  mode: TransformMode
  editMode: EditMode
  vertexTool: VertexTool
  selectedVertex: number | null
  /** Multi-vertex selection (lasso) — vertex indices into the editable mesh. */
  selectedVerts: number[]
  falloff: number
  alloyId: string
  snap: boolean
  measuring: boolean
  heatmap: boolean
  symmetry: boolean
  surfaceOp: SurfaceOp
  brush: number
  past: SculptObject[][]
  future: SculptObject[][]
  undo: () => void
  redo: () => void
  setEditMode: (m: EditMode) => void
  setVertexTool: (t: VertexTool) => void
  pickVertex: (i: number | null) => void
  setSelectedVerts: (idx: number[]) => void
  moveVertsGroup: (id: string, indices: number[], delta: [number, number, number]) => void
  deleteVertsGroup: (id: string, indices: number[]) => void
  setFalloff: (r: number) => void
  setSurfaceOp: (op: SurfaceOp) => void
  setBrush: (r: number) => void
  applySurfaceStroke: (targetId: string, points: [number, number, number][], op: SurfaceOp, radius: number) => void
  toggleSymmetry: () => void
  bakeToMesh: (id: string) => void
  subdivideMesh: (id: string) => void
  smoothMesh: (id: string, radius: number) => void
  twistMesh: (id: string, degrees: number) => void
  taperMesh: (id: string, factor: number) => void
  bendMesh: (id: string, degrees: number) => void
  fuseMetal: () => number
  /** Weld/cap every metal mesh part so the whole piece is print/cast ready.
   *  Returns aggregate repair stats (one undo step). Primitives are already clean. */
  fixForPrint: () => { parts: number; welded: number; degenerate: number; duplicate: number; holes: number; watertight: boolean }
  /** Drop an imported mesh (e.g. from an STL) onto the bench, recentred & on the
   *  floor so it's visible. Returns the new part id (or null if empty). */
  importMesh: (vertices: number[], name?: string) => string | null
  /** Add a finding (clasp, jump ring, bail, post/back, toggle…) as a metal part. */
  addFinding: (id: string) => string | null
  /** Resize a parametric shank to a target US finger size. Returns the applied
   *  size, or null if there's no resizable shank. */
  resizeRing: (shankId: string, toSize: number) => number | null
  /** Add a stone mount (prong head / bezel) as an editable part, sized to a stone. */
  addMount: (style: string, stoneMm?: number) => string | null
  /** Stamp the alloy purity hallmark (+ optional maker's mark) inside a band. */
  stampHallmark: (shankId: string, makersMark?: string) => boolean
  /** Mirror the whole assembly into a matched second piece (earring pair). */
  makeMatchedPair: () => number
  /** Build a real sprue tree beside the piece: a central rod, N copies on sprues,
   *  and a feed button — the layout you send to casting. Returns parts added. */
  buildCastingTree: (count: number) => number
  /** Repair: add retip beads at a head's prong tips. */
  retipProngs: (headId: string) => number
  /** Add a basket (two galleries + wires) under the selected head or stone. */
  addBasket: (id: string) => boolean
  /** Add a pronged head with a cut bearing seat, sized to the selected head/stone. */
  seatHead: (id: string, prongs?: number) => boolean
  /** Repair: replace a shank with a fresh parametric band at the same size. */
  replaceShank: (shankId: string) => boolean
  /** Version history — named snapshots of the whole bench (in-memory this session). */
  snapshots: { id: string; name: string; at: number; objects: SculptObject[]; alloyId: string }[]
  saveSnapshot: (name?: string) => string
  restoreSnapshot: (id: string) => boolean
  deleteSnapshot: (id: string) => void
  /** Exploded-view spread (mm). 0 = assembled; view-only, not persisted. */
  explode: number
  setExplode: (v: number) => void
  /** Lighting environment for the modeler stage (drei preset). View-only. */
  envPreset: string
  setEnvPreset: (p: string) => void
  engraveOnPart: (targetId: string, text: string, font: string, op: SurfaceOp) => boolean
  wrapTextOnBand: (targetId: string, text: string, font: string, op: SurfaceOp, angleDeg?: number, inside?: boolean) => boolean
  toggleSnap: () => void
  toggleMeasuring: () => void
  toggleHeatmap: () => void
  mirror: (id: string) => void
  centerObject: (id: string) => void
  dropToFloor: (id: string) => void
  scaleAll: (factor: number) => void
  sketching: boolean
  sketchEditId: string | null
  setSketching: (on: boolean, editId?: string | null) => void
  /** True 3D free-form building: place vertices anywhere in space (no 2D
   *  template/profile) and connect them in click order into a solid wire. */
  sketching3D: boolean
  sketch3DPoints: [number, number, number][]
  sketch3DWire: number
  sketch3DClosed: boolean
  /** Fill the interior of a closed loop with a solid panel instead of leaving
   *  it a hollow wire outline — on by default so snapping the ends together
   *  "just builds the shape"; switch off for a plain closed band/ring. */
  sketch3DFill: boolean
  /** Per-edge style (straight/curved + its own width & height), index i is
   *  the edge from point i to point i+1 (or the closing edge at the last
   *  index once the shape is closed). Kept in sync with sketch3DPoints. */
  sketch3DSegs: Seg3DStyle[]
  setSketching3D: (on: boolean) => void
  add3DPoint: (p: [number, number, number]) => void
  move3DPoint: (i: number, p: [number, number, number]) => void
  remove3DPoint: (i: number) => void
  undo3DPoint: () => void
  clear3DPoints: () => void
  set3DWire: (mm: number) => void
  toggle3DClosed: () => void
  set3DClosed: (v: boolean) => void
  toggle3DFill: () => void
  setSeg3DCurved: (i: number, curved: boolean) => void
  setSeg3DThickness: (i: number, mm: number) => void
  setSeg3DDepth: (i: number, mm: number) => void
  /** Build the solid from the placed points and add it to the bench; returns
   *  the new object's id (or null if there weren't enough points). */
  finish3DSketch: () => string | null
  cancel3DSketch: () => void
  addSketch: (sketch: SketchDef) => string
  setObjectSketch: (id: string, sketch: SketchDef) => void
  loftSketches: (idA: string, idB: string, length?: number) => string | null
  sketchPresets: SketchPreset[]
  saveSketchPreset: (name: string, sketch: SketchDef) => void
  applySketchPreset: (preset: SketchPreset) => string
  deleteSketchPreset: (id: string) => void
  add: (kind: SculptKind) => void
  addPart: (kind: SculptKind, params: Partial<SculptParams>, name?: string) => void
  addObjects: (objs: Array<Omit<SculptObject, 'id' | 'name'> & { name?: string }>) => void
  addMesh: (obj: Omit<SculptObject, 'id' | 'name'> & { name?: string }) => string
  update: (id: string, patch: Partial<SculptObject>) => void
  updateParams: (id: string, patch: Partial<SculptParams>) => void
  remove: (id: string) => void
  duplicate: (id: string) => void
  arrayCircular: (id: string, count: number) => void
  arrayLinear: (id: string, count: number, spacing: number) => void
  paveFill: (opts: PaveFillOptions) => number
  fitHead: (gemId: string, prongs: number) => boolean
  fitBezel: (gemId: string) => boolean
  drillHole: (id: string, axis: 'x' | 'y' | 'z', diameter: number) => boolean
  addBail: (id: string, ringMm?: number) => boolean
  addHalo: (gemId: string, count: number, smallCarat: number) => number
  addChannelRails: (opts: ChannelRailOptions) => boolean
  flushSet: (gemId: string) => boolean
  /** Cut a real bearing/seat under a stone (pavilion clearance + girdle ledge)
   *  into the metal below it, WITHOUT sinking the stone — for prong/bezel sets. */
  seatStone: (gemId: string) => boolean
  textureMesh: (id: string, style: TextureStyle, amp: number, scale: number) => boolean
  addMilgrain: (center: [number, number, number], radius: number, beadDia: number) => number
  bridgeWire: (aId: string, bId: string, wire: number) => boolean
  piercePattern: (id: string, count: number, mode: 'row' | 'ring', span: number, dia: number, axis: 'x' | 'y' | 'z') => number
  addSignet: (id: string, width: number, length: number, thickness: number) => boolean
  assembleDesign: (patch: AiDesignPatch, replace?: boolean) => number
  /** Signature of the studio design the current bench was imported from, or null
   *  if the bench was never imported (hand-built) this session. In-memory only. */
  importedSig: string | null
  /** Bring the current AI/Design-studio piece into the modeler as editable parts. */
  importFromDesign: (spec: DesignSpec, replace?: boolean) => number
  runModelerCommands: (cmds: ModelerCommand[]) => { applied: string[]; skipped: string[] }
  /** A stone type armed for click-to-place on the stage (null = not placing). */
  placing: { stoneId: string; shapeId: string; carat: number; color?: number } | null
  setPlacing: (p: { stoneId: string; shapeId: string; carat: number; color?: number } | null) => void
  addStone: (opts: { stoneId: string; shapeId: string; carat: number; position?: [number, number, number]; color?: number }) => string
  domeTop: (id: string, height: number) => boolean
  addSizingBeads: (id: string) => boolean
  symmetrizeMesh: (id: string, axis: Axis) => boolean
  autoOrientForPrint: () => number
  addGallery: (id: string) => boolean
  subtractFromAll: (cutterId: string) => number
  select: (id: string | null) => void
  setMode: (mode: TransformMode) => void
  setAlloy: (id: string) => void
  clear: () => void
  load: (objects: SculptObject[]) => void
}

const HISTORY_LIMIT = 60

const SNAP_KEY = 'mandrel.snapshots.v1'
type Snap = { id: string; name: string; at: number; objects: SculptObject[]; alloyId: string }
function loadSnaps(): Snap[] {
  try { const raw = localStorage.getItem(SNAP_KEY); return raw ? JSON.parse(raw) as Snap[] : [] } catch { return [] }
}
function saveSnaps(list: Snap[]): void {
  // Geometry can be large — trim to the most recent that fit under the quota.
  for (let n = list.length; n >= 0; n--) {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(0, n))); return } catch { /* quota — try fewer */ }
  }
}

export const useModeler = create<ModelerStore>((set, get) => {
  // When batching (a whole AI command run), inner actions' record() calls are
  // suppressed so the entire run collapses into ONE undo step.
  let batching = false
  /** Snapshot the current objects onto the undo stack before a mutation. */
  const record = () => { if (batching) return; set(s => ({ past: [...s.past, s.objects].slice(-HISTORY_LIMIT), future: [] })) }
  const stillThere = (id: string | null, objs: SculptObject[]) => (id && objs.some(o => o.id === id) ? id : null)

  return {
  objects: [],
  selectedId: null,
  mode: 'translate',
  editMode: 'object',
  vertexTool: 'edit',
  selectedVertex: null,
  selectedVerts: [],
  falloff: 2.5,
  alloyId: '14ky',
  snap: false,
  measuring: false,
  heatmap: false,
  symmetry: false,
  surfaceOp: 'emboss',
  brush: 0.6,
  sketching: false,
  sketchEditId: null,
  sketching3D: false,
  sketch3DPoints: [],
  sketch3DWire: 1.2,
  sketch3DClosed: false,
  sketch3DFill: true,
  sketch3DSegs: [],
  past: [],
  future: [],
  importedSig: null,
  explode: 0,
  envPreset: 'studio',
  snapshots: loadSnaps(),
  placing: null,

  undo: () => set(s => {
    if (!s.past.length) return {}
    const prev = s.past[s.past.length - 1]
    return { objects: prev, past: s.past.slice(0, -1), future: [s.objects, ...s.future].slice(0, HISTORY_LIMIT), selectedId: stillThere(s.selectedId, prev) }
  }),
  redo: () => set(s => {
    if (!s.future.length) return {}
    const next = s.future[0]
    return { objects: next, future: s.future.slice(1), past: [...s.past, s.objects].slice(-HISTORY_LIMIT), selectedId: stillThere(s.selectedId, next) }
  }),

  setEditMode: editMode => set({ editMode, selectedVertex: editMode === 'vertex' ? get().selectedVertex : null, selectedVerts: editMode === 'vertex' ? get().selectedVerts : [] }),
  // Choosing Select or Edit implies you're in Vertices mode.
  setVertexTool: vertexTool => set({ vertexTool, editMode: 'vertex' }),
  pickVertex: selectedVertex => set({ selectedVertex }),
  setSelectedVerts: selectedVerts => set({ selectedVerts }),
  moveVertsGroup: (id, indices, delta) => {
    if (!indices.length) return
    record()
    set(s => ({ objects: s.objects.map(o => o.id === id && o.vertices ? { ...o, vertices: moveVertsBy(o.vertices, indices, delta) } : o) }))
  },
  deleteVertsGroup: (id, indices) => {
    if (!indices.length) return
    record()
    set(s => ({ objects: s.objects.map(o => o.id === id && o.vertices ? { ...o, vertices: deleteVerticesFromSoup(o.vertices, indices) } : o), selectedVerts: [] }))
  },
  setFalloff: falloff => set({ falloff: Math.max(0.2, falloff) }),
  setSurfaceOp: surfaceOp => set({ surfaceOp }),
  setBrush: brush => set({ brush: Math.max(0.15, brush) }),
  toggleSymmetry: () => set(s => ({ symmetry: !s.symmetry })),

  /** Auto-place 3D text on a part's top face and engrave (subtract) or emboss
   *  (union) it. Returns whether it applied. */
  engraveOnPart: (targetId, text, font, op) => {
    const target = get().objects.find(o => o.id === targetId)
    if (!target) return false
    const raw = textVertices(text, font, 10, 1.2)
    const placed = positionTextVertices(raw, target, op === 'cut' ? 'cut' : 'emboss')
    if (!placed.length) return false
    const textObj: SculptObject = { id: 'engrave', kind: 'mesh', name: 'text', vertices: placed, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: 0 }
    record()
    try {
      const result = booleanOp(target, textObj, op === 'cut' ? 'subtract' : 'union')
      if (!result.length) return false
      set(s => ({ objects: s.objects.map(o => o.id === targetId ? { ...o, kind: 'mesh', vertices: result, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 } : o) }))
      return true
    } catch { return false }
  },

  /** Wrap text around a band-like part (in the XY plane) and engrave or emboss it.
   *  angleDeg centres the run around the band; inside places it on the inner face. */
  wrapTextOnBand: (targetId, text, font, op, angleDeg = 90, inside = false) => {
    const target = get().objects.find(o => o.id === targetId)
    if (!target) return false
    const bg = bakedGeometry(target); bg.computeBoundingBox()
    const b = bg.boundingBox!
    const bandW = b.max.z - b.min.z
    const cx = (b.max.x + b.min.x) / 2, cy = (b.max.y + b.min.y) / 2, cz = (b.max.z + b.min.z) / 2
    // exact inner/outer radius of the ring, measured from its own centre in XY
    const pos = bg.getAttribute('position')
    let outerR = 0, innerR = Infinity
    for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i) - cx, pos.getY(i) - cy); if (r > outerR) outerR = r; if (r < innerR) innerR = r }
    bg.dispose()
    const radius = inside ? innerR : outerR
    if (radius < 1) return false
    const size = Math.min(4, Math.max(0.8, bandW * 0.5))
    const verts = curvedTextVertices(text, font, radius, size, 1.2, !inside, angleDeg * Math.PI / 180)
    if (!verts.length) return false
    for (let i = 0; i < verts.length; i += 3) { verts[i] += cx; verts[i + 1] += cy; verts[i + 2] += cz }   // to the band centre
    const textObj: SculptObject = { id: 'wrap', kind: 'mesh', name: 'text', vertices: verts, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: 0 }
    record()
    try {
      const result = booleanOp(target, textObj, op === 'cut' ? 'subtract' : 'union')
      if (!result.length) return false
      set(s => ({ objects: s.objects.map(o => o.id === targetId ? { ...o, kind: 'mesh', vertices: result, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 } : o) }))
      return true
    } catch { return false }
  },

  /** Emboss (union) or cut (subtract) a tube swept along a surface stroke. */
  applySurfaceStroke: (targetId, points, op, radius) => {
    const target = get().objects.find(o => o.id === targetId)
    if (!target || points.length < 2) return
    const tubeVerts = strokeTubeVertices(points, radius)
    if (!tubeVerts.length) return
    const tube: SculptObject = { id: 'stroke', kind: 'mesh', name: 'stroke', vertices: tubeVerts, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: 0 }
    record()
    try {
      const result = booleanOp(target, tube, op === 'cut' ? 'subtract' : 'union')
      if (result.length) set(s => ({
        objects: s.objects.map(o => o.id === targetId
          ? { ...o, kind: 'mesh', vertices: result, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
          : o)
      }))
    } catch { /* boolean failed on this geometry */ }
  },

  /** Flatten any part/primitive into an editable triangle mesh at identity
   *  transform, so its vertices can be pushed and pulled directly. */
  bakeToMesh: id => { record(); set(s => ({
    objects: s.objects.map(o => o.id === id
      ? { ...o, kind: 'mesh', vertices: bakedVertices(o), position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
      : o)
  })) },

  /** Refine an editable mesh (each triangle → four) for finer vertex control. */
  subdivideMesh: id => { record(); set(s => ({
    objects: s.objects.map(o => o.id === id && o.kind === 'mesh' && o.vertices ? { ...o, vertices: subdivideSoup(o.vertices) } : o)
  })) },

  /** Relax an editable mesh one pass, smoothing lumps from aggressive pulls. */
  smoothMesh: (id, radius) => { record(); set(s => ({
    objects: s.objects.map(o => o.id === id && o.kind === 'mesh' && o.vertices ? { ...o, vertices: smoothSoup(o.vertices, radius) } : o)
  })) },

  /** Free-form deformers. A primitive is baked to an editable mesh first (in
   *  world space), then the deform is applied about its own bounding box. */
  twistMesh: (id, degrees) => { record(); set(s => ({ objects: s.objects.map(o => o.id === id ? deformObject(o, v => twistSoup(v, degrees)) : o) })) },
  taperMesh: (id, factor) => { record(); set(s => ({ objects: s.objects.map(o => o.id === id ? deformObject(o, v => taperSoup(v, factor)) : o) })) },
  bendMesh: (id, degrees) => { record(); set(s => ({ objects: s.objects.map(o => o.id === id ? deformObject(o, v => bendSoup(v, degrees)) : o) })) },

  /** Boolean-union every metal part into one watertight mesh for clean STL /
   *  3D-print export. Gems are left untouched. Returns the count fused. */
  fuseMetal: () => {
    const metals = get().objects.filter(o => o.material === 'metal')
    if (metals.length < 2) return 0
    record()
    let acc: SculptObject = { ...metals[0], kind: 'mesh', vertices: bakedVertices(metals[0]), position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
    for (let i = 1; i < metals.length; i++) {
      try {
        const v = booleanOp(acc, metals[i], 'union')
        if (v.length) acc = { ...acc, vertices: v }
      } catch { /* skip a part that fails to union; keep the rest */ }
    }
    const fused: SculptObject = { id: newId(), kind: 'mesh', name: 'Fused metal', vertices: acc.vertices, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: metals[0].color }
    set(s => ({ objects: [...s.objects.filter(o => o.material !== 'metal'), fused], selectedId: fused.id }))
    return metals.length
  },

  fixForPrint: () => {
    const objs = get().objects
    const targets = objs.filter(o => o.material === 'metal' && o.kind === 'mesh' && o.vertices && o.vertices.length >= 9)
    let welded = 0, degenerate = 0, duplicate = 0, holes = 0, allTight = true
    if (!targets.length) {
      // Nothing baked to repair — primitives are watertight by construction.
      return { parts: 0, welded: 0, degenerate: 0, duplicate: 0, holes: 0, watertight: true }
    }
    record()
    const patched = new Map<string, number[]>()
    for (const o of targets) {
      const { vertices, stats } = repairMesh(o.vertices!)
      patched.set(o.id, vertices)
      welded += stats.weldedVertices
      degenerate += stats.removedDegenerate
      duplicate += stats.removedDuplicate
      holes += stats.holesFilled
      if (!stats.watertight) allTight = false
    }
    set(s => ({ objects: s.objects.map(o => patched.has(o.id) ? { ...o, vertices: patched.get(o.id)! } : o) }))
    return { parts: targets.length, welded, degenerate, duplicate, holes, watertight: allTight }
  },

  importMesh: (vertices, name) => {
    if (!vertices || vertices.length < 9) return null
    // Recentre on X/Z and drop the lowest point to y=0 so it lands on the stage.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, minZ = Infinity, maxZ = -Infinity
    for (let i = 0; i < vertices.length; i += 3) {
      minX = Math.min(minX, vertices[i]); maxX = Math.max(maxX, vertices[i])
      minY = Math.min(minY, vertices[i + 1])
      minZ = Math.min(minZ, vertices[i + 2]); maxZ = Math.max(maxZ, vertices[i + 2])
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2
    const v = vertices.slice()
    for (let i = 0; i < v.length; i += 3) { v[i] -= cx; v[i + 1] -= minY; v[i + 2] -= cz }
    record()
    const obj: SculptObject = {
      id: newId(), kind: 'mesh', name: name || 'Imported mesh', vertices: v,
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: GOLD,
    }
    set(s => ({ objects: [...s.objects, obj], selectedId: obj.id }))
    return obj.id
  },

  addFinding: id => {
    const v = findingVertices(id)
    if (v.length < 9) return null
    record()
    const name = findingById(id)?.name ?? 'Finding'
    // drop it just above the floor and slightly to the side so it's visible
    const obj: SculptObject = { id: newId(), kind: 'mesh', name, vertices: v, position: [10, 4, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: GOLD }
    set(s => ({ objects: [...s.objects, obj], selectedId: obj.id }))
    return obj.id
  },
  setExplode: v => set({ explode: Math.max(0, v) }),
  setEnvPreset: p => set({ envPreset: p }),

  resizeRing: (shankId, toSize) => {
    const shank = get().objects.find(o => o.id === shankId && o.kind === 'shank')
    if (!shank || typeof shank.params?.ringSize !== 'number') return null
    const to = Math.min(RING_SIZE_MAX, Math.max(RING_SIZE_MIN, Math.round(toSize * 4) / 4))
    if (to === shank.params.ringSize) return to
    record()
    set(s => ({ objects: s.objects.map(o => o.id === shankId ? { ...o, params: { ...o.params, ringSize: to } } : o) }))
    return to
  },

  addMount: (style, stoneMm) => {
    const w = stoneMm && stoneMm > 0 ? stoneMm : 6.5   // ~1 ct round default
    record()
    let obj: SculptObject
    if (style === 'bz' || style === 'hb') {
      const h = Math.max(2, w * 0.5)
      obj = { id: newId(), kind: 'bezel', name: style === 'hb' ? 'Half bezel' : 'Bezel', position: [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: GOLD, params: { stoneW: w, height: h, wall: Math.max(0.4, w * 0.09) } }
    } else {
      const prongs = style === 'p6' ? 6 : style === 'p8' ? 8 : style === 'dc' ? 8 : 4
      const h = Math.max(3, w * 0.62)
      obj = { id: newId(), kind: 'head', name: `${prongs}-prong head`, position: [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: GOLD, params: { prongs, stoneW: w, height: h } }
    }
    set(s => ({ objects: [...s.objects, obj], selectedId: obj.id }))
    return obj.id
  },

  makeMatchedPair: () => {
    const src = get().objects
    if (!src.length) return 0
    // Overall X span → offset the mirrored copy clear of the original.
    let minX = Infinity, maxX = -Infinity
    for (const o of src) { const v = bakedVertices(o); for (let i = 0; i < v.length; i += 3) { minX = Math.min(minX, v[i]); maxX = Math.max(maxX, v[i]) } }
    const span = isFinite(maxX - minX) ? maxX - minX : 12
    const gap = span + Math.max(4, span * 0.3)
    record()
    const mirrored: SculptObject[] = src.map(o => ({
      ...o,
      id: newId(),
      name: `${o.name} (R)`,
      vertices: o.vertices ? [...o.vertices] : undefined,
      // mirror across X, then shift the whole copy to the side
      position: [-o.position[0] + gap, o.position[1], o.position[2]],
      scale: [-o.scale[0], o.scale[1], o.scale[2]],
    }))
    set(s => ({ objects: [...s.objects, ...mirrored], selectedId: mirrored[0]?.id ?? s.selectedId }))
    return mirrored.length
  },

  buildCastingTree: count => {
    const metal = get().objects.filter(o => o.material === 'metal')
    if (!metal.length) return 0
    const n = Math.max(1, Math.min(24, Math.round(count)))
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const o of metal) { const v = bakedVertices(o); for (let i = 0; i < v.length; i += 3) { minX = Math.min(minX, v[i]); maxX = Math.max(maxX, v[i]); minY = Math.min(minY, v[i + 1]); maxY = Math.max(maxY, v[i + 1]); minZ = Math.min(minZ, v[i + 2]); maxZ = Math.max(maxZ, v[i + 2]) } }
    if (!isFinite(minX)) return 0
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2
    const w = maxX - minX, h = maxY - minY, d = maxZ - minZ
    const pieceR = Math.max(w, d) / 2
    const rodR = Math.max(1.2, pieceR * 0.14)
    const R = pieceR + 5 + rodR
    const levelH = Math.max(6, h + 4)
    const treeH = 12 + n * levelH
    const TX = cx + w / 2 + R + 14, TZ = cz    // tree to the side, clear of the piece

    record()
    const add: SculptObject[] = []
    // Central sprue rod.
    add.push({ id: newId(), kind: 'cylinder', name: 'Sprue rod', position: [TX, treeH / 2, TZ], rotation: [0, 0, 0], scale: [rodR * 2, treeH, rodR * 2], size: 1, material: 'metal', color: metal[0].color })
    // Feed button at the base.
    add.push({ id: newId(), kind: 'cylinder', name: 'Button', position: [TX, 2, TZ], rotation: [0, 0, 0], scale: [rodR * 3.4, 4, rodR * 3.4], size: 1, material: 'metal', color: metal[0].color })
    for (let i = 0; i < n; i++) {
      const a = i * 2.399963 // golden angle, spirals copies around the rod
      const y = 12 + i * levelH
      const ccx = TX + Math.cos(a) * R, ccz = TZ + Math.sin(a) * R
      for (const o of metal) {
        add.push({ ...o, id: newId(), name: `${o.name} #${i + 1}`, vertices: o.vertices ? [...o.vertices] : undefined,
          position: [o.position[0] - cx + ccx, o.position[1] - cy + y, o.position[2] - cz + ccz] })
      }
      // Sprue: a bar from the rod out to this copy.
      const g = Math.max(0.8, rodR * 0.7)
      add.push({ id: newId(), kind: 'box', name: `Sprue ${i + 1}`, position: [TX + Math.cos(a) * R / 2, y, TZ + Math.sin(a) * R / 2], rotation: [0, -a, 0], scale: [R, g, g], size: 1, material: 'metal', color: metal[0].color })
    }
    set(s => ({ objects: [...s.objects, ...add], selectedId: add[0].id }))
    return add.length
  },

  stampHallmark: (shankId, makersMark) => {
    const shank = get().objects.find(o => o.id === shankId)
    if (!shank) return false
    const hall = alloyById(get().alloyId).hallmark
    const mark = `${hall}${makersMark && makersMark.trim() ? '   ' + makersMark.trim() : ''}`
    // Cut it into the inside of the band, seated at the base (270°).
    return get().wrapTextOnBand(shankId, mark, 'Serif', 'cut', 270, true)
  },

  addBasket: id => {
    const src = get().objects.find(o => o.id === id)
    if (!src) return false
    const topR = src.kind === 'gem' ? gemDiameterMm(src) * 0.48 : (src.params?.stoneW ?? 6.5) / 2 * 0.95
    const height = Math.max(2.5, topR * 1.2)
    const [x, y, z] = src.position
    // seat the basket just under the head/stone
    const topY = y - (src.params?.height ? (src.params.height as number) * 0.35 : (src.kind === 'gem' ? gemDiameterMm(src) * 0.4 : 1.5))
    record()
    const basket: SculptObject = {
      id: newId(), kind: 'mesh', name: 'Basket', vertices: basketVertices(topR, height, 4),
      position: [x, topY, z], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: src.material === 'metal' ? src.color : GOLD,
    }
    set(s => ({ objects: [...s.objects, basket], selectedId: basket.id }))
    return true
  },

  seatHead: (id, prongs = 4) => {
    const src = get().objects.find(o => o.id === id)
    if (!src) return false
    const stoneMm = src.kind === 'gem' ? gemDiameterMm(src) : (src.params?.stoneW ?? 6.5)
    const n = Math.max(3, Math.round(prongs))
    const [x, y, z] = src.position
    record()
    const head: SculptObject = {
      id: newId(), kind: 'mesh', name: `${n}-prong seat`, vertices: prongsWithSeatsVertices(stoneMm, n),
      position: [x, y - stoneMm * 0.55, z], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal',
      color: src.material === 'metal' ? src.color : GOLD,
    }
    set(s => ({ objects: [...s.objects, head], selectedId: head.id }))
    return true
  },

  retipProngs: headId => {
    const head = get().objects.find(o => o.id === headId && o.kind === 'head')
    if (!head) return 0
    const prongs = Math.max(3, Math.round(head.params?.prongs ?? 4))
    const w = head.params?.stoneW ?? 6
    const h = head.params?.height ?? 4
    const r = (w / 2) * 0.98
    const topY = head.position[1] + h * 0.45
    record()
    const beads: SculptObject[] = Array.from({ length: prongs }, (_, i) => {
      const a = (i / prongs) * Math.PI * 2
      return {
        id: newId(), kind: 'sphere', name: 'Retip', size: Math.max(0.5, w * 0.11),
        position: [head.position[0] + Math.cos(a) * r, topY, head.position[2] + Math.sin(a) * r],
        rotation: [0, 0, 0], scale: [1, 1, 1], material: 'metal', color: head.color,
      }
    })
    set(s => ({ objects: [...s.objects, ...beads], selectedId: beads[0]?.id ?? s.selectedId }))
    return beads.length
  },

  replaceShank: shankId => {
    const old = get().objects.find(o => o.id === shankId)
    if (!old) return false
    record()
    const fresh: SculptObject = {
      id: newId(), kind: 'shank', name: 'New shank',
      position: old.kind === 'shank' ? old.position : [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6,
      material: 'metal', color: old.color,
      params: {
        ringSize: (old.params?.ringSize as number) ?? 7,
        width: (old.params?.width as number) ?? 2.2,
        thickness: (old.params?.thickness as number) ?? 1.8,
        profile: (old.params?.profile as ShankProfile) ?? 'round',
      },
    }
    set(s => ({ objects: s.objects.map(o => o.id === shankId ? fresh : o), selectedId: fresh.id }))
    return true
  },

  saveSnapshot: name => {
    const id = newId()
    const objs = get().objects.map(o => ({ ...o, vertices: o.vertices ? [...o.vertices] : undefined }))
    const at = Date.now()
    const snap = { id, name: name?.trim() || `v${get().snapshots.length + 1}`, at, objects: objs, alloyId: get().alloyId }
    const next = [snap, ...get().snapshots].slice(0, 30)
    set({ snapshots: next }); saveSnaps(next)
    return id
  },
  restoreSnapshot: id => {
    const snap = get().snapshots.find(x => x.id === id)
    if (!snap) return false
    record()
    set({ objects: snap.objects.map(o => ({ ...o })), selectedId: null, alloyId: snap.alloyId })
    return true
  },
  deleteSnapshot: id => { const next = get().snapshots.filter(x => x.id !== id); set({ snapshots: next }); saveSnaps(next) },

  toggleSnap: () => set(s => ({ snap: !s.snap })),
  toggleMeasuring: () => set(s => ({ measuring: !s.measuring })),
  toggleHeatmap: () => set(s => ({ heatmap: !s.heatmap })),

  mirror: id => {
    const src = get().objects.find(o => o.id === id)
    if (!src) return
    record()
    const copy: SculptObject = { ...src, id: newId(), name: `${src.name} mirror`, position: [-src.position[0], src.position[1], src.position[2]], scale: [-src.scale[0], src.scale[1], src.scale[2]] }
    set(s => ({ objects: [...s.objects, copy], selectedId: copy.id }))
  },

  centerObject: id => { record(); set(s => ({ objects: s.objects.map(o => o.id === id ? { ...o, position: [0, o.position[1], 0] } : o) })) },
  // Seat the object on the floor (y=0): drop it by its lowest world vertex so
  // nothing sits below the build plate — matters for casting/printing setup.
  dropToFloor: id => { record(); set(s => ({ objects: s.objects.map(o => {
    if (o.id !== id) return o
    const v = bakedVertices(o)
    let minY = Infinity
    for (let i = 1; i < v.length; i += 3) if (v[i] < minY) minY = v[i]
    return isFinite(minY) ? { ...o, position: [o.position[0], o.position[1] - minY, o.position[2]] } : o
  }) })) },
  // Uniformly resize the whole piece about the origin (scale + layout), e.g. to
  // hit a target metal weight. Gems scale too, keeping proportions intact.
  scaleAll: factor => {
    if (!(factor > 0) || factor === 1) return
    record()
    set(s => ({ objects: s.objects.map(o => ({
      ...o,
      scale: [o.scale[0] * factor, o.scale[1] * factor, o.scale[2] * factor],
      position: [o.position[0] * factor, o.position[1] * factor, o.position[2] * factor]
    })) }))
  },

  add: kind => {
    record()
    const n = get().objects.filter(o => o.kind === kind).length + 1
    const d = defaults(kind)
    const obj: SculptObject = { id: newId(), kind, name: `${LABEL[kind]} ${n}`, rotation: [0, 0, 0], scale: [1, 1, 1], ...d }
    set(s => ({ objects: [...s.objects, obj], selectedId: obj.id }))
  },

  /** Add a jewelry part pre-configured with params, in a single history step. */
  addPart: (kind, params, name) => {
    record()
    const n = get().objects.filter(o => o.kind === kind).length + 1
    const d = defaults(kind)
    const obj: SculptObject = { id: newId(), kind, name: name ?? `${LABEL[kind as SculptKind]} ${n}`, rotation: [0, 0, 0], scale: [1, 1, 1], ...d, params: { ...d.params, ...params } }
    set(s => ({ objects: [...s.objects, obj], selectedId: obj.id }))
  },

  setSketching: (sketching, editId = null) => set({ sketching, sketchEditId: sketching ? editId : null }),

  // --- Free-form 3D building: no template, just placed points wired together ---
  setSketching3D: on => set({ sketching3D: on, sketch3DPoints: [], sketch3DClosed: false, sketch3DFill: true, sketch3DSegs: [] }),
  add3DPoint: p => set(s => ({
    sketch3DPoints: [...s.sketch3DPoints, p],
    sketch3DSegs: [...s.sketch3DSegs, { curved: false, thickness: s.sketch3DWire, depth: s.sketch3DWire }],
  })),
  move3DPoint: (i, p) => set(s => ({ sketch3DPoints: s.sketch3DPoints.map((q, j) => j === i ? p : q) })),
  remove3DPoint: i => set(s => ({
    sketch3DPoints: s.sketch3DPoints.filter((_, j) => j !== i),
    sketch3DSegs: s.sketch3DSegs.filter((_, j) => j !== i),
  })),
  undo3DPoint: () => set(s => ({ sketch3DPoints: s.sketch3DPoints.slice(0, -1), sketch3DSegs: s.sketch3DSegs.slice(0, -1) })),
  clear3DPoints: () => set({ sketch3DPoints: [], sketch3DSegs: [] }),
  set3DWire: mm => set({ sketch3DWire: Math.max(0.2, mm) }),
  toggle3DClosed: () => set(s => ({ sketch3DClosed: !s.sketch3DClosed })),
  set3DClosed: v => set({ sketch3DClosed: v }),
  toggle3DFill: () => set(s => ({ sketch3DFill: !s.sketch3DFill })),
  setSeg3DCurved: (i, curved) => set(s => ({
    sketch3DSegs: s.sketch3DSegs.map((seg, j) => j === i ? { ...seg, curved } : seg),
  })),
  setSeg3DThickness: (i, mm) => set(s => ({
    sketch3DSegs: s.sketch3DSegs.map((seg, j) => j === i ? { ...seg, thickness: Math.max(0.2, mm) } : seg),
  })),
  setSeg3DDepth: (i, mm) => set(s => ({
    sketch3DSegs: s.sketch3DSegs.map((seg, j) => j === i ? { ...seg, depth: Math.max(0.2, mm) } : seg),
  })),
  finish3DSketch: () => {
    const { sketch3DPoints: pts, sketch3DSegs: segs, sketch3DClosed: closed, sketch3DFill: fill, sketch3DWire: wire } = get()
    let id: string | null = null
    if (pts.length >= 2) {
      const styles = pts.map((_, i) => segs[i] ?? { curved: false, thickness: wire, depth: wire })
      let vertices = buildFree3DTube(pts, styles, closed)
      // The loop closing — by snapping the ends together or ticking Close the
      // loop — implies a real panel, not a hollow outline: fill the interior
      // and fuse it to the wire border into one solid.
      if (closed && fill && pts.length > 2) {
        const fillVerts = buildLoopFillVertices(pts, wire)
        if (fillVerts.length) vertices = vertices.length ? unionTriangleSoups(vertices, fillVerts) : fillVerts
      }
      if (vertices.length) {
        id = get().addMesh({
          kind: 'mesh', vertices, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
          size: 0, material: 'metal', color: GOLD, name: '3D build',
        })
      }
    }
    set({ sketching3D: false, sketch3DPoints: [], sketch3DClosed: false, sketch3DFill: true, sketch3DSegs: [] })
    return id
  },
  cancel3DSketch: () => set({ sketching3D: false, sketch3DPoints: [], sketch3DClosed: false, sketch3DFill: true, sketch3DSegs: [] }),

  /** Create a live, re-editable sketch object from a free-drawn profile. */
  addSketch: sketch => {
    record()
    const id = newId()
    const n = get().objects.filter(o => o.kind === 'sketch').length + 1
    const obj: SculptObject = {
      id, kind: 'sketch', name: `Sketch ${n}`,
      position: [0, sketch.mode === 'extrude' ? 6 : 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      size: 0, material: 'metal', color: GOLD, params: { sketch }
    }
    set(s => ({ objects: [...s.objects, obj], selectedId: id, sketchEditId: id }))   // track it so its 3D nodes show live
    return id
  },

  /** Live-update a sketch object's profile (no history entry — used while drawing). */
  setObjectSketch: (id, sketch) => set(s => ({ objects: s.objects.map(o => o.id === id ? { ...o, params: { ...o.params, sketch } } : o) })),

  /** Loft (blend) two sketch profiles into one mesh; consumes both sources. */
  loftSketches: (idA, idB, length = 8) => {
    const a = get().objects.find(o => o.id === idA), b = get().objects.find(o => o.id === idB)
    if (!a?.params?.sketch || !b?.params?.sketch) return null
    const vertices = loftVertices(a.params.sketch.points, b.params.sketch.points, length)
    if (!vertices.length) return null
    record()
    const id = newId()
    const obj: SculptObject = {
      id, kind: 'mesh', name: 'Loft', vertices,
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: GOLD,
    }
    set(s => ({ objects: [...s.objects.filter(o => o.id !== idA && o.id !== idB), obj], selectedId: id }))
    return id
  },

  /** Saved profile presets: built-ins + the user's own (persisted to localStorage). */
  sketchPresets: allPresets(),
  saveSketchPreset: (name, sketch) => { addUserPreset(name, cloneSketch(sketch)); set({ sketchPresets: allPresets() }) },
  applySketchPreset: preset => get().addSketch(cloneSketch(preset.sketch)),
  deleteSketchPreset: id => { removeUserPreset(id); set({ sketchPresets: allPresets() }) },

  /** Add several parts at once (e.g. a full ring assembly) in one history step. */
  addObjects: objs => {
    if (!objs.length) return
    record()
    const full: SculptObject[] = objs.map((o, i) => ({ id: newId(), name: o.name ?? `Part ${i + 1}`, ...o }))
    set(s => ({ objects: [...s.objects, ...full], selectedId: full[0].id }))
  },

  addMesh: obj => {
    record()
    const id = newId()
    const full: SculptObject = { id, name: obj.name ?? 'Result', ...obj }
    set(s => ({ objects: [...s.objects, full], selectedId: id }))
    return id
  },

  update: (id, patch) => { record(); set(s => ({ objects: s.objects.map(o => o.id === id ? { ...o, ...patch } : o) })) },
  updateParams: (id, patch) => { record(); set(s => ({ objects: s.objects.map(o => o.id === id ? { ...o, params: { ...o.params, ...patch } } : o) })) },

  remove: id => { record(); set(s => ({ objects: s.objects.filter(o => o.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })) },

  duplicate: id => {
    const src = get().objects.find(o => o.id === id)
    if (!src) return
    record()
    const copy: SculptObject = { ...src, id: newId(), name: `${src.name} copy`, position: [src.position[0] + 2, src.position[1], src.position[2] + 2] }
    set(s => ({ objects: [...s.objects, copy], selectedId: copy.id }))
  },

  /** Array around the Y axis at the object's current radius — eternity / halo / pavé rings. */
  arrayCircular: (id, count) => {
    const src = get().objects.find(o => o.id === id)
    if (!src || count < 2) return
    record()
    const [x, y, z] = src.position
    let r = Math.hypot(x, z)
    if (r < 0.5) r = 8   // sitting at the centre — array on a default ring radius
    const a0 = Math.atan2(z, x)
    const copies: SculptObject[] = []
    for (let i = 1; i < count; i++) {
      const a = a0 + (i / count) * TWO_PI
      copies.push({ ...src, id: newId(), name: `${src.name} ${i + 1}`, position: [Math.cos(a) * r, y, Math.sin(a) * r], rotation: [src.rotation[0], -a + Math.PI / 2, src.rotation[2]] })
    }
    if (r === 8 && Math.hypot(x, z) < 0.5) src.position = [r, y, 0]   // move original onto the ring too
    set(s => ({ objects: [...s.objects.map(o => o.id === id ? { ...o, position: src.position } : o), ...copies] }))
  },

  arrayLinear: (id, count, spacing) => {
    const src = get().objects.find(o => o.id === id)
    if (!src || count < 2) return
    record()
    const copies: SculptObject[] = []
    for (let i = 1; i < count; i++) {
      copies.push({ ...src, id: newId(), name: `${src.name} ${i + 1}`, position: [src.position[0] + i * spacing, src.position[1], src.position[2]] })
    }
    set(s => ({ objects: [...s.objects, ...copies] }))
  },

  /**
   * Drop a whole run of pavé/channel stones at once — evenly spaced along a row
   * or around a ring — and optionally carve a seat under each one out of a chosen
   * metal part. This is the tedious-by-hand job the tool should own.
   */
  paveFill: opts => {
    const count = Math.max(0, Math.floor(opts.count))
    if (count === 0) return 0
    const shapeId = opts.shapeId ?? 'rd'
    const carat = opts.carat > 0 ? opts.carat : 0.02
    const diameter = stoneMm(shapeById(shapeId), carat).width
    const center: [number, number, number] = opts.center ?? [0, opts.y ?? 0, 0]

    const spots = paveSpots({
      count, diameter, gap: opts.gap ?? diameter * 0.15, mode: opts.mode,
      center, radius: opts.radius, arcDeg: opts.arcDeg,
    })
    if (!spots.length) return 0
    record()

    // Drop each stone onto the real surface of the base part, if asked, so the
    // run follows a curved band instead of floating at the anchor height.
    const snapBase = opts.snapToSurface && opts.baseId ? get().objects.find(o => o.id === opts.baseId && o.material === 'metal') : undefined
    if (snapBase) {
      const bv = bakedVertices(snapBase)
      for (const s of spots) {
        const y = surfaceTopAt(s.position[0], s.position[2], bv)
        if (y !== null) s.position[1] = y
      }
    }

    // Carve a seat under each stone out of the chosen metal part, if asked.
    let seated = 0
    const base = opts.cutSeats && opts.baseId ? get().objects.find(o => o.id === opts.baseId && o.material === 'metal') : undefined
    let carved: SculptObject | null = null
    if (base) {
      let acc: SculptObject = { ...base, kind: 'mesh', vertices: bakedVertices(base), position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
      for (const s of spots) {
        // a downward cone the width of the stone, its rim at the stone's girdle
        const cutter: SculptObject = { id: 'seatcut', kind: 'cone', name: 'seat', position: [s.position[0], s.position[1], s.position[2]], rotation: [Math.PI, 0, 0], scale: [1, 1, 1], size: diameter * 1.25, material: 'metal', color: 0 }
        try {
          const v = booleanOp(acc, cutter, 'subtract')
          if (v.length) { acc = { ...acc, vertices: v }; seated++ }
        } catch { /* skip a seat that fails; keep carving the rest */ }
      }
      carved = { ...base, kind: 'mesh', vertices: acc.vertices, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
    }

    const gems: SculptObject[] = spots.map((s, i) => ({
      id: newId(), name: `Pavé ${i + 1}`, kind: 'gem',
      position: s.position, rotation: s.rotation, scale: [1, 1, 1], size: 6,
      material: 'gem', color: GEM, params: { shapeId, stoneTypeId: 'dia', carat },
    }))

    set(s => ({
      objects: [
        ...s.objects.map(o => (carved && o.id === carved.id ? carved : o)),
        ...gems,
      ],
      selectedId: gems[0].id,
    }))
    return opts.cutSeats && base ? seated : spots.length
  },

  /** Drop a correctly-sized prong head onto a selected gem — auto-matched to its
   *  girdle so the maker doesn't hand-tune stoneW/position. */
  fitHead: (gemId, prongs) => {
    const gem = get().objects.find(o => o.id === gemId && o.material === 'gem')
    if (!gem) return false
    const stoneW = gemDiameterMm(gem)
    const h = Math.max(3, stoneW * 0.62)
    record()
    const head: SculptObject = {
      id: newId(), name: `${prongs}-prong head`, kind: 'head',
      // seat the gallery just below the gem's girdle
      position: [gem.position[0], gem.position[1] - h * 0.15, gem.position[2]],
      rotation: [0, 0, 0], scale: [1, 1, 1], size: 6,
      material: 'metal', color: GOLD, params: { prongs: Math.max(3, Math.round(prongs)), stoneW, height: h },
    }
    set(s => ({ objects: [...s.objects, head], selectedId: head.id }))
    return true
  },

  /** Wrap a selected gem in a bezel rim sized to its girdle. */
  fitBezel: gemId => {
    const gem = get().objects.find(o => o.id === gemId && o.material === 'gem')
    if (!gem) return false
    const stoneW = gemDiameterMm(gem)
    const height = Math.max(2, stoneW * 0.5)
    record()
    const bezel: SculptObject = {
      id: newId(), name: 'Bezel', kind: 'bezel',
      position: [gem.position[0], gem.position[1] - height * 0.35, gem.position[2]],
      rotation: [0, 0, 0], scale: [1, 1, 1], size: 6,
      material: 'metal', color: GOLD, params: { stoneW, height, wall: Math.max(0.4, stoneW * 0.09) },
    }
    set(s => ({ objects: [...s.objects, bezel], selectedId: bezel.id }))
    return true
  },

  /** Drill a clean through-hole along an axis (sprue/drain/finger holes) by
   *  subtracting a long cylinder from the part. */
  drillHole: (id, axis, diameter) => {
    const src = get().objects.find(o => o.id === id)
    if (!src || diameter <= 0) return false
    const bv = bakedVertices(src)
    if (bv.length < 9) return false
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i + 2 < bv.length; i += 3) {
      minX = Math.min(minX, bv[i]); maxX = Math.max(maxX, bv[i])
      minY = Math.min(minY, bv[i + 1]); maxY = Math.max(maxY, bv[i + 1])
      minZ = Math.min(minZ, bv[i + 2]); maxZ = Math.max(maxZ, bv[i + 2])
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2
    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ) * 1.6 + 4
    // a cylinder is built along Y; rotate to lie along the chosen axis
    const rotation: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
    // size maps to the primitive cylinder's overall scale; tune so radius≈diameter/2
    const drill: SculptObject = {
      id: 'drill', name: 'drill', kind: 'cylinder', position: [cx, cy, cz], rotation,
      scale: [diameter / 2, span / 2, diameter / 2], size: 2, material: 'metal', color: 0,
    }
    record()
    try {
      const base: SculptObject = { ...src, kind: 'mesh', vertices: bv, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
      const v = booleanOp(base, drill, 'subtract')
      if (!v.length) return false
      set(s => ({ objects: s.objects.map(o => o.id === id ? { ...o, kind: 'mesh', vertices: v, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 } : o) }))
      return true
    } catch { return false }
  },

  /** Hang a bail (a torus loop) off the top of a part — for pendants and charms. */
  addBail: (id, ringMm = 3.5) => {
    const src = get().objects.find(o => o.id === id)
    if (!src) return false
    const [tx, ty, tz] = objectTop(src)
    record()
    const bail: SculptObject = {
      id: newId(), name: 'Bail', kind: 'torus',
      // sit the loop just above the top point, standing in the XY plane so its
      // hole runs horizontally (front-to-back) — a chain passes straight through
      position: [tx, ty + ringMm * 0.85, tz], rotation: [0, 0, 0],
      scale: [ringMm / 3, ringMm / 3, ringMm / 3], size: 3,
      material: 'metal', color: GOLD,
    }
    set(s => ({ objects: [...s.objects, bail], selectedId: bail.id }))
    return true
  },

  /** Ring a centre stone with a halo of accents, auto-sized to hug it. */
  addHalo: (gemId, count, smallCarat) => {
    const center = get().objects.find(o => o.id === gemId && o.material === 'gem')
    if (!center || count < 3) return 0
    const carat = smallCarat > 0 ? smallCarat : 0.03
    const centerDia = gemDiameterMm(center)
    const smallDia = stoneMm(shapeById('rd'), carat).width
    const r = haloRadius(centerDia, smallDia, smallDia * 0.1)
    const [cx, cy, cz] = center.position
    record()
    const gems: SculptObject[] = []
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      gems.push({
        id: newId(), name: `Halo ${i + 1}`, kind: 'gem',
        position: [cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r], rotation: [0, -a, 0],
        scale: [1, 1, 1], size: 6, material: 'gem', color: GEM,
        params: { shapeId: 'rd', stoneTypeId: 'dia', carat },
      })
    }
    set(s => ({ objects: [...s.objects, ...gems], selectedId: gems[0].id }))
    return count
  },

  /** Build the two flanking rails of a channel setting. */
  addChannelRails: opts => {
    const spots = channelRailSpots(opts)
    record()
    const rails: SculptObject[] = spots.map((sp, i) => ({
      id: newId(), name: `Rail ${i + 1}`, kind: 'box',
      position: sp.position, rotation: [0, 0, 0], scale: sp.scale, size: 1,
      material: 'metal', color: GOLD,
    }))
    set(s => ({ objects: [...s.objects, ...rails], selectedId: rails[0].id }))
    return true
  },

  /** Flush-/gypsy-set a stone: carve a conical seat into the metal directly under
   *  it and sink the stone so its table sits level with the surface. */
  flushSet: gemId => {
    const gem = get().objects.find(o => o.id === gemId && o.material === 'gem')
    if (!gem) return false
    const [gx, gy, gz] = gem.position
    // pick the metal part whose top surface sits under the stone (highest hit ≤ gem)
    let base: SculptObject | undefined
    let surfaceY = -Infinity
    for (const m of get().objects.filter(o => o.material === 'metal')) {
      const y = surfaceTopAt(gx, gz, bakedVertices(m))
      if (y !== null && y <= gy + 0.5 && y > surfaceY) { surfaceY = y; base = m }
    }
    if (!base || !isFinite(surfaceY)) return false
    const dia = gemDiameterMm(gem)
    record()
    // conical seat, rim at the surface, opening downward into the metal
    const cutter: SculptObject = { id: 'flushcut', kind: 'cone', name: 'seat', position: [gx, surfaceY, gz], rotation: [Math.PI, 0, 0], scale: [1, 1, 1], size: dia * 1.15, material: 'metal', color: 0 }
    let carved: SculptObject | null = null
    try {
      const acc: SculptObject = { ...base, kind: 'mesh', vertices: bakedVertices(base), position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
      const v = booleanOp(acc, cutter, 'subtract')
      if (v.length) carved = { ...base, kind: 'mesh', vertices: v, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
    } catch { /* seat carve failed; still sink the stone */ }
    // sink the stone so its girdle sits just below the surface (table ≈ flush)
    const sunkGem = { ...gem, position: [gx, surfaceY - dia * 0.28, gz] as [number, number, number] }
    set(s => ({
      objects: s.objects.map(o => {
        if (carved && o.id === carved.id) return carved
        if (o.id === gem.id) return sunkGem
        return o
      }),
    }))
    return true
  },

  seatStone: gemId => {
    const gem = get().objects.find(o => o.id === gemId && o.material === 'gem')
    if (!gem) return false
    const [gx, gy, gz] = gem.position
    // The metal whose top surface sits just under the stone gets the bearing.
    let base: SculptObject | undefined
    let surfaceY = -Infinity
    for (const m of get().objects.filter(o => o.material === 'metal')) {
      const y = surfaceTopAt(gx, gz, bakedVertices(m))
      if (y !== null && y <= gy + 0.5 && y > surfaceY) { surfaceY = y; base = m }
    }
    if (!base || !isFinite(surfaceY)) return false
    const dia = gemDiameterMm(gem)
    record()
    // Bearing = a downward cone for pavilion clearance (girdle ledge at the rim),
    // sized to the girdle plus a hair of clearance so the stone drops in clean.
    const cutter: SculptObject = { id: 'seatcut', kind: 'cone', name: 'seat', position: [gx, surfaceY + 0.05, gz], rotation: [Math.PI, 0, 0], scale: [1, 1, 1], size: dia * 1.1, material: 'metal', color: 0 }
    try {
      const acc: SculptObject = { ...base, kind: 'mesh', vertices: bakedVertices(base), position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
      const v = booleanOp(acc, cutter, 'subtract')
      if (!v.length) return false
      const carved: SculptObject = { ...base, kind: 'mesh', vertices: v, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
      set(s => ({ objects: s.objects.map(o => o.id === carved.id ? carved : o) }))
      return true
    } catch { return false }
  },

  /** Displace a metal part's surface with a hammered / stipple / Florentine texture. */
  textureMesh: (id, style, amp, scale) => {
    const src = get().objects.find(o => o.id === id)
    if (!src) return false
    const bv = bakedVertices(src)
    if (bv.length < 9) return false
    record()
    const out = textureSoup(bv, style, amp, scale)
    set(s => ({ objects: s.objects.map(o => o.id === id ? { ...o, kind: 'mesh', vertices: out, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 } : o) }))
    return true
  },

  /** Ring a rim with milgrain beads. */
  addMilgrain: (center, radius, beadDia) => {
    if (radius <= 0 || beadDia <= 0) return 0
    const count = milgrainCount(radius, beadDia)
    const spots = milgrainSpots(radius, count, center[1], center[0], center[2])
    if (!spots.length) return 0
    record()
    const beads: SculptObject[] = spots.map((sp, i) => ({
      id: newId(), name: `Milgrain ${i + 1}`, kind: 'sphere',
      position: sp.position, rotation: [0, 0, 0], scale: [1, 1, 1], size: beadDia,
      material: 'metal', color: GOLD,
    }))
    set(s => ({ objects: [...s.objects, ...beads], selectedId: beads[0].id }))
    return count
  },

  /** Sweep a wire between two parts — a gallery rail or connecting bridge. */
  bridgeWire: (aId, bId, wire) => {
    const a = get().objects.find(o => o.id === aId)
    const b = get().objects.find(o => o.id === bId)
    if (!a || !b || aId === bId) return false
    const path = bridgePath(a.position, b.position)
    const verts = strokeTubeVertices(path, Math.max(0.1, wire) / 2)
    if (!verts.length) return false
    record()
    const tube: SculptObject = { id: newId(), name: 'Bridge wire', kind: 'mesh', vertices: verts, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: GOLD }
    set(s => ({ objects: [...s.objects, tube], selectedId: tube.id }))
    return true
  },

  /** Pierce a row or ring of clean holes through a part (galleries, filigree). */
  piercePattern: (id, count, mode, span, dia, axis) => {
    const src = get().objects.find(o => o.id === id)
    if (!src || count < 1 || dia <= 0) return 0
    const bv = bakedVertices(src)
    if (bv.length < 9) return 0
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i + 2 < bv.length; i += 3) {
      minX = Math.min(minX, bv[i]); maxX = Math.max(maxX, bv[i])
      minY = Math.min(minY, bv[i + 1]); maxY = Math.max(maxY, bv[i + 1])
      minZ = Math.min(minZ, bv[i + 2]); maxZ = Math.max(maxZ, bv[i + 2])
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2
    const length = Math.max(maxX - minX, maxY - minY, maxZ - minZ) * 1.6 + 4
    const rotation: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
    // hole centres laid out in the plane perpendicular to the drill axis
    const spots = paveSpotsFn({ count, diameter: dia, gap: Math.max(0.2, dia), mode: mode === 'ring' ? 'ring' : 'row', center: [cx, cy, cz], radius: mode === 'ring' && span > 0 ? span : undefined })
    record()
    let acc: SculptObject = { ...src, kind: 'mesh', vertices: bv, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }
    let cut = 0
    for (const sp of spots) {
      // map the pavé XZ layout onto the plane perpendicular to the chosen axis
      const p: [number, number, number] = axis === 'y' ? [sp.position[0], cy, sp.position[2]]
        : axis === 'x' ? [cx, sp.position[2], sp.position[0]]
          : [sp.position[0], sp.position[2], cz]
      const drill: SculptObject = { id: 'pierce', name: 'pierce', kind: 'cylinder', position: p, rotation, scale: [dia / 2, length / 2, dia / 2], size: 2, material: 'metal', color: 0 }
      try { const v = booleanOp(acc, drill, 'subtract'); if (v.length) { acc = { ...acc, vertices: v }; cut++ } } catch { /* skip */ }
    }
    if (!cut) return 0
    set(s => ({ objects: s.objects.map(o => o.id === id ? { ...o, kind: 'mesh', vertices: acc.vertices, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 } : o) }))
    return cut
  },

  /** Add a flat oval signet face on top of a part, for engraving. */
  addSignet: (id, width, length, thickness) => {
    const src = get().objects.find(o => o.id === id)
    if (!src || width <= 0 || length <= 0) return false
    const [tx, ty, tz] = objectTop(src)
    record()
    const signet: SculptObject = {
      id: newId(), name: 'Signet face', kind: 'cylinder',
      position: [tx, ty + thickness / 2, tz], rotation: [0, 0, 0],
      scale: [width, thickness, length], size: 1, material: 'metal', color: GOLD,
    }
    set(s => ({ objects: [...s.objects, signet], selectedId: signet.id }))
    return true
  },

  /** Assemble a design patch (from the AI or a preset) into real editable parts. */
  assembleDesign: (patch, replace) => {
    // Repair contradictions and fill the spec to complete, proportioned values
    // before turning it into parts — so assembled pieces are always buildable.
    const { design } = refineDesign(patch)
    const parts = buildSculptFromDesign(design)
    if (!parts.length) return 0
    record()
    const full: SculptObject[] = parts.map((p, i) => ({ ...p, id: newId(), name: p.name ?? `Part ${i + 1}` }))
    set(s => ({ objects: replace ? full : [...s.objects, ...full], selectedId: full[0].id }))
    return full.length
  },

  /** Bring the current parametric design into the modeler as editable parts,
   *  matching its alloy. Flatten → assemble → adopt the alloy for pricing. */
  importFromDesign: (spec, replace) => {
    const n = get().assembleDesign(patchFromSpec(spec), replace ?? true)
    if (n) { get().setAlloy(spec.metal.alloyId); set({ importedSig: designSignature(spec) }) }
    return n
  },

  /** Execute an ordered list of AI-issued finishing/setting commands against the
   *  piece on the bench. Metal ops target the selected (or first) metal part and
   *  gem ops the selected (or first) gem — captured up front so ids stay stable
   *  as parts are added. Returns which ops applied and which were skipped. */
  runModelerCommands: cmds => {
    const applied: string[] = []
    const skipped: string[] = []
    // One undo checkpoint for the whole run, then suppress the inner records.
    if (cmds.length) record()
    batching = true
    const startSel = get().objects.find(o => o.id === get().selectedId) ?? null
    const metalId = (startSel?.material === 'metal' ? startSel : get().objects.find(o => o.material === 'metal'))?.id
    const gemId = (startSel?.material === 'gem' ? startSel : get().objects.find(o => o.material === 'gem'))?.id
    const self = get()
    const ok = (cond: boolean, name: string) => { (cond ? applied : skipped).push(name) }
    for (const c of cmds) {
      try {
        switch (c.op) {
          case 'texture': ok(!!metalId && self.textureMesh(metalId, c.style, c.depth, 1.2), 'texture'); break
          case 'dome': ok(!!metalId && self.domeTop(metalId, c.height), 'dome'); break
          case 'sizingBeads': ok(!!metalId && self.addSizingBeads(metalId), 'sizingBeads'); break
          case 'milgrain': { const b = metalId ? get().objects.find(o => o.id === metalId) : null; ok(self.addMilgrain(b ? b.position : [0, 0, 0], c.radius, c.beadDia) > 0, 'milgrain'); break }
          case 'bail': ok(!!metalId && self.addBail(metalId), 'bail'); break
          case 'drill': ok(!!metalId && self.drillHole(metalId, c.axis, c.dia), 'drill'); break
          case 'pierce': ok(!!metalId && self.piercePattern(metalId, c.count, c.mode, c.mode === 'ring' ? c.dia * 3 : c.dia * 2, c.dia, c.axis) > 0, 'pierce'); break
          case 'flush': ok(!!gemId && self.flushSet(gemId), 'flush'); break
          case 'halo': ok(!!gemId && self.addHalo(gemId, c.count, c.carat) > 0, 'halo'); break
          case 'fitHead': ok(!!gemId && self.fitHead(gemId, c.prongs), 'fitHead'); break
          case 'fitBezel': ok(!!gemId && self.fitBezel(gemId), 'fitBezel'); break
          case 'signet': ok(!!metalId && self.addSignet(metalId, c.width, c.length, c.thickness), 'signet'); break
          case 'symmetrize': ok(!!metalId && self.symmetrizeMesh(metalId, c.axis), 'symmetrize'); break
          case 'autoOrient': ok(self.autoOrientForPrint() >= 0, 'autoOrient'); break
          case 'gallery': ok(!!gemId && self.addGallery(gemId), 'gallery'); break
          case 'subtractAll': ok(!!metalId && self.subtractFromAll(metalId) > 0, 'subtractAll'); break
          case 'mirror': { const t = startSel?.id ?? metalId ?? gemId; if (t) { self.mirror(t); applied.push('mirror') } else skipped.push('mirror'); break }
          case 'arrayRing': { const t = startSel?.id ?? metalId ?? gemId; if (t) { self.arrayCircular(t, c.count); applied.push('arrayRing') } else skipped.push('arrayRing'); break }
          case 'arrayRow': { const t = startSel?.id ?? metalId ?? gemId; if (t) { self.arrayLinear(t, c.count, c.spacing); applied.push('arrayRow') } else skipped.push('arrayRow'); break }
          case 'center': { const t = startSel?.id ?? metalId ?? gemId; if (t) { self.centerObject(t); applied.push('center') } else skipped.push('center'); break }
          case 'dropFloor': { const t = startSel?.id ?? metalId ?? gemId; if (t) { self.dropToFloor(t); applied.push('dropFloor') } else skipped.push('dropFloor'); break }
          default: skipped.push((c as { op: string }).op)
        }
      } catch { skipped.push(c.op) }
    }
    batching = false
    return { applied, skipped }
  },

  /** Dome the top of a part into a cabochon / comfort bulge. */
  domeTop: (id, height) => {
    const src = get().objects.find(o => o.id === id)
    if (!src || height === 0) return false
    const bv = bakedVertices(src)
    if (bv.length < 9) return false
    record()
    const out = domeSoup(bv, height)
    set(s => ({ objects: s.objects.map(o => o.id === id ? { ...o, kind: 'mesh', vertices: out, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 } : o) }))
    return true
  },

  /** Add two sizing beads on the inner bottom of a band to snug the fit. */
  addSizingBeads: id => {
    const src = get().objects.find(o => o.id === id)
    if (!src) return false
    const bv = bakedVertices(src)
    if (bv.length < 9) return false
    let minY = Infinity, minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
    for (let i = 0; i + 2 < bv.length; i += 3) {
      minY = Math.min(minY, bv[i + 1])
      minX = Math.min(minX, bv[i]); maxX = Math.max(maxX, bv[i])
      minZ = Math.min(minZ, bv[i + 2]); maxZ = Math.max(maxZ, bv[i + 2])
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2
    const bead = Math.max(0.6, (maxX - minX) * 0.06)
    record()
    const beads: SculptObject[] = [-1, 1].map((sgn, i) => ({
      id: newId(), name: `Sizing bead ${i + 1}`, kind: 'sphere',
      position: [cx + sgn * bead * 1.3, minY + bead * 0.6, cz], rotation: [0, 0, 0],
      scale: [1, 1, 1], size: bead, material: 'metal', color: GOLD,
    }))
    set(s => ({ objects: [...s.objects, ...beads], selectedId: beads[0].id }))
    return true
  },

  /** Force a part perfectly symmetric across a plane by mirroring one half. */
  symmetrizeMesh: (id, axis) => {
    const src = get().objects.find(o => o.id === id)
    if (!src) return false
    const bv = bakedVertices(src)
    if (bv.length < 9) return false
    const out = symmetrizeSoup(bv, axis)
    if (out.length < 9) return false
    record()
    set(s => ({ objects: s.objects.map(o => o.id === id ? { ...o, kind: 'mesh', vertices: out, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 } : o) }))
    return true
  },

  /** Rotate the whole piece to the print orientation that needs least support.
   *  Returns the new downward-facing fraction (0..1), or -1 if already optimal. */
  autoOrientForPrint: () => {
    const objs = get().objects
    if (!objs.length) return -1
    const best = bestPrintOrientation(objs)
    if (best.rotation.every(r => r === 0)) return -1
    record()
    set(s => ({
      objects: s.objects.map(o => ({
        ...o, kind: 'mesh', vertices: rotateSoup(bakedVertices(o), best.rotation),
        position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0,
      })),
    }))
    return best.fraction
  },

  /** Drop a decorative gallery ring beneath a set stone (or any part). */
  addGallery: id => {
    const src = get().objects.find(o => o.id === id)
    if (!src) return false
    const isGem = src.material === 'gem'
    const r = isGem ? gemDiameterMm(src) * 0.42 : 3
    const [x, y, z] = src.position
    record()
    const gallery: SculptObject = {
      id: newId(), name: 'Gallery', kind: 'torus',
      position: [x, y - (isGem ? gemDiameterMm(src) * 0.5 : 2), z], rotation: [Math.PI / 2, 0, 0],
      scale: [r / 1.5, r / 1.5, r / 1.5], size: 3, material: 'metal', color: GOLD,
    }
    set(s => ({ objects: [...s.objects, gallery], selectedId: gallery.id }))
    return true
  },

  /** Subtract one part (a cutter) from every other metal part at once. */
  subtractFromAll: cutterId => {
    const cutter = get().objects.find(o => o.id === cutterId)
    if (!cutter) return 0
    const targets = get().objects.filter(o => o.id !== cutterId && o.material === 'metal')
    if (!targets.length) return 0
    record()
    let cut = 0
    const updated = new Map<string, SculptObject>()
    for (const t of targets) {
      try {
        const v = booleanOp(t, cutter, 'subtract')
        if (v.length) { updated.set(t.id, { ...t, kind: 'mesh', vertices: v, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0 }); cut++ }
      } catch { /* skip a target that fails; keep the rest */ }
    }
    if (!cut) return 0
    set(s => ({ objects: s.objects.map(o => updated.get(o.id) ?? o) }))
    return cut
  },

  setPlacing: p => set({ placing: p }),
  /** Drop a stone of a chosen type at a position (default just above the grid),
   *  coloured to match the stone. Used by the palette and by click-to-place. */
  addStone: ({ stoneId, shapeId, carat, position, color }) => {
    record()
    const id = newId()
    const st = stoneById(stoneId)
    const gem: SculptObject = {
      id, name: `${st.name} ${carat} ct`, kind: 'gem',
      position: position ?? [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6,
      material: 'gem', color: color ?? st.color, params: { shapeId, stoneTypeId: stoneId, carat },
    }
    set(s => ({ objects: [...s.objects, gem], selectedId: id }))
    return id
  },

  select: id => set(s => (id === s.selectedId ? { selectedId: id } : { selectedId: id, selectedVertex: null, selectedVerts: [] })),
  setMode: mode => set({ mode }),
  setAlloy: id => set(s => {
    // Recolour metal parts to the chosen alloy so the render matches the metal
    // (yellow / white / rose gold, platinum, …). Gems keep their stone colour.
    const c = alloyById(id)?.color
    return { alloyId: id, objects: c === undefined ? s.objects : s.objects.map(o => o.material === 'metal' ? { ...o, color: c } : o) }
  }),
  clear: () => { record(); set({ objects: [], selectedId: null }) },
  load: objects => { record(); set({ objects, selectedId: null }) }
  }
})
