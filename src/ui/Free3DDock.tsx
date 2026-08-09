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

  return (
    <div className="sketch-dock">
      <div className="sketch-dock-head">
        <b>Build in 3D</b>
        <span>click the floor to place · click a point to select · right-click to delete</span>
        <button className="sketch-x" onClick={cancel} title="Cancel" aria-label="Cancel">×</button>
      </div>
      <div className="sketch-dock-ctl">
        <p className="sk-explain">
          Click anywhere on the floor grid to drop a vertex — no template, no starting shape. Select a placed
          vertex and drag its gizmo to move it on any axis. Points connect in the order you place them; Done
          sweeps a solid wire through the path.
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
