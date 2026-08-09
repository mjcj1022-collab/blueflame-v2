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
  const setWire = useModeler(s => s.set3DWire)
  const toggleClosed = useModeler(s => s.toggle3DClosed)
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
        <span>click the floor or back wall to place · press and drag a point to move it · right-click to delete</span>
        <button className="sketch-x" onClick={cancel} title="Cancel" aria-label="Cancel">×</button>
      </div>
      <div className="sketch-dock-ctl">
        <p className="sk-explain">
          A wireframe box frames the working space — no template. Click the floor for a point at ground level, or
          the upright wall behind it to pick a height directly. Nothing is stuck where it lands: press and drag any
          point and it follows your cursor, so turning the view and dragging again reaches any spot in the box, not
          just up/down/sideways. Points connect in the order you place them; Done sweeps a solid wire through the
          path.
        </p>
        <div className="disc" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Vertices</span><span>{points.length}</span>
        </div>
        <label className="sk-slider">Wire diameter {wire.toFixed(1)} mm
          <input type="range" min={0.3} max={4} step={0.1} value={wire} onChange={e => setWire(+e.target.value)} />
        </label>
        <label className="sk-check"><input type="checkbox" checked={closed} onChange={toggleClosed} />Close the loop<small>connect the last point back to the first</small></label>
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
