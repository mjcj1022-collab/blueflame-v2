import { useRef, useState, useEffect } from 'react'
import { useModeler } from '../state/modeler'
import type { SketchMode } from '../lib/sculpt'

/** Drawing surface size (px) and the mm each pixel represents. */
const W = 250, H = 220, MM_PER_PX = 0.12
const AXIS_X = 42            // revolve spin-axis, in px from the left edge
const GRID = 20             // px grid for snapping
const HIT = 9               // px node hit radius

type Pt = { x: number; y: number }

function simplify(pts: Pt[], minDist = 6): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minDist) out.push(p)
  }
  return out
}

// px ↔ mm. Revolve: x = radius from the axis (≥0), y = height (up = +).
const toMm = (pts: Pt[], mode: SketchMode): [number, number][] =>
  mode === 'revolve'
    ? pts.map(p => [Math.max(0, (p.x - AXIS_X) * MM_PER_PX), (H - p.y) * MM_PER_PX])
    : pts.map(p => [(p.x - W / 2) * MM_PER_PX, (H / 2 - p.y) * MM_PER_PX])
const toPx = (mm: [number, number][], mode: SketchMode): Pt[] =>
  mode === 'revolve'
    ? mm.map(([r, h]) => ({ x: AXIS_X + r / MM_PER_PX, y: H - h / MM_PER_PX }))
    : mm.map(([x, y]) => ({ x: W / 2 + x / MM_PER_PX, y: H / 2 - y / MM_PER_PX }))

/**
 * A docked, live sketch pad on the modeler stage. Draw freehand or place and
 * drag precise nodes; revolve (with an adjustable sweep angle) or extrude. The
 * solid updates in the 3D scene in real time and stays a parametric, re-editable
 * "sketch" object.
 */
export function SketchDock() {
  const editId = useModeler(s => s.sketchEditId)
  const objectById = useModeler(s => s.objects.find(o => o.id === s.sketchEditId) ?? null)
  const setSketching = useModeler(s => s.setSketching)
  const addSketch = useModeler(s => s.addSketch)
  const setObjectSketch = useModeler(s => s.setObjectSketch)
  const remove = useModeler(s => s.remove)

  const [mode, setMode] = useState<SketchMode>('revolve')
  const [depth, setDepth] = useState(3)
  const [segments, setSegments] = useState(48)
  const [arc, setArc] = useState(360)
  const [edit, setEdit] = useState(true)      // false = freehand draw, true = place/drag vertices
  const [full, setFull] = useState(true)      // true = full-screen grid by default; false = small docked pad
  const [snap, setSnap] = useState(false)
  const [pts, setPtsState] = useState<Pt[]>([])
  const ptsRef = useRef<Pt[]>([])
  const setPts = (p: Pt[]) => { ptsRef.current = p; setPtsState(p) }
  const drawing = useRef(false)
  const dragIdx = useRef<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const objId = useRef<string | null>(null)
  const isNew = useRef(true)
  // The mm profile this pad last wrote to the store. If the store's profile ever
  // differs from this, the change came from elsewhere (a 3D node drag, a panel
  // slider) and we mirror it back into the pad — keeping 2D and 3D in lockstep.
  const lastPushed = useRef<[number, number][] | null>(null)

  useEffect(() => {
    if (editId && objectById?.params?.sketch) {
      const sk = objectById.params.sketch
      setMode(sk.mode); setDepth(sk.depth); setSegments(sk.segments); setArc(sk.arc ?? 360)
      setPts(toPx(sk.points, sk.mode))
      objId.current = editId; isNew.current = false; setEdit(true)
    } else {
      objId.current = null; isNew.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pushLive = (p: Pt[], m: SketchMode, d: number, seg: number, a: number) => {
    const def = { points: toMm(p, m), mode: m, depth: d, segments: seg, arc: a }
    lastPushed.current = def.points
    if (objId.current) setObjectSketch(objId.current, def)
    else if (p.length >= 2) objId.current = addSketch(def)
  }

  // Mirror external edits (3D node drag, panel sliders) back into the pad. Skip
  // while the pad itself is mid-edit, and skip our own pushes (same points ref).
  const storeSketch = objectById?.params?.sketch
  useEffect(() => {
    if (!storeSketch) return
    if (drawing.current || dragIdx.current != null) return
    if (storeSketch.points === lastPushed.current) return
    lastPushed.current = storeSketch.points
    setMode(storeSketch.mode); setDepth(storeSketch.depth)
    setSegments(storeSketch.segments); setArc(storeSketch.arc ?? 360)
    setPts(toPx(storeSketch.points, storeSketch.mode))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSketch])
  const push = (p: Pt[]) => pushLive(p, mode, depth, segments, arc)

  const toSvg = (e: React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  const snapPx = (p: Pt): Pt => snap ? { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID } : p
  const hitNode = (p: Pt): number => {
    let bi = -1, bd = HIT * HIT
    ptsRef.current.forEach((q, i) => { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; bi = i } })
    return bi
  }

  const down = (e: React.PointerEvent) => {
    const raw = toSvg(e)
    if (edit) {
      const idx = hitNode(raw)
      if (idx >= 0) { dragIdx.current = idx }
      else { const np = [...ptsRef.current, snapPx(raw)]; setPts(np); push(np) }
      try { svgRef.current?.setPointerCapture(e.pointerId) } catch { /* synthetic */ }
    } else {
      drawing.current = true; setPts([raw]); try { svgRef.current?.setPointerCapture(e.pointerId) } catch { /* synthetic */ }
    }
  }
  const move = (e: React.PointerEvent) => {
    if (edit) {
      if (dragIdx.current == null) return
      const np = [...ptsRef.current]; np[dragIdx.current] = snapPx(toSvg(e)); setPts(np); push(np)
    } else if (drawing.current) setPts([...ptsRef.current, toSvg(e)])
  }
  const up = () => {
    if (edit) { if (dragIdx.current != null) { dragIdx.current = null; push(ptsRef.current) } }
    else if (drawing.current) { drawing.current = false; const s = simplify(ptsRef.current); setPts(s); push(s) }
  }
  const ctx = (e: React.MouseEvent) => {
    if (!edit) return
    e.preventDefault()
    const r = svgRef.current!.getBoundingClientRect()
    const p = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
    const idx = hitNode(p)
    if (idx >= 0) { const np = ptsRef.current.filter((_, i) => i !== idx); setPts(np); push(np) }
  }

  const changeMode = (m: SketchMode) => { setMode(m); pushLive(ptsRef.current, m, depth, segments, arc) }
  const changeDepth = (d: number) => { setDepth(d); pushLive(ptsRef.current, mode, d, segments, arc) }
  const changeSeg = (s: number) => { setSegments(s); pushLive(ptsRef.current, mode, depth, s, arc) }
  const changeArc = (a: number) => { setArc(a); pushLive(ptsRef.current, mode, depth, segments, a) }
  const clear = () => { setPts([]); if (objId.current) setObjectSketch(objId.current, { points: [], mode, depth, segments, arc }) }
  const done = () => setSketching(false)
  const cancel = () => { if (isNew.current && objId.current) remove(objId.current); setSketching(false) }

  const path = pts.length ? 'M ' + pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ') : ''
  const closeExtrude = mode === 'extrude' && !drawing.current && pts.length >= 3

  const dims = (() => {
    if (pts.length < 2) return null
    const mm = toMm(pts, mode), xs = mm.map(p => p[0]), ys = mm.map(p => p[1])
    const h = Math.max(...ys) - Math.min(...ys)
    if (mode === 'revolve') return `⌀${(2 * Math.max(...xs.map(Math.abs))).toFixed(1)} × ${h.toFixed(1)} mm`
    return `${(Math.max(...xs) - Math.min(...xs)).toFixed(1)} × ${h.toFixed(1)} × ${depth.toFixed(1)} mm`
  })()

  return (
    <div className={`sketch-dock${full ? ' full' : ''}`}>
      <div className="sketch-dock-head">
        <b>{isNew.current ? 'Free draw' : 'Edit sketch'}</b>
        <span>{edit ? 'click empty grid to place a vertex · drag to move · right-click to delete' : mode === 'revolve' ? 'draw right of axis' : 'draw a closed loop'}</span>
        <button className="sketch-full" aria-pressed={full} onClick={() => setFull(f => !f)} title={full ? 'Exit full screen' : 'Full-screen grid'} aria-label={full ? 'Exit full screen' : 'Full-screen grid'}>{full ? '⤡' : '⤢'}</button>
        <button className="sketch-x" onClick={done} title="Save and close" aria-label="Save and close">×</button>
      </div>
      <div className="sketch-dock-body">
        <svg
          ref={svgRef} viewBox={`0 0 ${W} ${H}`} className={`sketch-svg${full ? ' full' : ''}`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onContextMenu={ctx}
        >
          {[...Array(Math.floor(W / GRID) + 1)].map((_, i) => <line key={'v' + i} x1={i * GRID} y1={0} x2={i * GRID} y2={H} className="sk-grid" />)}
          {[...Array(Math.floor(H / GRID) + 1)].map((_, i) => <line key={'h' + i} x1={0} y1={i * GRID} x2={W} y2={i * GRID} className="sk-grid" />)}
          {mode === 'revolve' && <line x1={AXIS_X} y1={0} x2={AXIS_X} y2={H} className="sk-axis" />}
          {mode === 'extrude' && <line x1={W / 2} y1={0} x2={W / 2} y2={H} className="sk-axis dim" />}
          {path && <path d={closeExtrude ? path + ' Z' : path} className="sk-path" />}
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={edit ? 4 : 1.6} className={edit ? 'sk-node' : 'sk-dot'} />)}
        </svg>

        <div className="sketch-dock-ctl">
          <div className="opts c2">
            <button className="opt" aria-pressed={edit} onClick={() => setEdit(true)}>Place vertices</button>
            <button className="opt" aria-pressed={!edit} onClick={() => setEdit(false)}>Freehand draw</button>
          </div>
          <div className="opts c2">
            <button className="opt" aria-pressed={mode === 'revolve'} onClick={() => changeMode('revolve')}>Revolve</button>
            <button className="opt" aria-pressed={mode === 'extrude'} onClick={() => changeMode('extrude')}>Extrude</button>
          </div>
          {mode === 'extrude'
            ? <label className="sk-slider">Depth {depth.toFixed(1)} mm<input type="range" min={0.6} max={12} step={0.2} value={depth} onChange={e => changeDepth(+e.target.value)} /></label>
            : <>
                <label className="sk-slider">Angle {arc}°<input type="range" min={20} max={360} step={5} value={arc} onChange={e => changeArc(+e.target.value)} /></label>
                <label className="sk-slider">Sides {segments}<input type="range" min={8} max={96} step={1} value={segments} onChange={e => changeSeg(+e.target.value)} /></label>
              </>}
          <label className="sk-check"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />Snap to grid{dims && <span className="sk-dims">{dims}</span>}</label>
          <div className="opts c2">
            <button className="opt" onClick={clear}>Clear</button>
            <button className="opt" onClick={cancel}>Cancel</button>
          </div>
          <button className="opt tpl sk-done" onClick={done}>Done</button>
        </div>
      </div>
    </div>
  )
}
