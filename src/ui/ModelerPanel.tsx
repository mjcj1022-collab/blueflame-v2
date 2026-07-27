import { useState, useEffect, useMemo } from 'react'
import { useModeler, SCULPT_COLORS, type PrimitiveKind, type JewelryKind, type SculptMaterial, type SculptObject, type ShankProfile, type SketchDef } from '../state/modeler'
import { profileThumb } from '../lib/sketchPresets'
import { booleanOp, sculptEstimate, sculptWarnings, boundingSize, sketchSummary, profileThinnest, weightScaleFactor, bakedVertices, MIN_SECTION_MM, type BooleanOp } from '../lib/sculpt'
import { balanceReport, type BalanceReport } from '../lib/balance'
import { voronoiLatticeVertices, latticeHoleCount } from '../lib/latticeGeo'
import { chainVertices, chainSpan } from '../lib/chainGeo'
import { sculptLibrary, type SavedSculpt } from '../lib/sculptLibrary'
import { sculptHandoff, sculptRestore, SculptHandoffError } from '../lib/sculptHandoff'
import { api, apiConfigured } from '../lib/api'
import { analyzeMesh, type DfmReport } from '../lib/dfm'
import { printReadiness } from '../lib/printReady'
import { minWallForAlloy } from '../lib/manufacture'
import { meleeOptions, caratForMm, mmForCarat, MELEE_MM } from '../lib/stoneSize'
import { HEATMAP_MIN_WALL } from '../lib/heatmap'
import { seatReport, type SeatReport } from '../lib/seatCheck'
import { modelerToObj, blueFlameMtl, modelerToStlBinary, modelerTo3mf, stlToVertices } from '../lib/cadExport'
import type { PaveMode } from '../lib/pave'
import type { RailAlong } from '../lib/construction'
import { stoneSchedule, stoneScheduleText } from '../lib/stoneSchedule'
import { askAssistant, type AiRoute } from '../lib/aiAssistant'
import { designQuality, designSpecText, type DesignQuality } from '../lib/designQuality'
import { DESIGN_TEMPLATES } from '../lib/designTemplates'
import { askCommands } from '../lib/aiCommands'
import { MACROS } from '../lib/commandMacros'
import { describePiece } from '../lib/describePiece'
import { overhangReport, symmetryScore, type OverhangReport } from '../lib/castCheck'
import { alloyCostTable } from '../lib/alloyCost'
import { laborBreakdown, formatMinutes } from '../lib/laborTime'
import { FINDINGS } from '../lib/findings'
import { sculptBom, sculptBomText } from '../lib/sculptBom'
import { askBenchAdvisor } from '../lib/benchAdvisor'
import { sculptMetalVolume } from '../lib/sculpt'
import { pieceSummary, pieceSummaryText } from '../lib/pieceSummary'
import { repairMesh } from '../lib/meshRepair'
import { sculptTechSheet, sculptQuote } from '../lib/sculptDoc'
import { textToPdf, bodyAfterTitle } from '../lib/pdf'
import { ALLOYS, SHAPES, STONES, alloyById, shapeById, stoneMm } from '../catalog'
import { MARKET } from '../lib/market'
import { useDesign } from '../state/design'
import { designSignature } from '../lib/aiAssemble'
import { stoneOnPiece } from '../spec/types'
import { textVertices, TEXT_FONT_NAMES } from '../lib/text3d'
import { money } from '../lib/units'
import { PartsLibrary } from './PartsLibrary'

const DEG = 180 / Math.PI
const round1 = (n: number) => Math.round(n * 10) / 10

const PRIMS: [PrimitiveKind, string][] = [['box', 'Box'], ['sphere', 'Sphere'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['torus', 'Torus'], ['tube', 'Tube']]
const PARTS: [JewelryKind, string][] = [['shank', 'Shank'], ['gem', 'Gem'], ['head', 'Prong head'], ['bezel', 'Bezel']]

/** HSL hue (0–360) → a saturated hex colour, for the custom stone-colour slider. */
function hueToHex(h: number): number {
  const s = 0.72, l = 0.55
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((h % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hp < 1) { r = c; g = x } else if (hp < 2) { r = x; g = c } else if (hp < 3) { g = c; b = x } else if (hp < 4) { g = x; b = c } else if (hp < 5) { r = x; b = c } else { r = c; b = x }
  const m = l - c / 2
  const to = (v: number) => Math.round((v + m) * 255)
  return (to(r) << 16) | (to(g) << 8) | to(b)
}
const PROFILES: [ShankProfile, string][] = [['round', 'Round'], ['flat', 'Flat'], ['dshape', 'D-shape'], ['knife', 'Knife'], ['comfort', 'Comfort']]
const OPS: [BooleanOp, string][] = [['union', 'Union'], ['subtract', 'Subtract'], ['intersect', 'Intersect']]

/** Tiny profile silhouette shown on a preset chip. */
function PresetThumb({ sketch }: { sketch: SketchDef }) {
  const { d, w, h } = profileThumb(sketch)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" style={{ display: 'block', margin: '0 auto 5px' }}>
      <path d={d} fill="rgba(198,162,101,0.16)" stroke="#C6A265" strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Slider({ label, value, min, max, step, unit, on }: { label: string; value: number; min: number; max: number; step: number; unit: string; on: (v: number) => void }) {
  return (
    <>
      <div className="row" style={{ marginTop: 12 }}><label>{label}</label><span className="val">{value.toFixed(step < 1 ? 2 : 0)}{unit}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => on(+e.target.value)} />
    </>
  )
}

function ParamControls({ sel }: { sel: SculptObject }) {
  const { updateParams, setObjectSketch, setSketching, setEditMode, select, saveSketchPreset, measuring, toggleMeasuring, objects, loftSketches } = useModeler()
  const [loftId, setLoftId] = useState('')
  const p = sel.params ?? {}
  if (sel.kind === 'sketch' && p.sketch) {
    const sk = p.sketch
    const otherSketches = objects.filter(o => o.kind === 'sketch' && o.id !== sel.id)
    const sum = sketchSummary(sk.points, sk.mode, sk.depth)
    const f = (v: number) => v.toFixed(1)
    const envelope = sum.mode === 'revolve'
      ? `⌀ ${f(sum.diameter!)} × ${f(sum.height)} mm`
      : `${f(sum.width!)} × ${f(sum.height)} × ${f(sum.depth!)} mm`
    const thin = profileThinnest(sk.points, sk.mode)
    const thinOk = !Number.isFinite(thin) || thin >= MIN_SECTION_MM
    return (
      <>
        <div className="disc" style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>{envelope}</span><span style={{ opacity: 0.6 }}>{sum.nodes} nodes</span>
        </div>
        {Number.isFinite(thin) && (
          <div className="disc" style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>min section</span>
            <span style={{ color: thinOk ? undefined : '#D98A5F', fontWeight: thinOk ? undefined : 700 }}>{thin.toFixed(2)} mm{thinOk ? '' : ' ⚠'}</span>
          </div>
        )}
        {!thinOk && (
          <div className="flag"><b>DFM · thin section</b>The profile's thinnest wall/spoke is {thin.toFixed(2)} mm — below the {MIN_SECTION_MM} mm cast/print minimum. Thicken it or the feature may not fill.</div>
        )}
        <div className="opts c2" style={{ marginTop: 8 }}>
          <button className="opt tpl" onClick={() => setSketching(true, sel.id)}>Edit profile ✎</button>
          <button className="opt tpl" onClick={() => { select(sel.id); setEditMode('vertex') }}>Drag 3D nodes</button>
        </div>
        <div className="opts c2" style={{ marginTop: 8 }}>
          <button className="opt" aria-pressed={measuring} onClick={() => { select(sel.id); toggleMeasuring() }}>{measuring ? 'Measuring — click 2 nodes' : 'Measure ⟷'}</button>
          <button className="opt" onClick={() => { const n = window.prompt('Save this profile as a preset — name:'); if (n && n.trim()) saveSketchPreset(n, sk) }}>Save as preset ★</button>
        </div>
        <div className="row" style={{ marginTop: 12 }}><label>Build</label></div>
        <div className="opts c2">
          <button className="opt" aria-pressed={sk.mode === 'revolve'} onClick={() => setObjectSketch(sel.id, { ...sk, mode: 'revolve' })}>Revolve</button>
          <button className="opt" aria-pressed={sk.mode === 'extrude'} onClick={() => setObjectSketch(sel.id, { ...sk, mode: 'extrude' })}>Extrude</button>
        </div>
        {sk.mode === 'extrude'
          ? <Slider label="Depth" value={sk.depth} min={0.6} max={12} step={0.2} unit=" mm" on={v => setObjectSketch(sel.id, { ...sk, depth: v })} />
          : <>
              <Slider label="Sweep angle" value={sk.arc ?? 360} min={20} max={360} step={5} unit="°" on={v => setObjectSketch(sel.id, { ...sk, arc: v })} />
              <Slider label="Sides" value={sk.segments} min={8} max={96} step={1} unit="" on={v => setObjectSketch(sel.id, { ...sk, segments: Math.round(v) })} />
            </>}
        {otherSketches.length > 0 && (
          <>
            <div className="row" style={{ marginTop: 12 }}><label>Loft <small style={{ color: '#6E787B', fontWeight: 400 }}>blend into another profile</small></label></div>
            <select className="lib-name" style={{ width: '100%' }} value={loftId} onChange={e => setLoftId(e.target.value)}>
              <option value="">Blend to…</option>
              {otherSketches.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <div className="opts" style={{ marginTop: 8 }}>
              <button className="opt" disabled={!loftId} onClick={() => { const id = loftSketches(sel.id, loftId); if (id) { select(id); setLoftId('') } }}>Loft ⟿</button>
            </div>
          </>
        )}
      </>
    )
  }
  if (sel.kind === 'shank') return (
    <>
      <Slider label="Ring size" value={p.ringSize ?? 7} min={3} max={13} step={0.25} unit="" on={v => updateParams(sel.id, { ringSize: v })} />
      <div className="row" style={{ marginTop: 12 }}><label>Profile</label></div>
      <div className="opts c2">
        {PROFILES.map(([id, label]) => <button key={id} className="opt" aria-pressed={(p.profile ?? 'round') === id} onClick={() => updateParams(sel.id, { profile: id })}>{label}</button>)}
      </div>
      <Slider label="Width" value={p.width ?? 2.2} min={1.2} max={10} step={0.1} unit=" mm" on={v => updateParams(sel.id, { width: v })} />
      <Slider label="Thickness" value={p.thickness ?? 1.8} min={1} max={4} step={0.1} unit=" mm" on={v => updateParams(sel.id, { thickness: v })} />
    </>
  )
  if (sel.kind === 'gem') return (
    <>
      <div className="row" style={{ marginTop: 12 }}><label>Cut</label></div>
      <select className="lib-name" style={{ width: '100%' }} value={p.shapeId ?? 'rd'} onChange={e => updateParams(sel.id, { shapeId: e.target.value })}>
        {SHAPES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div className="row" style={{ marginTop: 12 }}><label>Stone</label></div>
      <select className="lib-name" style={{ width: '100%' }} value={p.stoneTypeId ?? 'dia'} onChange={e => updateParams(sel.id, { stoneTypeId: e.target.value })}>
        {STONES.map(s => <option key={s.id} value={s.id}>{s.name} — {s.variety}</option>)}
      </select>
      <Slider label="Carat" value={p.carat ?? 1} min={0.1} max={6} step={0.05} unit=" ct" on={v => updateParams(sel.id, { carat: v })} />
    </>
  )
  if (sel.kind === 'head') return (
    <>
      <Slider label="Prongs" value={p.prongs ?? 4} min={3} max={8} step={1} unit="" on={v => updateParams(sel.id, { prongs: v })} />
      <Slider label="Stone width" value={p.stoneW ?? 6.5} min={3} max={16} step={0.1} unit=" mm" on={v => updateParams(sel.id, { stoneW: v })} />
      <Slider label="Height" value={p.height ?? 4} min={2} max={9} step={0.1} unit=" mm" on={v => updateParams(sel.id, { height: v })} />
    </>
  )
  if (sel.kind === 'bezel') return (
    <>
      <Slider label="Stone width" value={p.stoneW ?? 6.5} min={3} max={16} step={0.1} unit=" mm" on={v => updateParams(sel.id, { stoneW: v })} />
      <Slider label="Height" value={p.height ?? 3} min={1.5} max={7} step={0.1} unit=" mm" on={v => updateParams(sel.id, { height: v })} />
      <Slider label="Wall" value={p.wall ?? 0.6} min={0.3} max={1.5} step={0.05} unit=" mm" on={v => updateParams(sel.id, { wall: v })} />
    </>
  )
  return null
}

function TextTool() {
  const addMesh = useModeler(s => s.addMesh)
  const engraveOnPart = useModeler(s => s.engraveOnPart)
  const wrapTextOnBand = useModeler(s => s.wrapTextOnBand)
  const selectedId = useModeler(s => s.selectedId)
  const selName = useModeler(s => s.objects.find(o => o.id === s.selectedId)?.name)
  const [text, setText] = useState('')
  const [font, setFont] = useState('Block')
  const [angle, setAngle] = useState(90)
  const [inside, setInside] = useState(false)
  const [msg, setMsg] = useState('')
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }
  const add = () => {
    const v = textVertices(text, font, 4, 1.2)
    if (!v.length) { flash('Type some text first.'); return }
    addMesh({ kind: 'mesh', vertices: v, position: [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: SCULPT_COLORS.metal, name: `“${text.trim()}”` })
    setText('')
  }
  const onPart = (op: 'emboss' | 'cut') => {
    if (!text.trim()) { flash('Type some text first.'); return }
    if (!selectedId) { flash('Select the part to engrave first.'); return }
    const ok = engraveOnPart(selectedId, text.trim(), font, op)
    flash(ok ? `${op === 'cut' ? 'Engraved' : 'Embossed'} onto ${selName}.` : 'Couldn’t apply — try a flatter face or a bigger part.')
    if (ok) setText('')
  }
  const wrap = (op: 'emboss' | 'cut') => {
    if (!text.trim()) { flash('Type some text first.'); return }
    if (!selectedId) { flash('Select the band to wrap first.'); return }
    const ok = wrapTextOnBand(selectedId, text.trim(), font, op, angle, inside)
    flash(ok ? `Wrapped around ${selName}.` : 'Couldn’t wrap — select a ring/band part.')
    if (ok) setText('')
  }
  return (
    <>
      <div className="lib-save">
        <input className="lib-name" placeholder="Type text…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <button className="primary" onClick={add}>Add</button>
      </div>
      <select className="lib-name" style={{ width: '100%', marginTop: 8 }} value={font} onChange={e => setFont(e.target.value)}>
        {TEXT_FONT_NAMES.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      {selectedId && (
        <>
          <div className="opts c2" style={{ marginTop: 8 }}>
            <button className="opt tpl" onClick={() => onPart('cut')}>Engrave onto part</button>
            <button className="opt tpl" onClick={() => onPart('emboss')}>Emboss onto part</button>
          </div>
          <Slider label="Wrap position" value={angle} min={0} max={360} step={5} unit="°" on={setAngle} />
          <label className="filter-row" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={inside} onChange={e => setInside(e.target.checked)} />
            Inside face<small>engrave inside the band</small>
          </label>
          <div className="opts c2" style={{ marginTop: 6 }}>
            <button className="opt tpl" onClick={() => wrap('cut')}>Wrap band · engrave</button>
            <button className="opt tpl" onClick={() => wrap('emboss')}>Wrap band · emboss</button>
          </div>
        </>
      )}
      <p className="disc"><b>Add</b> drops standalone text. With a part selected, <b>Engrave/Emboss onto part</b> places it on the top face; <b>Wrap band</b> curves it around a ring/band’s circumference.</p>
      {msg && <p className="disc">{msg}</p>}
    </>
  )
}

export function ModelerPanel() {
  const { objects, selectedId, mode, editMode, falloff, symmetry, surfaceOp, brush, alloyId, snap, sketching, past, future, undo, redo, add, addMesh, update, remove, duplicate, arrayCircular, arrayLinear, paveFill, fitHead, fitBezel, drillHole, addBail, addHalo, addChannelRails, flushSet, textureMesh, addMilgrain, bridgeWire, piercePattern, addSignet, assembleDesign, runModelerCommands, placing, setPlacing, addStone, domeTop, addSizingBeads, symmetrizeMesh, autoOrientForPrint, addGallery, subtractFromAll, mirror, centerObject, dropToFloor, scaleAll, toggleSnap, heatmap, toggleHeatmap, toggleSymmetry, subdivideMesh, smoothMesh, twistMesh, taperMesh, bendMesh, fuseMetal, setSketching, setEditMode, setFalloff, setSurfaceOp, setBrush, select, setMode, setAlloy, clear, load, fixForPrint, seatStone, importMesh, addFinding, explode, setExplode, sketchPresets, applySketchPreset, deleteSketchPreset } = useModeler()
  const sel = objects.find(o => o.id === selectedId) ?? null
  const dims = sel ? boundingSize(sel) : [0, 0, 0]
  const others = objects.filter(o => o.id !== selectedId)
  const [otherId, setOtherId] = useState('')
  const [seatTarget, setSeatTarget] = useState('')
  const [targetG, setTargetG] = useState('')
  const [bal, setBal] = useState<BalanceReport | null>(null)
  const [seatRep, setSeatRep] = useState<SeatReport | null>(null)
  const [lat, setLat] = useState({ width: 18, height: 12, thickness: 1.4, count: 28, strut: 1.0, seed: 1 })
  const [chn, setChn] = useState({ links: 10, radius: 3, wire: 0.7 })
  const [count, setCount] = useState(8)
  const [pave, setPave] = useState<{ count: number; carat: number; gap: number; mode: PaveMode; radius: number; arcDeg: number; cutSeats: boolean; snap: boolean }>({ count: 12, carat: 0.02, gap: 0.2, mode: 'ring', radius: 9, arcDeg: 360, cutSeats: true, snap: true })
  const [headProngs, setHeadProngs] = useState(6)
  const [drill, setDrill] = useState<{ axis: 'x' | 'y' | 'z'; dia: number }>({ axis: 'y', dia: 1.2 })
  const [halo, setHalo] = useState({ count: 12, carat: 0.03 })
  const [rails, setRails] = useState<{ length: number; innerGap: number; height: number; thickness: number; along: RailAlong }>({ length: 12, innerGap: 2.2, height: 2, thickness: 0.8, along: 'x' })
  const [keepCutter, setKeepCutter] = useState(false)
  const [tex, setTex] = useState<{ style: 'hammered' | 'stipple' | 'florentine'; amp: number; scale: number }>({ style: 'hammered', amp: 0.15, scale: 1.2 })
  const [mil, setMil] = useState({ radius: 4, beadDia: 0.5 })
  const [pierce, setPierce] = useState<{ count: number; mode: 'row' | 'ring'; span: number; dia: number; axis: 'x' | 'y' | 'z' }>({ count: 6, mode: 'ring', span: 4, dia: 1, axis: 'y' })
  const [signet, setSignet] = useState({ width: 10, length: 12, thickness: 1.5 })
  const [wire, setWire] = useState(1)
  const [aiText, setAiText] = useState('')
  const [aiAsm, setAiAsm] = useState<{ busy: boolean; err: string | null; routes: AiRoute[]; assumptions: string[] }>({ busy: false, err: null, routes: [], assumptions: [] })
  const [aiReplace, setAiReplace] = useState(true)
  const [aiQuality, setAiQuality] = useState<DesignQuality | null>(null)
  const [finText, setFinText] = useState('')
  const [finBusy, setFinBusy] = useState(false)
  const [stonePick, setStonePick] = useState<{ stoneId: string; shapeId: string; carat: number; hue: number; custom: boolean }>({ stoneId: 'dia', shapeId: 'rd', carat: 0.5, hue: 200, custom: false })
  const [findingPick, setFindingPick] = useState('jump')
  const [benchQ, setBenchQ] = useState('')
  const [benchA, setBenchA] = useState<{ text: string; ai: boolean } | null>(null)
  const [benchBusy, setBenchBusy] = useState(false)
  const [domeH, setDomeH] = useState(1.5)
  const [symAxis, setSymAxis] = useState<'x' | 'y' | 'z'>('x')
  const [over, setOver] = useState<OverhangReport | null>(null)
  const [sym, setSym] = useState<number | null>(null)
  const [saveName, setSaveName] = useState('')
  const [saved, setSaved] = useState<SavedSculpt[]>(() => sculptLibrary.list())
  const [dfm, setDfm] = useState<{ id: string; r: DfmReport } | null>(null)
  const [msg, setMsg] = useState('')
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  // Undo / redo keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const t = e.target as HTMLElement
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
      else if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const metalObjects = objects.filter(o => o.material === 'metal' && o.id !== selectedId)

  const boreSeat = (gem: SculptObject) => {
    const metalObj = objects.find(o => o.id === seatTarget)
    if (!metalObj) { flash('Choose the metal to seat the gem into.'); return }
    const gemW = stoneMm(shapeById(gem.params?.shapeId ?? 'rd'), gem.params?.carat ?? 1).width
    const cutter: SculptObject = { id: 'cut', kind: 'cone', name: 'cutter', position: [gem.position[0], gem.position[1] - gemW * 0.1, gem.position[2]], rotation: [Math.PI, 0, 0], scale: [1, 1, 1], size: gemW * 1.15, material: 'metal', color: 0 }
    try {
      const vertices = booleanOp(metalObj, cutter, 'subtract')
      if (!vertices.length) { flash('Gem isn’t over the metal — position it above the part first.'); return }
      addMesh({ kind: 'mesh', vertices, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: metalObj.material, color: metalObj.color, name: `${metalObj.name} seated` })
      remove(metalObj.id); setSeatTarget('')
    } catch { flash('Seat failed on this geometry.') }
  }

  /** One-click cleanup on a baked mesh: weld, de-sliver, cap holes, then
   *  re-run the analyzer so the before→after shows in the DFM readout. */
  const repair = (obj: SculptObject) => {
    if (!obj.vertices || obj.vertices.length < 9) { flash('Nothing to repair on this part.'); return }
    const { vertices, stats } = repairMesh(obj.vertices)
    update(obj.id, { vertices })
    setDfm({ id: obj.id, r: analyzeMesh(vertices, minWallForAlloy(alloyId)) })
    const fixes: string[] = []
    if (stats.weldedVertices) fixes.push(`welded ${stats.weldedVertices} points`)
    if (stats.removedDegenerate) fixes.push(`removed ${stats.removedDegenerate} sliver${stats.removedDegenerate === 1 ? '' : 's'}`)
    if (stats.removedDuplicate) fixes.push(`dropped ${stats.removedDuplicate} duplicate face${stats.removedDuplicate === 1 ? '' : 's'}`)
    if (stats.holesFilled) fixes.push(`capped ${stats.holesFilled} hole${stats.holesFilled === 1 ? '' : 's'}`)
    flash(fixes.length
      ? `Repaired — ${fixes.join(', ')}. ${stats.watertight ? 'Now watertight.' : 'Some non-manifold edges remain.'}`
      : (stats.watertight ? 'Already clean — watertight.' : 'No auto-fixable issues found.'))
  }

  const alloy = alloyById(alloyId)
  const est = sculptEstimate(objects, alloyId)

  /** Uniformly resize the whole piece to hit a target cast weight. */
  const applyResizeToWeight = () => {
    const t = parseFloat(targetG)
    if (!(t > 0)) { flash('Enter a target weight in grams.'); return }
    if (!objects.length) { flash('Nothing to resize yet.'); return }
    const f = weightScaleFactor(est.castG, t)
    if (f === 1) { flash('Already at that weight.'); return }
    scaleAll(f)
    setTargetG('')
    flash(`Resized ×${f.toFixed(3)} → ~${t.toFixed(1)} g cast.`)
  }

  /** Center-of-mass balance over the whole metal piece (all metal parts combined). */
  const checkBalance = () => {
    const soup = objects.filter(o => o.material === 'metal').flatMap(bakedVertices)
    if (soup.length < 9) { flash('Add some metal first.'); return }
    // Sculpt bands (shank) are modeled in the XY plane, so the finger axis is Z;
    // otherwise treat the piece as standing upright (Y).
    const fingerAxis = objects.some(o => o.kind === 'shank' && o.material === 'metal') ? 'z' : 'y'
    setBal(balanceReport(soup, fingerAxis))
  }

  /** Drop a pierced Voronoi-lattice panel into the scene as an editable mesh. */
  const addLattice = () => {
    const v = voronoiLatticeVertices(lat)
    if (v.length < 9) { flash('Lattice came out empty — try fewer cells or a thinner strut.'); return }
    addMesh({ kind: 'mesh', vertices: v, position: [0, 4, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: SCULPT_COLORS.metal, name: 'Voronoi lattice' })
    flash(`Added lattice — ${latticeHoleCount(lat)} cells pierced.`)
  }

  /** Drop a procedural interlocking chain into the scene. */
  const addChain = () => {
    const v = chainVertices({ ...chn, segments: 18 })
    if (v.length < 9) { flash('Chain came out empty.'); return }
    addMesh({ kind: 'mesh', vertices: v, position: [0, 4, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: 'metal', color: SCULPT_COLORS.metal, name: `Chain ×${chn.links}` })
    flash(`Added chain — ${chn.links} links, ~${chainSpan({ ...chn }).toFixed(0)} mm.`)
  }
  const { vol, castG } = est
  const warnings = useMemo(() => sculptWarnings(objects), [objects])

  const [sendingOrder, setSendingOrder] = useState(false)
  const [serverDesigns, setServerDesigns] = useState<{ id: string; name: string; updated_at: string }[]>([])
  const [loadingServer, setLoadingServer] = useState(false)

  /** Designs saved on the server — sculpted ones can be reopened here. */
  const refreshServer = async () => {
    if (!apiConfigured()) return
    setLoadingServer(true)
    try { setServerDesigns(await api.listDesigns() as { id: string; name: string; updated_at: string }[]) }
    catch { /* offline or waking — the list just stays as it was */ }
    finally { setLoadingServer(false) }
  }
  useEffect(() => { void refreshServer() }, [])

  /** Pull a saved piece back into the modeler, geometry and alloy intact. */
  const reopen = async (id: string, name: string) => {
    try {
      const design = await api.loadDesign(id) as { spec: unknown }
      const { objects: objs, alloyId: savedAlloy } = sculptRestore(design.spec)
      load(objs)
      setAlloy(savedAlloy)
      flash(`Reopened “${name}” — ${objs.length} part${objs.length === 1 ? '' : 's'}.`)
    } catch (err) {
      flash(err instanceof SculptHandoffError ? err.message
        : err instanceof Error ? `Couldn’t reopen: ${err.message}` : 'Couldn’t reopen that piece.')
    }
  }
  /** Push the sculpted piece into the commercial pipeline: persist it as a
   *  design (geometry + costed facts) then open an order against it. */
  const sendToOrder = async () => {
    if (!apiConfigured()) { flash('Connect a backend to send orders — the app is running standalone.'); return }
    let handoff
    try {
      handoff = sculptHandoff(saveName, objects, alloyId)
    } catch (err) {
      flash(err instanceof SculptHandoffError ? err.message : 'Could not prepare this piece for order.')
      return
    }
    setSendingOrder(true)
    try {
      const savedDesign = await api.saveDesign(handoff.name, handoff.spec) as { id: string }
      await api.createOrder(savedDesign.id)
      flash(`Ordered “${handoff.name}” — ${money(handoff.total)}, ${handoff.spec.metal.castGrams.toFixed(2)} g ${handoff.spec.alloyName}.`)
      void refreshServer()   // show it in the reopen list right away
    } catch (err) {
      flash(err instanceof Error ? `Order failed: ${err.message}` : 'Order failed.')
    } finally {
      setSendingOrder(false)
    }
  }

  const doBoolean = (op: BooleanOp) => {
    const b = objects.find(o => o.id === otherId)
    if (!sel || !b) { flash('Pick a second shape to combine with.'); return }
    try {
      const vertices = booleanOp(sel, b, op)
      if (!vertices.length) { flash('The shapes don’t overlap — nothing to combine.'); return }
      addMesh({ kind: 'mesh', vertices, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 0, material: sel.material, color: sel.color, name: `${op} result` })
      remove(sel.id); if (!keepCutter) remove(b.id); setOtherId('')
    } catch { flash('Boolean failed on this geometry.') }
  }

  const doPave = () => {
    if (!sel) { flash('Select the band (or any part) to anchor the pavé on.'); return }
    const onMetal = sel.material === 'metal'
    const seating = pave.cutSeats && onMetal
    const snapping = pave.snap && onMetal
    const n = paveFill({
      count: pave.count, mode: pave.mode, carat: pave.carat, gap: pave.gap,
      center: [sel.position[0], sel.position[1], sel.position[2]],
      radius: pave.mode === 'ring' && pave.radius > 0 ? pave.radius : undefined,
      arcDeg: pave.arcDeg,
      cutSeats: seating, snapToSurface: snapping, baseId: onMetal ? sel.id : undefined,
    })
    if (!n) { flash('Nothing placed — check the count.'); return }
    flash(seating ? `Placed ${pave.count} stones and carved ${n} seats into ${sel.name}.` : `Placed ${pave.count} stones${snapping ? ' onto the surface' : ''}.`)
  }

  const doFitHead = () => { if (sel && fitHead(sel.id, headProngs)) flash(`Added a ${headProngs}-prong head sized to the stone.`); else flash('Select a gem first.') }
  const doFitBezel = () => { if (sel && fitBezel(sel.id)) flash('Wrapped the stone in a bezel.'); else flash('Select a gem first.') }
  const doDrill = () => { if (sel && drillHole(sel.id, drill.axis, drill.dia)) flash(`Drilled a ${drill.dia} mm hole through ${sel.name}.`); else flash('Drill failed on this geometry.') }
  const doBail = () => { if (sel && addBail(sel.id)) flash('Added a bail to the top.'); else flash('Select a part first.') }
  const doHalo = () => { if (sel && addHalo(sel.id, halo.count, halo.carat)) flash(`Added a ${halo.count}-stone halo around the centre.`); else flash('Select a centre gem first.') }
  const doFlush = () => { if (sel && flushSet(sel.id)) flash('Flush-set the stone into the metal below it.'); else flash('Select a gem sitting over a metal part.') }
  const doRails = () => {
    const c = sel ? sel.position : [0, 0, 0] as [number, number, number]
    if (addChannelRails({ center: [c[0], c[1], c[2]], length: rails.length, innerGap: rails.innerGap, height: rails.height, thickness: rails.thickness, along: rails.along }))
      flash('Added channel rails — drop a row of stones between them.')
  }
  const doTexture = () => { if (sel && textureMesh(sel.id, tex.style, tex.amp, tex.scale)) flash(`Applied ${tex.style} texture to ${sel.name}.`); else flash('Select a part to texture.') }
  const doMilgrain = () => { const c = sel ? sel.position : [0, 0, 0] as [number, number, number]; const n = addMilgrain([c[0], c[1], c[2]], mil.radius, mil.beadDia); flash(n ? `Added a ${n}-bead milgrain ring.` : 'Set a radius and bead size.') }
  const doBridge = () => { const b = objects.find(o => o.id === otherId); if (sel && b && bridgeWire(sel.id, b.id, wire)) flash(`Bridged ${sel.name} → ${b.name}.`); else flash('Select a part and pick a second in the Boolean list.') }
  const doPierce = () => { if (!sel) { flash('Select a part to pierce.'); return } const n = piercePattern(sel.id, pierce.count, pierce.mode, pierce.span, pierce.dia, pierce.axis); flash(n ? `Pierced ${n} holes through ${sel.name}.` : 'Piercing missed the part — adjust span/diameter.') }
  const doSignet = () => { if (sel && addSignet(sel.id, signet.width, signet.length, signet.thickness)) flash('Added a signet face on top.'); else flash('Select a part first.') }
  const doDome = () => { if (sel && domeTop(sel.id, domeH)) flash(`Domed ${sel.name} by ${domeH} mm.`); else flash('Select a part to dome.') }
  const doSizingBeads = () => { if (sel && addSizingBeads(sel.id)) flash('Added sizing beads inside the band.'); else flash('Select the band first.') }
  const checkOverhang = () => setOver(overhangReport(objects))
  const checkSymmetry = () => { if (!sel) { flash('Select a part to check symmetry.'); return } setSym(symmetryScore(bakedVertices(sel), symAxis)) }
  const doSymmetrize = () => { if (sel && symmetrizeMesh(sel.id, symAxis)) { setSym(1); flash(`Symmetrised ${sel.name} across ${symAxis.toUpperCase()}.`) } else flash('Select a part to symmetrise.') }
  const doAutoOrient = () => { const f = autoOrientForPrint(); flash(f < 0 ? 'Already in the best print orientation.' : `Re-oriented — now ${Math.round(f * 100)}% down-facing.`); setOver(null) }
  const doGallery = () => { if (sel && addGallery(sel.id)) flash('Added a gallery ring under the stone.'); else flash('Select a stone or part first.') }
  const doSubtractAll = () => { if (!sel) { flash('Select the cutter part first.'); return } const n = subtractFromAll(sel.id); flash(n ? `Cut ${n} metal part${n === 1 ? '' : 's'} with ${sel.name}.` : 'Nothing to cut — need another metal part it overlaps.') }
  const copySummary = () => { const txt = pieceSummaryText(pieceSummary(objects, alloyId), alloy.name); navigator.clipboard?.writeText(txt).then(() => flash('Piece summary copied.'), () => flash('Could not copy.')) }
  const copySchedule = () => {
    const txt = stoneScheduleText(stoneSchedule(objects))
    navigator.clipboard?.writeText(txt).then(() => flash('Stone schedule copied.'), () => flash('Could not copy.'))
  }
  const runQa = () => setAiQuality(designQuality(useModeler.getState().objects, alloyId))
  const runAiAssemble = async () => {
    const q = aiText.trim()
    if (!q || aiAsm.busy) return
    setAiAsm({ busy: true, err: null, routes: [], assumptions: [] })
    try {
      const res = await askAssistant([{ role: 'user', content: q }], null, { forceRoutes: true })
      if (res.disabled) { setAiAsm({ busy: false, err: 'AI is off — add AI_API_KEY on the backend.', routes: [], assumptions: [] }); return }
      if (res.routes.length) { setAiAsm({ busy: false, err: null, routes: res.routes, assumptions: res.assumptions }); return }
      if (res.design) { const n = assembleDesign(res.design, aiReplace); flash(n ? `Assembled ${n} editable parts.` : 'Nothing to assemble from that.'); if (n) runQa() }
      else flash(res.reply || 'No buildable design in that request.')
      setAiAsm({ busy: false, err: null, routes: [], assumptions: res.assumptions })
    } catch { setAiAsm({ busy: false, err: 'AI request failed — try again.', routes: [], assumptions: [] }) }
  }
  const buildAiRoute = (i: number) => {
    const r = aiAsm.routes[i]
    if (!r) return
    const n = assembleDesign(r.design, aiReplace)
    flash(n ? `Built “${r.label}” — ${n} editable parts.` : 'Nothing to assemble.')
    setAiAsm(a => ({ ...a, routes: [] }))
    if (n) runQa()
  }
  const buildTemplate = (id: string) => {
    const t = DESIGN_TEMPLATES.find(x => x.id === id)
    if (!t) return
    const n = assembleDesign(t.patch, aiReplace)
    flash(n ? `Assembled “${t.name}” — ${n} parts.` : 'Nothing to assemble.')
    if (n) runQa()
  }
  /** Pull the piece from the AI / Design studio in as editable parts. */
  const bringInDesign = () => {
    const n = useModeler.getState().importFromDesign(useDesign.getState().spec, aiReplace)
    flash(n ? `Brought in the studio piece — ${n} editable part${n === 1 ? '' : 's'}.` : 'Nothing in the studio to bring in yet.')
    if (n) runQa()
  }
  const copySpec = () => {
    const txt = designSpecText(objects, alloyId, alloy.name)
    navigator.clipboard?.writeText(txt).then(() => flash('Design spec copied.'), () => flash('Could not copy.'))
  }
  const specPdf = () => {
    if (!objects.length) { flash('Nothing to spec yet.'); return }
    const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    textToPdf(shopName, 'Design Specification', designSpecText(objects, alloyId, alloy.name), `${slug}-design-spec.pdf`)
  }
  const runFinish = async () => {
    const q = finText.trim()
    if (!q || finBusy) return
    if (!objects.length) { flash('Build or assemble a piece first, then finish it with AI.'); return }
    setFinBusy(true)
    try {
      const res = await askCommands(q)
      if (res.disabled) { flash('AI is off — add AI_API_KEY on the backend.'); setFinBusy(false); return }
      if (!res.commands.length) { flash(res.reply || 'Nothing actionable in that.'); setFinBusy(false); return }
      const { applied, skipped } = runModelerCommands(res.commands)
      flash(applied.length ? `Applied ${applied.join(', ')}${skipped.length ? ` · skipped ${skipped.join(', ')}` : ''}.` : `Couldn't apply those — ${skipped.join(', ')}.`)
      if (applied.length) { setFinText(''); runQa() }
    } catch { flash('AI command failed — try again.') }
    setFinBusy(false)
  }
  const askBench = async () => {
    const q = benchQ.trim()
    if (!q || benchBusy) return
    if (!objects.length) { flash('Add a part first — the advisor answers from the piece on the bench.'); return }
    setBenchBusy(true)
    try {
      const res = await askBenchAdvisor(q, objects, alloyId)
      setBenchA({ text: res.text, ai: res.ai })
    } catch { setBenchA({ text: 'Couldn’t reach the advisor — try again.', ai: false }) }
    setBenchBusy(false)
  }
  const runMacro = (id: string) => {
    const m = MACROS.find(x => x.id === id)
    if (!m) return
    if (!objects.length) { flash('Build a piece first, then apply a finish.'); return }
    const { applied, skipped } = runModelerCommands(m.commands)
    flash(applied.length ? `${m.name}: applied ${applied.join(', ')}${skipped.length ? ` · skipped ${skipped.join(', ')}` : ''}.` : `Couldn't apply ${m.name}.`)
    if (applied.length) runQa()
  }
  const copyDescribe = () => {
    const d = describePiece(objects, alloyId)
    navigator.clipboard?.writeText(`${d.name}\n${d.sentence}`).then(() => flash(`Copied: ${d.name}`), () => flash('Could not copy.'))
  }
  const armed = (p: typeof stonePick) => ({ stoneId: p.stoneId, shapeId: p.shapeId, carat: p.carat, color: p.custom ? hueToHex(p.hue) : undefined })
  const setPick = (patch: Partial<typeof stonePick>) => { const p = { ...stonePick, ...patch }; setStonePick(p); if (placing) setPlacing(armed(p)) }
  const togglePlace = () => { setPlacing(placing ? null : armed(stonePick)); if (!placing) flash('Click anywhere on the piece (or the stage) to drop stones. Click empty space to place, a part to place on it.') }
  const addOneStone = () => { addStone(armed(stonePick)); flash(`Added ${STONES.find(s => s.id === stonePick.stoneId)?.name ?? 'stone'} — drag the gizmo to move it.`) }

  const metalCount = objects.filter(o => o.material === 'metal').length
  const sched = stoneSchedule(objects)
  const fuse = () => {
    if (metalCount < 2) { flash('Need at least two metal parts to fuse.'); return }
    try { const n = fuseMetal(); flash(n ? `Fused ${n} metal parts into one solid.` : 'Nothing to fuse.') }
    catch { flash('Fuse failed on this geometry.') }
  }

  const shopName = useDesign.getState().shop.name

  /** Warn (once) before exporting a piece that fails the print gate. Returns
   *  true to proceed. Non-blocking for pass/warn; a confirm only on hard fail. */
  const printGateOk = (): boolean => {
    const r = printReadiness(objects, alloyId)
    if (r.verdict !== 'fail') return true
    const bad = r.issues.filter(i => i.level === 'fail').map(i => i.title).join('; ')
    return window.confirm(`This piece isn’t print-ready — ${bad}.\n\nRun “Fix for print” first (button above). Export anyway?`)
  }
  const downloadBlob = (data: BlobPart, name: string, mime: string) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; a.click(); URL.revokeObjectURL(a.href)
  }
  const exportStl = () => {
    if (!objects.length) { flash('Nothing to export.'); return }
    if (!printGateOk()) return
    downloadBlob(modelerToStlBinary(objects), `blue-flame-sculpt-${Date.now()}.stl`, 'model/stl')
    flash('Exported binary STL — the slicer/caster-standard mesh.')
  }
  const export3mf = () => {
    if (!objects.length) { flash('Nothing to export.'); return }
    if (!printGateOk()) return
    const z = modelerTo3mf(objects)
    downloadBlob((z.buffer as ArrayBuffer).slice(z.byteOffset, z.byteOffset + z.byteLength), `blue-flame-sculpt-${Date.now()}.3mf`, 'model/3mf')
    flash('Exported 3MF — parts stay separate, millimetre-accurate.')
  }
  const importStlFile = (file: File) => {
    const r = new FileReader()
    r.onload = () => {
      try {
        const v = stlToVertices(r.result as ArrayBuffer)
        if (v.length < 9) { flash('That STL had no readable geometry.'); return }
        const id = importMesh(v, file.name.replace(/\.stl$/i, ''))
        flash(id ? `Imported “${file.name}” — ${Math.floor(v.length / 9)} triangles onto the bench.` : 'Import failed.')
        if (id) runQa()
      } catch { flash('Couldn’t parse that STL file.') }
    }
    r.readAsArrayBuffer(file)
  }
  const runFixForPrint = () => {
    if (!objects.length) { flash('Nothing to fix yet.'); return }
    const s = fixForPrint()
    const bits: string[] = []
    if (s.welded) bits.push(`welded ${s.welded} points`)
    if (s.degenerate) bits.push(`removed ${s.degenerate} sliver${s.degenerate === 1 ? '' : 's'}`)
    if (s.duplicate) bits.push(`dropped ${s.duplicate} dup face${s.duplicate === 1 ? '' : 's'}`)
    if (s.holes) bits.push(`capped ${s.holes} hole${s.holes === 1 ? '' : 's'}`)
    flash(s.parts === 0
      ? 'Parts are parametric and already watertight — nothing to weld.'
      : `Fixed ${s.parts} mesh part${s.parts === 1 ? '' : 's'}${bits.length ? ' — ' + bits.join(', ') : ''}. ${s.watertight ? 'Now watertight.' : 'Some open edges remain — check part-level repair.'}`)
    runQa()
  }

  const download = (text: string, name: string, mime: string) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click(); URL.revokeObjectURL(a.href)
  }
  const exportObj = () => {
    if (!objects.length) { flash('Nothing to export.'); return }
    if (!printGateOk()) return
    const stamp = Date.now()
    download(modelerToObj(objects), `blue-flame-sculpt-${stamp}.obj`, 'model/obj')
    // The OBJ names blue-flame.mtl; ship it too so parts arrive with their colours.
    download(blueFlameMtl(), 'blue-flame.mtl', 'text/plain')
    flash('Exported OBJ + MTL — parts and materials arrive separate in CAD.')
  }

  const techSheet = () => {
    if (!objects.length) { flash('Nothing to document.'); return }
    const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    textToPdf(shopName, 'Custom Sculpt — Tech Sheet', bodyAfterTitle(sculptTechSheet(objects, alloyId, shopName)), `${slug}-sculpt-techsheet.pdf`)
  }

  /** Client-facing quote — same numbers as the estimate and the order. */
  const quotePdf = () => {
    let handoff
    try {
      handoff = sculptHandoff(saveName, objects, alloyId)
    } catch (err) {
      flash(err instanceof SculptHandoffError ? err.message : 'Could not price this piece.')
      return
    }
    const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    textToPdf(shopName, 'Custom Piece — Quote', bodyAfterTitle(sculptQuote(handoff, { brand: shopName })), `${slug}-sculpt-quote.pdf`)
  }
  const save = () => {
    if (!objects.length) { flash('Nothing to save.'); return }
    const name = saveName.trim() || describePiece(objects, alloyId).name
    sculptLibrary.save(name, objects); setSaveName(''); setSaved(sculptLibrary.list()); flash('Saved.')
  }
  const openSaved = (id: string) => { const rec = sculptLibrary.get(id); if (rec) { load(rec.objects); flash(`Loaded “${rec.name}”.`) } }
  const removeSaved = (id: string) => { sculptLibrary.remove(id); setSaved(sculptLibrary.list()) }

  // Does the bench still match the studio design, or has an AI/Design-studio
  // piece been built/changed since (so we should offer to bring it over)?
  const studioSpec = useDesign.getState().spec
  const studioSig = designSignature(studioSpec)
  const importedSig = useModeler(s => s.importedSig)
  const studioHasPiece = stoneOnPiece(studioSpec) || studioSpec.category !== 'ring' || studioSpec.setting.typeId !== 'p4'
  const studioOutOfSync = studioHasPiece && studioSig !== importedSig

  return (
    <>
      {studioOutOfSync && (
        <div className="panel-block studio-sync" style={{ borderLeft: '3px solid var(--karat)' }}>
          <p style={{ margin: '0 0 8px' }}>
            <b>Your AI-studio piece isn’t on the bench.</b> {objects.length ? 'Bring it in to sculpt it (this replaces what’s here — undoable).' : 'Bring it in to start sculpting it.'}
          </p>
          <div className="opts c2">
            <button className="primary" onClick={bringInDesign}>Bring it onto the bench →</button>
            <button className="opt" onClick={() => useModeler.setState({ importedSig: studioSig })} title="Keep what’s on the bench and hide this">Keep bench as is</button>
          </div>
        </div>
      )}
      <div className="panel-block">
        <h4>Build with AI ✦</h4>
        <textarea className="ai-asm-in" rows={2} value={aiText} onChange={e => setAiText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void runAiAssemble() } }}
          placeholder="Describe a piece — e.g. 6-prong round solitaire, 1.5 ct, white gold, size 6.5" disabled={aiAsm.busy} />
        <div className="opts c2" style={{ marginTop: 6 }}>
          <button className="primary" onClick={() => void runAiAssemble()} disabled={aiAsm.busy || !aiText.trim()}>{aiAsm.busy ? 'Designing…' : 'Assemble parts ✦'}</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={aiReplace} onChange={e => setAiReplace(e.target.checked)} /> Start fresh</label>
        </div>
        {aiAsm.err && <p className="disc" style={{ color: 'var(--warn)' }}>{aiAsm.err}</p>}
        {aiAsm.assumptions.length > 0 && (
          <div className="ai-chips" style={{ marginTop: 8 }}>{aiAsm.assumptions.map((a, i) => <span key={i} className="ai-chip" title="An assumption the AI made">≈ {a}</span>)}</div>
        )}
        {aiAsm.routes.length > 0 && (
          <div className="ai-asm-routes">
            <p className="disc" style={{ marginTop: 10 }}>Pick a build route — it assembles as editable parts:</p>
            {aiAsm.routes.map((r, i) => (
              <div key={i} className="ai-asm-route">
                <div><b>{i + 1}. {r.label}</b>{r.note && <span className="ai-asm-note"> — {r.note}</span>}</div>
                {r.matched.length > 0 && <div className="ai-chips">{r.matched.map((c, j) => <span key={j} className="ai-chip">{c}</span>)}</div>}
                <button className="opt" style={{ width: '100%', marginTop: 5 }} onClick={() => buildAiRoute(i)}>Build this in modeler</button>
              </div>
            ))}
          </div>
        )}
        {aiQuality && (
          <div className="dfm" style={{ marginTop: 10 }}>
            <p className={`dfm-line ${aiQuality.level === 'clean' ? 'pass' : aiQuality.level === 'review' ? 'warn' : 'fail'}`}>
              <b>{aiQuality.level === 'clean' ? 'Quality: clean' : aiQuality.level === 'review' ? 'Quality: review' : 'Quality: blocked'}</b>
              {aiQuality.issues.length > 0 ? ' — ' + aiQuality.issues.join(' ') : ' — all manufacturing checks pass.'}
            </p>
          </div>
        )}
        <p className="disc">The AI turns your description into real shank / stone / setting parts you can then refine with every tool below.</p>

        <div className="opts" style={{ marginTop: 10 }}>
          <button className="opt" onClick={bringInDesign} title="Import the piece from the AI / Design studio as editable parts">Bring in AI-studio piece →</button>
        </div>
        <p className="disc">Carries whatever you built on the AI / Design tab onto the bench. Switching to Sculpt with an empty bench does this automatically.</p>

        <h4 style={{ marginTop: 16 }}>Or start from a template</h4>
        <div className="opts c2">
          {DESIGN_TEMPLATES.map(t => <button key={t.id} className="opt tpl" title={t.blurb} onClick={() => buildTemplate(t.id)}>{t.name}</button>)}
        </div>

        <h4 style={{ marginTop: 18 }}>Finish with AI ✦</h4>
        <textarea className="ai-asm-in" rows={2} value={finText} onChange={e => setFinText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void runFinish() } }}
          placeholder="Tell it what to do to the piece — e.g. hammer the band, add a halo, flush-set the stone, then get it ready to print" disabled={finBusy} />
        <button className="primary" style={{ width: '100%', marginTop: 6 }} onClick={() => void runFinish()} disabled={finBusy || !finText.trim()}>{finBusy ? 'Working…' : 'Run on this piece ✦'}</button>
        <p className="disc">Drives the finishing &amp; setting tools by voice — texture, dome, halo, flush-set, milgrain, pierce, symmetrise, auto-orient, mirror, array — in the order you say them.</p>

        <h4 style={{ marginTop: 18 }}>Bench advisor ✦</h4>
        <textarea className="ai-asm-in" rows={2} value={benchQ} onChange={e => setBenchQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void askBench() } }}
          placeholder="Ask about this piece — e.g. what bur for this stone? will it cast? are the prongs enough? how heavy is it?" disabled={benchBusy} />
        <button className="primary" style={{ width: '100%', marginTop: 6 }} onClick={() => void askBench()} disabled={benchBusy || !benchQ.trim()}>{benchBusy ? 'Thinking…' : 'Ask the bench advisor ✦'}</button>
        {benchA && (
          <div className="dfm" style={{ marginTop: 8 }}>
            <p className="dfm-line pass" style={{ whiteSpace: 'pre-wrap' }}>{benchA.text}</p>
            <p className="disc">{benchA.ai ? 'Answered by AI, grounded in this piece’s measured facts.' : 'Answered from this piece’s measured geometry (AI off or unreachable).'}</p>
          </div>
        )}
        <p className="disc">Answers bench questions — setting burs, castability, prong security, weight, wall thickness — from the model’s real geometry and the same checks the print gate runs.</p>

        <div className="row" style={{ marginTop: 8 }}><label>Quick finishes</label></div>
        <div className="opts c2">
          {MACROS.map(m => <button key={m.id} className="opt" title={m.blurb} onClick={() => runMacro(m.id)}>{m.name}</button>)}
        </div>
      </div>

      <div className="panel-block">
        <h4>Jewelry parts</h4>
        <div className="opts c2">
          {PARTS.map(([k, label]) => <button key={k} className="opt tpl" onClick={() => add(k)}>{label}</button>)}
        </div>
        <h4 style={{ marginTop: 18 }}>Primitives</h4>
        <div className="opts c2">
          {PRIMS.map(([k, label]) => <button key={k} className="opt" onClick={() => add(k)}>{label}</button>)}
        </div>

        <h4 style={{ marginTop: 18 }}>Place stones</h4>
        <select className="lib-name" style={{ width: '100%' }} value={stonePick.stoneId} onChange={e => setPick({ stoneId: e.target.value })}>
          {STONES.map(s => <option key={s.id} value={s.id}>{s.name}{s.variety ? ` — ${s.variety}` : ''}</option>)}
        </select>
        <div className="row" style={{ marginTop: 8 }}>
          <select className="lib-name" style={{ width: '55%' }} value={stonePick.shapeId} onChange={e => setPick({ shapeId: e.target.value })}>
            {SHAPES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}><input className="lib-name" style={{ width: 56 }} type="number" min={0.01} step={0.05} value={stonePick.carat} onChange={e => setPick({ carat: Math.max(0.01, +e.target.value) })} /><small style={{ color: 'var(--slate)' }}>ct</small></span>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label htmlFor="mp-melee" style={{ flex: '0 0 auto' }}>Calibrated size</label>
          <select id="mp-melee" className="lib-name" style={{ width: '55%' }}
            value={(() => { const w = mmForCarat(stonePick.shapeId, stonePick.stoneId, stonePick.carat).width; const hit = MELEE_MM.find(mm => Math.abs(mm - w) < 0.03); return hit ? String(hit) : '' })()}
            onChange={e => { const mm = +e.target.value; if (mm) setPick({ carat: caratForMm(stonePick.shapeId, stonePick.stoneId, mm) }) }}>
            <option value="">— custom —</option>
            {meleeOptions(stonePick.stoneId, stonePick.shapeId).map(o => <option key={o.mm} value={o.mm}>{o.label}</option>)}
          </select>
          <small style={{ color: 'var(--slate)', marginLeft: 'auto' }}>
            {(() => { const d = mmForCarat(stonePick.shapeId, stonePick.stoneId, stonePick.carat); return d.width === d.length ? `${d.width.toFixed(2)} mm` : `${d.length.toFixed(2)}×${d.width.toFixed(2)} mm` })()}
          </small>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={stonePick.custom} onChange={e => setPick({ custom: e.target.checked })} /> Custom colour
          <span style={{ marginLeft: 'auto', width: 20, height: 14, borderRadius: 3, border: '1px solid var(--rule)', background: stonePick.custom ? `#${hueToHex(stonePick.hue).toString(16).padStart(6, '0')}` : '#ccc' }} />
        </label>
        {stonePick.custom && (
          <input type="range" min={0} max={360} step={1} value={stonePick.hue} onChange={e => setPick({ hue: +e.target.value })}
            style={{ width: '100%', marginTop: 6, accentColor: `#${hueToHex(stonePick.hue).toString(16).padStart(6, '0')}` }} />
        )}
        <div className="opts c2" style={{ marginTop: 8 }}>
          <button className="opt tpl" aria-pressed={!!placing} onClick={togglePlace}>{placing ? 'Placing… (click piece)' : 'Click to place'}</button>
          <button className="opt" onClick={addOneStone}>Add one</button>
        </div>
        <div className="opts" style={{ marginTop: 6 }}>
          <button className="opt" disabled={!sel || sel.material !== 'gem'} title="Carve a real bearing (pavilion clearance + girdle ledge) under the selected stone"
            onClick={() => { if (sel && seatStone(sel.id)) { flash('Cut a seat under the stone — bearing carved into the metal below.'); runQa() } else flash('Select a placed stone sitting over metal first.') }}>
            Cut seat under selected stone ⌵
          </button>
        </div>
        <p className="disc">Pick a stone, then <b>Click to place</b> and click on the stage to drop copies. Or <b>Add one</b>. Select a stone and <b>Cut seat</b> to carve its bearing into the setting. To move any stone: click it and drag the move gizmo.</p>

        <h4 style={{ marginTop: 18 }}>Findings</h4>
        <div className="row">
          <select className="lib-name" style={{ width: '62%' }} value={findingPick} onChange={e => setFindingPick(e.target.value)}>
            {FINDINGS.map(f => <option key={f.id} value={f.id}>{f.name} — {f.blurb}</option>)}
          </select>
          <button className="opt" style={{ marginLeft: 'auto' }} onClick={() => { const id = addFinding(findingPick); if (id) { flash(`Added a ${FINDINGS.find(f => f.id === findingPick)?.name}. Drag it into place, then solder.`); runQa() } }}>Add finding</button>
        </div>
        <p className="disc">Clasps, jump rings, bails, ear posts &amp; backs, toggles and pins — drop one on the bench, position it, and it joins the metal weight, BOM and quote.</p>

        <h4 style={{ marginTop: 18 }}>Free draw</h4>
        <div className="opts"><button className="opt tpl" aria-pressed={sketching} onClick={() => setSketching(!sketching)}>{sketching ? 'Sketching… (drawing on stage)' : 'Sketch a shape…'}</button></div>
        <div className="row" style={{ marginTop: 10 }}><label>Profile presets</label></div>
        <div className="opts c2">
          {sketchPresets.map(preset => (
            <button key={preset.id} className="opt" title={preset.builtin ? 'Built-in profile' : 'Your saved profile'}
              onClick={() => { const id = applySketchPreset(preset); select(id) }}>
              <PresetThumb sketch={preset.sketch} />
              {preset.name}
              {!preset.builtin && (
                <span role="button" aria-label={`Delete ${preset.name}`} title="Delete preset"
                  onClick={e => { e.stopPropagation(); if (window.confirm(`Delete preset “${preset.name}”?`)) deleteSketchPreset(preset.id) }}
                  style={{ marginLeft: 6, opacity: 0.55, cursor: 'pointer' }}>✕</span>
              )}
            </button>
          ))}
        </div>

        <h4 style={{ marginTop: 18 }}>Generative <small style={{ color: '#6E787B', fontWeight: 400 }}>Voronoi lattice</small></h4>
        <Slider label="Cells" value={lat.count} min={6} max={80} step={1} unit="" on={v => setLat(s => ({ ...s, count: v }))} />
        <Slider label="Strut" value={lat.strut} min={0.4} max={2.5} step={0.1} unit=" mm" on={v => setLat(s => ({ ...s, strut: v }))} />
        <Slider label="Width" value={lat.width} min={6} max={40} step={1} unit=" mm" on={v => setLat(s => ({ ...s, width: v }))} />
        <Slider label="Height" value={lat.height} min={6} max={40} step={1} unit=" mm" on={v => setLat(s => ({ ...s, height: v }))} />
        <Slider label="Thickness" value={lat.thickness} min={0.6} max={3} step={0.1} unit=" mm" on={v => setLat(s => ({ ...s, thickness: v }))} />
        <div className="opts c2" style={{ marginTop: 8 }}>
          <button className="opt" onClick={() => setLat(s => ({ ...s, seed: s.seed + 1 }))} title="New random cell arrangement">Shuffle ⟳</button>
          <button className="opt tpl" onClick={addLattice}>Add lattice ✚</button>
        </div>
        <p className="disc">{latticeHoleCount(lat)} cells pierced. Drop it in, then bend it with the vertex tools or subtract it from a band for filigree.</p>

        <div className="row" style={{ marginTop: 12 }}><label>Chain <small style={{ color: '#6E787B' }}>interlocking links</small></label></div>
        <Slider label="Links" value={chn.links} min={2} max={40} step={1} unit="" on={v => setChn(s => ({ ...s, links: v }))} />
        <Slider label="Link radius" value={chn.radius} min={1} max={8} step={0.1} unit=" mm" on={v => setChn(s => ({ ...s, radius: v }))} />
        <Slider label="Wire" value={chn.wire} min={0.3} max={2} step={0.05} unit=" mm" on={v => setChn(s => ({ ...s, wire: v }))} />
        <div className="opts" style={{ marginTop: 8 }}><button className="opt tpl" onClick={addChain}>Add chain ✚</button></div>
        <p className="disc">~{chainSpan({ ...chn }).toFixed(0)} mm straight; bend or wrap it into a bracelet or necklace with the vertex tools.</p>

        <h4 style={{ marginTop: 18 }}>Text</h4>
        <TextTool />

        <h4 style={{ marginTop: 18 }}>Edit mode</h4>
        <div className="opts">
          <button className="opt" aria-pressed={editMode === 'object'} onClick={() => setEditMode('object')}>Object</button>
          <button className="opt" aria-pressed={editMode === 'vertex'} onClick={() => setEditMode('vertex')}>Vertices</button>
          <button className="opt" aria-pressed={editMode === 'surface'} onClick={() => setEditMode('surface')}>Surface</button>
        </div>
        {editMode === 'object' ? (
          <>
            <div className="opts" style={{ marginTop: 8 }}>
              {(['translate', 'rotate', 'scale'] as const).map(m => (
                <button key={m} className="opt" aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {m === 'translate' ? 'Move' : m === 'rotate' ? 'Rotate' : 'Scale'}
                </button>
              ))}
            </div>
            <label className="filter-row" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={snap} onChange={toggleSnap} />
              Snap to grid<small>0.5 mm · 15°</small>
            </label>
            <label className="filter-row" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={heatmap} onChange={toggleHeatmap} />
              Wall-thickness map<small>colour metal by thickness</small>
            </label>
            {heatmap && (
              <div className="heat-legend">
                <span><i style={{ background: '#D62E29' }} />Too thin &lt;{HEATMAP_MIN_WALL} mm</span>
                <span><i style={{ background: '#DB9E3D' }} />Marginal</span>
                <span><i style={{ background: '#4DB36B' }} />Healthy</span>
              </div>
            )}
          </>
        ) : editMode === 'vertex' ? (
          <>
            <Slider label="Region" value={falloff} min={0.4} max={14} step={0.2} unit=" mm" on={setFalloff} />
            <label className="filter-row" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={symmetry} onChange={toggleSymmetry} />
              Mirror-X symmetry<small>sculpt both sides at once</small>
            </label>
            <p className="disc">On a <b>sketch</b>: drag a node to reshape, click the surface to add a node, right-click a node to delete. On any <b>part</b> (shank, gem, primitive…): switching to <b>Vertices</b> makes it editable automatically — click a point and drag the gizmo; nearby vertices follow within the region radius.</p>
          </>
        ) : (
          <>
            <div className="opts c2" style={{ marginTop: 8 }}>
              <button className="opt" aria-pressed={surfaceOp === 'emboss'} onClick={() => setSurfaceOp('emboss')}>Emboss</button>
              <button className="opt" aria-pressed={surfaceOp === 'cut'} onClick={() => setSurfaceOp('cut')}>Cut</button>
            </div>
            <Slider label="Brush" value={brush} min={0.15} max={3} step={0.05} unit=" mm" on={setBrush} />
            <p className="disc">Select a part, then <b>drag on its surface</b> to {surfaceOp === 'cut' ? 'cut an engraved groove into it' : 'raise an embossed line on it'}. Each stroke becomes a tube that’s {surfaceOp === 'cut' ? 'subtracted from' : 'fused onto'} the part — undo reverts it.</p>
          </>
        )}
      </div>

      <div className="panel-block metalreq quote">
        <h4>Metal &amp; weight
          <select className="unit" value={alloyId} onChange={e => setAlloy(e.target.value)} style={{ marginLeft: 'auto' }}>
            {ALLOYS.map(a => <option key={a.id} value={a.id}>{a.short}</option>)}
          </select>
        </h4>
        <div className="qline"><span>Volume</span><span>{Math.round(vol).toLocaleString()} mm³</span></div>
        <div className="qline hi"><span>Cast weight <i>{alloy.name}</i></span><span>{castG.toFixed(2)} g</span></div>
        <div className="qline resize-w">
          <span>Resize to weight</span>
          <span className="resize-ctl">
            <input type="number" min={0.2} step={0.1} value={targetG} placeholder={castG > 0 ? castG.toFixed(1) : '—'}
              onChange={e => setTargetG(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyResizeToWeight() }} aria-label="Target cast weight in grams" />
            <button className="opt" onClick={applyResizeToWeight} disabled={!objects.length}>Set g</button>
          </span>
        </div>
        <div className="opts c2" style={{ marginTop: 8 }}>
          <button className="opt tpl" onClick={checkBalance} title="Center of mass — will the ring sit still or rotate on the finger?">Check balance ⚖</button>
          <button className="opt tpl" onClick={() => setSeatRep(seatReport(objects))} title="Do the prongs/bezel cover the girdle and hold the stone?">Check stone seat 💎</button>
        </div>
        <div className="opts c2" style={{ marginTop: 8 }}>
          <button className="opt tpl" onClick={checkOverhang} title="How much downward-facing surface a resin/FDM print would need supports under">Check print supports 🖨</button>
          <button className="opt tpl" onClick={checkSymmetry} title="How mirror-symmetric the selected part is across a plane">Check symmetry ⟷</button>
        </div>
        <div className="opts" style={{ marginTop: 6 }}>
          {(['x', 'y', 'z'] as const).map(ax => <button key={ax} className="opt" aria-pressed={symAxis === ax} onClick={() => setSymAxis(ax)} title={`Mirror plane for the symmetry check / symmetrise`}>{ax.toUpperCase()}</button>)}
        </div>
        <div className="opts c2" style={{ marginTop: 6 }}>
          <button className="opt tpl" onClick={doSymmetrize} title={`Mirror one half across ${symAxis.toUpperCase()} to force perfect symmetry`}>Symmetrise across {symAxis.toUpperCase()}</button>
          <button className="opt tpl" onClick={doAutoOrient} title="Rotate the whole piece to the orientation needing least support">Auto-orient for print</button>
        </div>
        {over && (
          <div className="dfm">
            <div className="dfm-metrics"><span>down-facing {Math.round(over.fraction * 100)}%</span></div>
            <p className={`dfm-line ${over.level === 'good' ? 'pass' : over.level === 'some' ? 'warn' : 'fail'}`}>
              <b>{over.level === 'good' ? 'Prints clean' : over.level === 'some' ? 'Some supports' : 'Heavy supports'}</b> — {over.note}
            </p>
          </div>
        )}
        {sym !== null && (
          <div className="dfm">
            <p className={`dfm-line ${sym > 0.9 ? 'pass' : sym > 0.75 ? 'warn' : 'fail'}`}>
              <b>Symmetry {Math.round(sym * 100)}%</b> across {symAxis.toUpperCase()} — {sym > 0.9 ? 'the two halves match well.' : sym > 0.75 ? 'slightly off — worth a look.' : 'the halves diverge; mirror one side if they should match.'}
            </p>
          </div>
        )}
        {bal && (
          <div className={`dfm bal-${bal.verdict}`}>
            <div className="dfm-metrics">
              <span>off-axis {bal.radialOffset.toFixed(2)} mm</span>
              <span>ratio {(bal.ratio * 100).toFixed(0)}%</span>
              <span>span {(bal.bboxRadius * 2).toFixed(1)} mm</span>
            </div>
            <p className={`dfm-line ${bal.verdict === 'balanced' ? 'pass' : bal.verdict === 'slight' ? 'warn' : 'fail'}`}>
              <b>{bal.verdict === 'balanced' ? 'Balanced' : bal.verdict === 'slight' ? 'Slightly off-axis' : bal.verdict === 'topheavy' ? 'Top-heavy' : 'Empty'}</b> — {bal.note}
            </p>
          </div>
        )}
        {seatRep && (
          <div className="dfm">
            {seatRep.level !== 'none' && (
              <div className="dfm-metrics">
                <span>girdle cover {Math.round(seatRep.coverage * 100)}%</span>
                <span>over girdle {seatRep.aboveGirdle.toFixed(2)} mm</span>
              </div>
            )}
            <p className={`dfm-line ${seatRep.level === 'pass' ? 'pass' : seatRep.level === 'warn' ? 'warn' : seatRep.level === 'fail' ? 'fail' : ''}`}>
              <b>{seatRep.level === 'pass' ? 'Secure' : seatRep.level === 'warn' ? 'Marginal' : seatRep.level === 'fail' ? 'Not held' : 'Stone seat'}</b> — {seatRep.note}
            </p>
          </div>
        )}
        <div className="qact">
          <button className="primary" disabled={sendingOrder} onClick={sendToOrder}>
            {sendingOrder ? 'Sending…' : 'Send to order →'}
          </button>
        </div>
        <p className="disc">
          Saves this piece — geometry, alloy, weight and price — as a design on the server and opens an order,
          so a sculpted piece goes through the same pipeline as a configured one.
          {!apiConfigured() && <> Needs a connected backend (currently standalone).</>}
        </p>
        {warnings.length > 0 && (
          <div className="sculpt-warns">
            {warnings.map((w, i) => <p key={i} className="warn-line"><b>{w.part}</b> — {w.text}</p>)}
          </div>
        )}
        <p className="disc">Retail at ×{MARKET.margin.toFixed(2)} margin. Metal is exact from the summed part volume; stones use catalog rates. Overlaps double-count until you <b>Fuse metal</b>. Tune spot, margin and fees on the Design tab’s cost settings.</p>
      </div>

      <div className="panel-block">
        <h4>Objects <span className="mfg-sum"><b className="ok">{objects.length}</b></span></h4>
        {objects.length === 0 && <p className="disc">Add a part or primitive above.</p>}
        {objects.map(o => (
          <div key={o.id} className={`lib-row obj-row ${o.id === selectedId ? 'sel' : ''}`} onClick={() => select(o.id)}>
            <div className="lib-meta"><b>{o.name}</b><small>{o.kind}{o.material === 'gem' ? ' · gem' : ''}</small></div>
            <div className="lib-acts">
              <button className="mini" onClick={e => { e.stopPropagation(); duplicate(o.id) }}>Dup</button>
              <button className="mini danger" onClick={e => { e.stopPropagation(); remove(o.id) }}>×</button>
            </div>
          </div>
        ))}
      </div>

      {sel && (
        <div className="panel-block">
          <h4>{sel.name}</h4>
          <div className="opts c2">
            {(['metal', 'gem'] as SculptMaterial[]).map(m => (
              <button key={m} className="opt" aria-pressed={sel.material === m} onClick={() => update(sel.id, { material: m, color: SCULPT_COLORS[m] })}>
                {m === 'metal' ? 'Metal' : 'Gemstone'}
              </button>
            ))}
          </div>

          <ParamControls sel={sel} />

          {sel.kind === 'mesh' ? (
            <>
              <div className="opts" style={{ marginTop: 12 }}>
                <button className="opt" aria-pressed={editMode === 'vertex'} onClick={() => { select(sel.id); setEditMode('vertex') }}>
                  {editMode === 'vertex' ? 'Editing vertices ✓' : 'Edit vertices'}
                </button>
              </div>
              <div className="opts c2" style={{ marginTop: 8 }}>
                <button className="opt" onClick={() => smoothMesh(sel.id, Math.max(falloff, 1.2))} title="Relax lumps within the region radius">Smooth</button>
                <button className="opt" disabled={(sel.vertices?.length ?? 0) > 60000}
                  onClick={() => (sel.vertices?.length ?? 0) > 60000 ? flash('Mesh is already very dense.') : subdivideMesh(sel.id)}
                  title="Split each face into four for finer control">Subdivide</button>
              </div>
              <p className="disc" style={{ marginTop: 12, marginBottom: 4 }}>Deform (about the up axis · repeat to compound)</p>
              <div className="opts" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                <button className="opt" onClick={() => twistMesh(sel.id, 30)} title="Twist cross-sections around the vertical axis">Twist ↻</button>
                <button className="opt" onClick={() => taperMesh(sel.id, 0.7)} title="Narrow toward the top">Taper ▽</button>
                <button className="opt" onClick={() => bendMesh(sel.id, 25)} title="Bend into an arc">Bend ⌒</button>
                <button className="opt" onClick={() => twistMesh(sel.id, -30)} title="Twist the other way">Twist ↺</button>
                <button className="opt" onClick={() => taperMesh(sel.id, 1.4)} title="Flare toward the top">Flare △</button>
                <button className="opt" onClick={() => bendMesh(sel.id, -25)} title="Bend the other way">Bend ⌄</button>
              </div>
              <div className="opts" style={{ marginTop: 8 }}>
                <button className="opt tpl" onClick={() => { if (sel.vertices) setDfm({ id: sel.id, r: analyzeMesh(sel.vertices) }) }} title="Ray-cast wall thickness, watertightness and overhangs">Analyze for printing</button>
                <button className="opt tpl" onClick={() => repair(sel)} title="Weld duplicate points, drop degenerate faces, and cap open holes so it slices and casts cleanly">Repair mesh ✚</button>
              </div>
              <p className="disc">{Math.round((sel.vertices?.length ?? 0) / 3).toLocaleString()} triangles</p>
              {dfm && dfm.id === sel.id && (
                <div className="dfm">
                  <div className="dfm-metrics">
                    <span>{dfm.r.watertight ? 'watertight' : `${dfm.r.boundaryEdges} open edges`}</span>
                    <span>min wall {dfm.r.minWall === Infinity ? '—' : `${dfm.r.minWall.toFixed(2)} mm`}</span>
                    <span>{Math.round(dfm.r.overhangFraction * 100)}% overhang</span>
                  </div>
                  {dfm.r.issues.map((iss, i) => (
                    <p key={i} className={`dfm-line ${iss.level}`}><b>{iss.title}</b> — {iss.detail}</p>
                  ))}
                </div>
              )}
            </>
          ) : sel.kind !== 'sketch' ? (
            <div className="opts" style={{ marginTop: 12 }}>
              <button className="opt tpl" aria-pressed={editMode === 'vertex'} onClick={() => { select(sel.id); setEditMode('vertex') }}>
                {editMode === 'vertex' ? 'Editing vertices ✓' : 'Edit vertices →'}
              </button>
            </div>
          ) : null}

          {!['shank', 'gem', 'head', 'bezel'].includes(sel.kind) && sel.kind !== 'mesh' && sel.kind !== 'sketch' && (
            <Slider label="Size" value={sel.size} min={1} max={30} step={0.5} unit="" on={v => update(sel.id, { size: v })} />
          )}
          <Slider label="Height" value={sel.position[1]} min={-10} max={30} step={0.5} unit="" on={v => update(sel.id, { position: [sel.position[0], v, sel.position[2]] })} />
          <Slider label="Uniform scale" value={sel.scale[0]} min={0.1} max={4} step={0.05} unit="×" on={v => update(sel.id, { scale: [v, v, v] })} />

          <div className="row" style={{ marginTop: 14 }}><label>Dimensions</label><span className="val">{dims[0].toFixed(1)} × {dims[1].toFixed(1)} × {dims[2].toFixed(1)} mm</span></div>
          <div className="subhead" style={{ marginTop: 10 }}>Position (mm)</div>
          <div className="xyz">
            {[0, 1, 2].map(i => (
              <input key={i} type="number" step={0.5} value={round1(sel.position[i])}
                onChange={e => { const p = [...sel.position] as [number, number, number]; p[i] = +e.target.value; update(sel.id, { position: p }) }} />
            ))}
          </div>
          <div className="subhead" style={{ marginTop: 8 }}>Rotation (°)</div>
          <div className="xyz">
            {[0, 1, 2].map(i => (
              <input key={i} type="number" step={5} value={Math.round(sel.rotation[i] * DEG)}
                onChange={e => { const r = [...sel.rotation] as [number, number, number]; r[i] = (+e.target.value) / DEG; update(sel.id, { rotation: r }) }} />
            ))}
          </div>
          <div className="opts" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 10 }}>
            <button className="opt" onClick={() => mirror(sel.id)}>Mirror X</button>
            <button className="opt" onClick={() => centerObject(sel.id)}>Center X/Z</button>
            <button className="opt" onClick={() => dropToFloor(sel.id)} title="Seat the part on the build plate (y=0) for casting/printing">Drop to floor</button>
          </div>
          <div className="opts c2" style={{ marginTop: 8 }}>
            <button className="opt" onClick={() => update(sel.id, { position: [0, 0, 0] })} title="Move to the origin (0,0,0)">Reset position</button>
            <button className="opt" onClick={() => update(sel.id, { rotation: [0, 0, 0] })} title="Clear rotation">Reset rotation</button>
          </div>

          {sel.kind === 'gem' && (
            <>
              <h4 style={{ marginTop: 20 }}>Auto-seat</h4>
              <select className="lib-name" style={{ width: '100%' }} value={seatTarget} onChange={e => setSeatTarget(e.target.value)}>
                <option value="">Bore seat into…</option>
                {metalObjects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <div className="opts" style={{ marginTop: 8 }}><button className="opt" onClick={() => boreSeat(sel)}>Bore seat</button></div>
              <p className="disc">Cuts a conical seat into the chosen metal directly below the gem.</p>
            </>
          )}

          <h4 style={{ marginTop: 20 }}>Array <small style={{ color: '#6E787B', fontWeight: 400 }}>eternity · halo · pavé</small></h4>
          <div className="row"><label>Count</label><input className="lib-name" style={{ width: 64 }} type="number" min={2} max={60} value={count} onChange={e => setCount(Math.max(2, +e.target.value))} /></div>
          <div className="opts c2" style={{ marginTop: 8 }}>
            <button className="opt" onClick={() => arrayCircular(sel.id, count)}>Ring array</button>
            <button className="opt" onClick={() => arrayLinear(sel.id, count, sel.size || 4)}>Row array</button>
          </div>

          <h4 style={{ marginTop: 20 }}>Boolean</h4>
          <select className="lib-name" style={{ width: '100%' }} value={otherId} onChange={e => setOtherId(e.target.value)}>
            <option value="">Combine with…</option>
            {others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <div className="opts" style={{ marginTop: 8 }}>
            {OPS.map(([op, label]) => <button key={op} className="opt" onClick={() => doBoolean(op)}>{label}</button>)}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={keepCutter} onChange={e => setKeepCutter(e.target.checked)} /> Keep the cutter (reuse it on other parts)</label>
          <button className="opt" style={{ width: '100%', marginTop: 8 }} onClick={doSubtractAll} title="Subtract the selected part from every other metal part at once">Cut all metal with this part</button>

          <h4 style={{ marginTop: 20 }}>Channel rails</h4>
          <div className="opts c2" style={{ marginBottom: 6 }}>
            <button className="opt" aria-pressed={rails.along === 'x'} onClick={() => setRails(r => ({ ...r, along: 'x' }))}>Along X</button>
            <button className="opt" aria-pressed={rails.along === 'z'} onClick={() => setRails(r => ({ ...r, along: 'z' }))}>Along Z</button>
          </div>
          <div className="row"><label>Length mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={1} step={0.5} value={rails.length} onChange={e => setRails(r => ({ ...r, length: Math.max(1, +e.target.value) }))} /></div>
          <div className="row"><label>Inner gap mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.2} step={0.1} value={rails.innerGap} onChange={e => setRails(r => ({ ...r, innerGap: Math.max(0.2, +e.target.value) }))} /></div>
          <div className="row"><label>Height mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.3} step={0.1} value={rails.height} onChange={e => setRails(r => ({ ...r, height: Math.max(0.3, +e.target.value) }))} /></div>
          <div className="row"><label>Thickness mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.2} step={0.1} value={rails.thickness} onChange={e => setRails(r => ({ ...r, thickness: Math.max(0.2, +e.target.value) }))} /></div>
          <button className="opt" style={{ width: '100%', marginTop: 4 }} onClick={doRails}>Add channel rails</button>
          <p className="disc">Two flanking walls for a channel setting, centred on the selected part. Drop a Row pavé between them and the stones sit in the channel.</p>

          <h4 style={{ marginTop: 20 }}>Surface texture</h4>
          <div className="opts" style={{ marginBottom: 6 }}>
            {(['hammered', 'stipple', 'florentine'] as const).map(st => <button key={st} className="opt" aria-pressed={tex.style === st} onClick={() => setTex(t => ({ ...t, style: st }))}>{st[0].toUpperCase() + st.slice(1)}</button>)}
          </div>
          <div className="row"><label>Depth mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.02} step={0.02} value={tex.amp} onChange={e => setTex(t => ({ ...t, amp: Math.max(0.02, +e.target.value) }))} /></div>
          <div className="row"><label>Feature mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.2} step={0.1} value={tex.scale} onChange={e => setTex(t => ({ ...t, scale: Math.max(0.2, +e.target.value) }))} /></div>
          <button className="opt" style={{ width: '100%', marginTop: 4 }} onClick={doTexture}>Texture this part</button>

          <h4 style={{ marginTop: 18 }}>Milgrain, signet &amp; wire</h4>
          <div className="row"><label>Milgrain R mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.5} step={0.5} value={mil.radius} onChange={e => setMil(m => ({ ...m, radius: Math.max(0.5, +e.target.value) }))} /></div>
          <div className="row"><label>Bead Ø mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.2} step={0.1} value={mil.beadDia} onChange={e => setMil(m => ({ ...m, beadDia: Math.max(0.2, +e.target.value) }))} /></div>
          <div className="row"><label>Signet W×L mm</label><span style={{ display: 'flex', gap: 4 }}><input className="lib-name" style={{ width: 44 }} type="number" min={1} step={0.5} value={signet.width} onChange={e => setSignet(s2 => ({ ...s2, width: Math.max(1, +e.target.value) }))} /><input className="lib-name" style={{ width: 44 }} type="number" min={1} step={0.5} value={signet.length} onChange={e => setSignet(s2 => ({ ...s2, length: Math.max(1, +e.target.value) }))} /></span></div>
          <div className="row"><label>Signet thick mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.3} step={0.1} value={signet.thickness} onChange={e => setSignet(s2 => ({ ...s2, thickness: Math.max(0.3, +e.target.value) }))} /></div>
          <div className="opts c2" style={{ marginTop: 4 }}>
            <button className="opt" onClick={doMilgrain}>Add milgrain ring</button>
            <button className="opt" onClick={doSignet}>Add signet face</button>
          </div>
          <div className="row" style={{ marginTop: 10 }}><label>Dome height mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.1} step={0.1} value={domeH} onChange={e => setDomeH(Math.max(0.1, +e.target.value))} /></div>
          <div className="opts c2" style={{ marginTop: 4 }}>
            <button className="opt" onClick={doDome} title="Bulge the top into a cabochon / comfort dome">Dome the top</button>
            <button className="opt" onClick={doSizingBeads} title="Two beads on the inner band bottom to snug the fit">Add sizing beads</button>
          </div>
          <div className="opts c2" style={{ marginTop: 6 }}>
            <button className="opt" onClick={doBridge}>Bridge wire → Boolean pick</button>
            <div className="row" style={{ margin: 0 }}><label>Wire Ø</label><input className="lib-name" style={{ width: 48 }} type="number" min={0.2} step={0.1} value={wire} onChange={e => setWire(Math.max(0.2, +e.target.value))} /></div>
          </div>

          <h4 style={{ marginTop: 18 }}>Pierce holes</h4>
          <div className="opts c2" style={{ marginBottom: 6 }}>
            <button className="opt" aria-pressed={pierce.mode === 'row'} onClick={() => setPierce(p => ({ ...p, mode: 'row' }))}>Row</button>
            <button className="opt" aria-pressed={pierce.mode === 'ring'} onClick={() => setPierce(p => ({ ...p, mode: 'ring' }))}>Ring</button>
          </div>
          <div className="row"><label>Holes</label><input className="lib-name" style={{ width: 64 }} type="number" min={1} value={pierce.count} onChange={e => setPierce(p => ({ ...p, count: Math.max(1, +e.target.value) }))} /></div>
          <div className="row"><label>Hole Ø mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.2} step={0.1} value={pierce.dia} onChange={e => setPierce(p => ({ ...p, dia: Math.max(0.2, +e.target.value) }))} /></div>
          <div className="row"><label>{pierce.mode === 'ring' ? 'Ring R mm' : 'Spacing mm'}</label><input className="lib-name" style={{ width: 64 }} type="number" min={0} step={0.5} value={pierce.span} onChange={e => setPierce(p => ({ ...p, span: Math.max(0, +e.target.value) }))} /></div>
          <div className="opts" style={{ marginTop: 4 }}>
            {(['x', 'y', 'z'] as const).map(ax => <button key={ax} className="opt" aria-pressed={pierce.axis === ax} onClick={() => setPierce(p => ({ ...p, axis: ax }))}>{ax.toUpperCase()}</button>)}
          </div>
          <button className="opt" style={{ width: '100%', marginTop: 8 }} onClick={doPierce}>Pierce pattern</button>

          <h4 style={{ marginTop: 20 }}>Pavé / channel fill</h4>
          <div className="opts c2" style={{ marginBottom: 8 }}>
            <button className="opt" aria-pressed={pave.mode === 'row'} onClick={() => setPave(p => ({ ...p, mode: 'row' }))}>Row / channel</button>
            <button className="opt" aria-pressed={pave.mode === 'ring'} onClick={() => setPave(p => ({ ...p, mode: 'ring' }))}>Ring / eternity</button>
          </div>
          <div className="row"><label>Stones</label><input className="lib-name" style={{ width: 64 }} type="number" min={1} max={200} value={pave.count} onChange={e => setPave(p => ({ ...p, count: Math.max(1, +e.target.value) }))} /></div>
          <div className="row"><label>Stone ct</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.005} step={0.01} value={pave.carat} onChange={e => setPave(p => ({ ...p, carat: Math.max(0.005, +e.target.value) }))} /></div>
          <div className="row"><label>Gap mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0} step={0.05} value={pave.gap} onChange={e => setPave(p => ({ ...p, gap: Math.max(0, +e.target.value) }))} /></div>
          {pave.mode === 'ring' && <div className="row"><label>Radius mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0} step={0.5} value={pave.radius} onChange={e => setPave(p => ({ ...p, radius: Math.max(0, +e.target.value) }))} title="0 = auto-fit the stones into a closed ring" /></div>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={pave.cutSeats} onChange={e => setPave(p => ({ ...p, cutSeats: e.target.checked }))} /> Carve a seat under each stone{sel.material !== 'metal' ? ' (select a metal part)' : ''}</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={pave.snap} onChange={e => setPave(p => ({ ...p, snap: e.target.checked }))} /> Drop stones onto the part's surface</label>
          <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={doPave}>Fill pavé</button>
          <p className="disc">Drops {pave.count} evenly-spaced stones {pave.mode === 'ring' ? 'around a ring' : 'in a straight run'}, anchored on the selected part.{pave.cutSeats && sel.material === 'metal' ? ' A seat is cut under each into this part.' : ''}</p>

          {sel.material === 'gem' && (<>
            <h4 style={{ marginTop: 20 }}>Set this stone</h4>
            <div className="row"><label>Prongs</label><input className="lib-name" style={{ width: 64 }} type="number" min={3} max={8} value={headProngs} onChange={e => setHeadProngs(Math.max(3, Math.min(8, +e.target.value)))} /></div>
            <div className="opts c2" style={{ marginTop: 4 }}>
              <button className="opt" onClick={doFitHead}>Fit prong head</button>
              <button className="opt" onClick={doFitBezel}>Fit bezel</button>
            </div>
            <button className="opt" style={{ width: '100%', marginTop: 6 }} onClick={doFlush}>Flush / gypsy set into metal below</button>
            <button className="opt" style={{ width: '100%', marginTop: 6 }} onClick={doGallery}>Add gallery ring under stone</button>
            <p className="disc">Head or bezel auto-sized to this stone's girdle. Flush-set carves a seat in the metal directly beneath and sinks the stone level with the surface.</p>

            <h4 style={{ marginTop: 18 }}>Halo</h4>
            <div className="row"><label>Accents</label><input className="lib-name" style={{ width: 64 }} type="number" min={3} max={60} value={halo.count} onChange={e => setHalo(h => ({ ...h, count: Math.max(3, +e.target.value) }))} /></div>
            <div className="row"><label>Accent ct</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.005} step={0.01} value={halo.carat} onChange={e => setHalo(h => ({ ...h, carat: Math.max(0.005, +e.target.value) }))} /></div>
            <button className="opt" style={{ width: '100%', marginTop: 4 }} onClick={doHalo}>Add halo around this stone</button>
          </>)}

          <h4 style={{ marginTop: 20 }}>Drill &amp; bail</h4>
          <div className="row"><label>Hole Ø mm</label><input className="lib-name" style={{ width: 64 }} type="number" min={0.2} step={0.1} value={drill.dia} onChange={e => setDrill(d => ({ ...d, dia: Math.max(0.2, +e.target.value) }))} /></div>
          <div className="opts" style={{ marginTop: 4 }}>
            {(['x', 'y', 'z'] as const).map(ax => <button key={ax} className="opt" aria-pressed={drill.axis === ax} onClick={() => setDrill(d => ({ ...d, axis: ax }))}>{ax.toUpperCase()}</button>)}
          </div>
          <div className="opts c2" style={{ marginTop: 8 }}>
            <button className="opt" onClick={doDrill}>Drill through-hole</button>
            <button className="opt" onClick={doBail}>Add bail / loop</button>
          </div>
          <p className="disc">Drill bores a clean hole along the chosen axis (sprue, drainage or finger holes). Bail hangs a loop off the top for a pendant.</p>
        </div>
      )}

      <div className="panel-block">
        <h4>History</h4>
        <div className="opts c2">
          <button className="opt" disabled={!past.length} onClick={undo} title="Ctrl/⌘+Z">↶ Undo</button>
          <button className="opt" disabled={!future.length} onClick={redo} title="Ctrl/⌘+Shift+Z">↷ Redo</button>
        </div>

        <h4 style={{ marginTop: 18 }}>Saved sculpts</h4>
        <div className="lib-save">
          <input className="lib-name" placeholder="Name this sculpt" value={saveName}
            onChange={e => setSaveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save() }} />
          <button className="primary" onClick={save}>Save</button>
        </div>
        {saved.length === 0 && <p className="disc">Nothing saved yet. Saved sculpts live in this browser.</p>}
        {saved.map(s => (
          <div key={s.id} className="lib-row obj-row">
            <div className="lib-meta"><b>{s.name}</b><small>{s.objects.length} part{s.objects.length === 1 ? '' : 's'} · {new Date(s.at).toLocaleDateString()}</small></div>
            <div className="lib-acts">
              <button className="mini" onClick={() => openSaved(s.id)}>Load</button>
              <button className="mini danger" onClick={() => removeSaved(s.id)}>×</button>
            </div>
          </div>
        ))}

        {apiConfigured() && (
          <>
            <div className="row" style={{ marginTop: 18 }}>
              <label>On the server</label>
              <button className="mini" onClick={() => void refreshServer()} disabled={loadingServer}>
                {loadingServer ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            {serverDesigns.length === 0
              ? <p className="disc">{loadingServer ? 'Loading…' : 'Nothing saved on the server yet. “Send to order” puts a piece here.'}</p>
              : serverDesigns.map(d => (
                  <div key={d.id} className="lib-row obj-row">
                    <div className="lib-meta"><b>{d.name}</b><small>{new Date(d.updated_at.replace(' ', 'T') + 'Z').toLocaleString()}</small></div>
                    <div className="lib-acts">
                      <button className="mini" onClick={() => void reopen(d.id, d.name)}>Reopen</button>
                    </div>
                  </div>
                ))}
            <p className="disc">Sculpted pieces reopen here with their geometry and alloy. Configured designs live on the Design tab.</p>
          </>
        )}
      </div>

      <PartsLibrary />

      {sched.totalStones > 0 && (
        <div className="panel-block">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h4 style={{ margin: 0 }}>Stone schedule</h4>
            <button className="mini" onClick={copySchedule}>Copy</button>
          </div>
          <table className="stone-sched">
            <tbody>
              {sched.rows.map((r, i) => (
                <tr key={i}><td>{r.count}×</td><td>{r.shapeName}</td><td>{r.carat} ct</td><td>{r.mm.toFixed(2)} mm</td></tr>
              ))}
            </tbody>
          </table>
          <p className="disc">{sched.totalStones} stones · {sched.totalCarat.toFixed(2)} ct total. Copy hands your supplier the exact order.</p>
        </div>
      )}

      {objects.length > 0 && (() => {
        const ps = pieceSummary(objects, alloyId)
        return (
          <div className="panel-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h4 style={{ margin: 0 }}>Piece summary</h4>
              <span style={{ display: 'flex', gap: 6 }}><button className="mini" onClick={copySummary}>Copy</button><button className="mini" onClick={copySpec} title="Copy the full design specification">Spec</button><button className="mini" onClick={specPdf} title="Export the design specification as a PDF">Spec PDF</button><button className="mini" onClick={copyDescribe} title="Plain-language name & description">Describe</button></span>
            </div>
            <table className="stone-sched">
              <tbody>
                <tr><td>Overall</td><td>{ps.dims[0].toFixed(1)} × {ps.dims[1].toFixed(1)} × {ps.dims[2].toFixed(1)} mm</td></tr>
                <tr><td>Cast weight</td><td>{ps.castG.toFixed(2)} g · {alloy.name}</td></tr>
                <tr><td>Stones</td><td>{ps.gemCount} · {ps.carats.toFixed(2)} ct</td></tr>
                <tr><td>Warnings</td><td>{ps.warnings}</td></tr>
              </tbody>
            </table>
          </div>
        )
      })()}

      {metalCount > 0 && (() => {
        const vol = sculptMetalVolume(objects)
        const rows = alloyCostTable(vol)
        return (
          <div className="panel-block">
            <h4 style={{ margin: 0 }}>Metal cost by alloy</h4>
            <table className="stone-sched">
              <tbody>
                {rows.slice(0, 8).map(r => (
                  <tr key={r.id}><td>{r.name}</td><td>{r.grams.toFixed(2)} g</td><td>${r.cost.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="disc">Same metal volume ({(vol / 1000).toFixed(3)} cm³) cast in each alloy, at the shop's current spot factor. Stones and labor not included.</p>
          </div>
        )
      })()}

      {metalCount > 0 && (() => {
        const lb = laborBreakdown(objects, alloyId)
        if (!lb.lines.length) return null
        return (
          <div className="panel-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h4 style={{ margin: 0 }}>Labor &amp; bench time</h4>
              <b style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{formatMinutes(lb.totalMinutes)} · {money(lb.laborCost)}</b>
            </div>
            <table className="stone-sched">
              <tbody>
                {lb.lines.map((l, i) => (
                  <tr key={i}><td>{l.op}</td><td>{l.detail}</td><td>{formatMinutes(l.minutes)}</td><td>{money(l.cost)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="disc">Estimated bench time by operation at {money(MARKET.laborRate)}/hr (set on the Design tab’s cost settings). Setting scales with each stone’s size; finishing with metal mass.</p>
          </div>
        )
      })()}

      {objects.length > 0 && (() => {
        const b = sculptBom(objects, alloyId)
        return (
          <div className="panel-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h4 style={{ margin: 0 }}>Bill of materials</h4>
              <button className="mini" onClick={() => { navigator.clipboard?.writeText(sculptBomText(objects, alloyId, shopName)).then(() => flash('BOM copied.'), () => flash('Could not copy.')) }}>Copy</button>
            </div>
            <table className="stone-sched">
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i}><td>{r.qty}×</td><td>{r.item}</td><td>{r.material}</td><td>{r.detail}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="disc">{b.metalParts} metal part{b.metalParts === 1 ? '' : 's'} · {b.metalGrams.toFixed(2)} g{b.gemCount ? ` · ${b.gemCount} stone${b.gemCount === 1 ? '' : 's'}, ${b.carats.toFixed(2)} ct` : ''}. Findings and parts count here as soon as you add them.</p>
            <div className="row" style={{ marginTop: 6 }}>
              <label htmlFor="mp-explode" style={{ flex: '0 0 auto' }}>Exploded view</label>
              <input id="mp-explode" type="range" min={0} max={30} step={1} value={explode} onChange={e => setExplode(+e.target.value)} style={{ flex: 1, marginLeft: 8 }} />
              <small style={{ color: 'var(--slate)', marginLeft: 8 }}>{explode ? `${explode} mm` : 'off'}</small>
            </div>
          </div>
        )
      })()}

      {objects.length > 0 && (() => {
        const pr = printReadiness(objects, alloyId)
        const label = pr.verdict === 'pass' ? 'Print-ready' : pr.verdict === 'warn' ? 'Print-ready with notes' : 'Not print-ready'
        return (
          <div className="panel-block">
            <h4>Fix for print</h4>
            <div className={`dfm print-gate ${pr.verdict}`}>
              <div className="dfm-metrics">
                <span>{pr.watertight ? 'watertight' : `${pr.openEdges} open edge${pr.openEdges === 1 ? '' : 's'}`}</span>
                <span>min wall {pr.minWall === Infinity ? '—' : `${pr.minWall.toFixed(2)} mm`} / {pr.minWallLimit.toFixed(2)}</span>
                <span>{Math.round(pr.overhangFraction * 100)}% overhang</span>
              </div>
              <p className={`dfm-line ${pr.verdict}`}><b>{label}</b></p>
              {pr.issues.filter(i => i.level !== 'pass').map((iss, i) => (
                <p key={i} className={`dfm-line ${iss.level}`}><b>{iss.title}</b> — {iss.detail}</p>
              ))}
            </div>
            <div className="qact" style={{ marginTop: 8 }}>
              <button className="primary" onClick={runFixForPrint} title="Weld points, drop slivers, cap holes across every metal part so it slices and casts clean">Fix all for print ✚</button>
            </div>
            <p className="disc">Checks every metal part against the {minWallForAlloy(alloyId).toFixed(2)} mm minimum for this alloy, watertightness and support burden. Export warns if it would fail.</p>
          </div>
        )
      })()}

      <div className="panel-block quote">
        <div className="qact"><button className="primary" onClick={exportStl} title="Binary STL — the slicer/caster standard">Export STL</button><button className="ghost" onClick={export3mf} title="3MF — modern container, parts stay separate">Export 3MF</button><button className="ghost" onClick={exportObj} title="Named parts + metal/gem groups, for ZBrush / Blender / Matrix / RhinoGold">Export OBJ</button></div>
        <div className="qact" style={{ marginTop: 8 }}>
          <label className="ghost" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }} title="Bring in an existing STL model or scan to modify on the bench">
            Import STL…
            <input type="file" accept=".stl,model/stl" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importStlFile(f); e.target.value = '' }} />
          </label>
          <button className="ghost" onClick={quotePdf}>Quote PDF</button><button className="ghost" onClick={techSheet}>Tech sheet</button>
        </div>
        <div className="qact" style={{ marginTop: 8 }}><button className="ghost" onClick={fuse} disabled={metalCount < 2}>Fuse metal</button></div>
        <div className="qact" style={{ marginTop: 8 }}><button className="ghost" onClick={clear}>Clear all</button></div>
        {metalCount >= 2 && <p className="disc">Fuse unions all {metalCount} metal parts into one watertight solid for printing (gems untouched).</p>}
        {msg && <p className="disc">{msg}</p>}
      </div>
    </>
  )
}
