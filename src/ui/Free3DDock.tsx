import { useEffect } from 'react'
import { useModeler } from '../state/modeler'

/**
 * Controls for the free-form 3D builder (paired with the in-scene
 * Free3DSketch overlay): wire thickness, close-the-loop, undo/clear, and
 * finish/cancel. No 2D grid here — the vertices are placed directly in the
 * 3D viewport behind this dock.
 */
export function Free3DDock() {
  const points = useModeler(s => s.sketch3DPoints)
  const wire = useModeler(s => s.sketch3DWire)
  const closed = useModeler(s => s.sketch3DClosed)
  const fill = useModeler(s => s.sketch3DFill)
  const setWire = useModeler(s => s.set3DWire)
  const toggleClosed = useModeler(s => s.toggle3DClosed)
  const toggleFill = useModeler(s => s.toggle3DFill)
  const undo = useModeler(s => s.undo3DPoint)
  const clear = useModeler(s => s.clear3DPoints)
  const finish = useModeler(s => s.finish3DSketch)
  const cancel = useModeler(s => s.cancel3DSketch)

  // Escape cancels the build; Enter finishes it once there are enough points
  // to sweep a solid (mirrors the Cancel/Done buttons below).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (e.key === 'Escape') { e.preventDefault(); cancel() }
      else if (e.key === 'Enter' && points.length >= 2) { e.preventDefault(); finish() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel, finish, points.length])

  return (
    <div className="sketch-dock">
      <div className="sketch-dock-head">
        <b>Build in 3D</b>
        <span>click the floor or back wall to place · drag a point to move it, or snap it onto another to close the loop · click a line to curve it or resize it · right-click a point to delete</span>
        <button className="sketch-x" onClick={cancel} title="Cancel" aria-label="Cancel">×</button>
      </div>
      <div className="sketch-dock-ctl">
        <p className="sk-explain">
          A wireframe box frames the working space — no template. Click the floor for a point at ground level, or
          the upright wall behind it to pick a height directly. Nothing is stuck where it lands: press and drag any
          point and it follows your cursor, so turning the view and dragging again reaches any spot in the box, not
          just up/down/sideways — and dragging one point close to another snaps it into place. Snap the last point
          back onto the first and the loop closes itself, filling the interior with a solid panel automatically —
          the shape is built the moment the outline meets itself. Every line shows its length in mm as you build.
          Click a line to select it: switch it between a hard straight edge and a smoothed curve, and set its own
          thickness and depth, so one stretch can be a flat band and the next a round wire.
        </p>
        <div className="disc" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Vertices</span><span>{points.length}</span>
        </div>
        <label className="sk-slider">Default thickness {wire.toFixed(1)} mm
          <input type="range" min={0.3} max={4} step={0.1} value={wire} onChange={e => setWire(+e.target.value)} />
          <small style={{ textTransform: 'none', letterSpacing: 0 }}>starting size for new lines — click any placed line to fine-tune it on its own</small>
        </label>
        <label className="sk-check"><input type="checkbox" checked={closed} onChange={toggleClosed} />Close the loop<small>connect the last point back to the first (or just snap them together)</small></label>
        {closed && (
          <label className="sk-check"><input type="checkbox" checked={fill} onChange={toggleFill} />Fill center<small>build a solid panel across the interior — off for a plain hollow band</small></label>
        )}
        <div className="opts c2">
          <button className="opt" onClick={undo} disabled={!points.length}>Undo point</button>
          <button className="opt" onClick={clear} disabled={!points.length}>Clear</button>
        </div>
        <div className="opts c2">
          <button className="opt" onClick={cancel}>Cancel</button>
          <button className="opt tpl sk-done" onClick={finish} disabled={points.length < 2}>Done</button>
        </div>
      </div>
    </div>
  )
}
