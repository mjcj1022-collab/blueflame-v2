import { useModeler } from '../state/modeler'

/**
 * Bottom-of-stage tool bar for the Sculpt tab: the drawing options (sketch,
 * quick primitives) on the left, and the tool group on the right — Move (whole
 * object), Select (highlight a vertex, safe orbiting), Edit (drag vertices),
 * and Surface (draw on the part). Mirrors the richer controls in the side panel
 * so the common actions are always one click away over the grid.
 */
export function ModelerToolbar() {
  const sketching = useModeler(s => s.sketching)
  const setSketching = useModeler(s => s.setSketching)
  const sketching3D = useModeler(s => s.sketching3D)
  const setSketching3D = useModeler(s => s.setSketching3D)
  const add = useModeler(s => s.add)
  const editMode = useModeler(s => s.editMode)
  const setEditMode = useModeler(s => s.setEditMode)
  const setMode = useModeler(s => s.setMode)
  const vertexTool = useModeler(s => s.vertexTool)
  const setVertexTool = useModeler(s => s.setVertexTool)
  const selectedVerts = useModeler(s => s.selectedVerts)
  const selectedId = useModeler(s => s.selectedId)
  const deleteVertsGroup = useModeler(s => s.deleteVertsGroup)

  const move = () => { setEditMode('object'); setMode('translate') }

  return (
    <div className="stage-toolbar">
      <div className="tbar-grp">
        <span className="tbar-lbl">Draw</span>
        <button className="sbtn" aria-pressed={sketching} onClick={() => setSketching(!sketching)} title="2D profile, revolved or extruded into a solid">Sketch</button>
        <button className="sbtn" aria-pressed={sketching3D} onClick={() => setSketching3D(!sketching3D)} title="No template — place vertices anywhere in 3D and wire them together">Build 3D</button>
        <button className="sbtn" onClick={() => add('box')}>+ Box</button>
        <button className="sbtn" onClick={() => add('sphere')}>+ Sphere</button>
        <button className="sbtn" onClick={() => add('gem')}>+ Gem</button>
      </div>
      <div className="tbar-grp">
        <span className="tbar-lbl">Tools</span>
        <button className="sbtn" aria-pressed={editMode === 'object'} onClick={move} title="Move whole objects">Move</button>
        <button className="sbtn" aria-pressed={editMode === 'vertex' && vertexTool === 'select'} onClick={() => setVertexTool('select')} title="Select vertices only">Select</button>
        <button className="sbtn" aria-pressed={editMode === 'vertex' && vertexTool === 'edit'} onClick={() => setVertexTool('edit')} title="Left-click a vertex and drag to reshape">Edit</button>
        <button className="sbtn" aria-pressed={editMode === 'vertex' && vertexTool === 'add'} onClick={() => setVertexTool('add')} title="Click the surface to add a vertex">Add</button>
        <button className="sbtn" aria-pressed={editMode === 'vertex' && vertexTool === 'remove'} onClick={() => setVertexTool('remove')} title="Double-click a vertex to remove it">Remove</button>
        <button className="sbtn" aria-pressed={editMode === 'vertex' && vertexTool === 'lasso'} onClick={() => setVertexTool('lasso')} title="Drag a lasso to select a group of vertices, then move them with the gizmo">Lasso</button>
        {selectedVerts.length > 0 && selectedId && (
          <button className="sbtn" onClick={() => deleteVertsGroup(selectedId, selectedVerts)} title="Delete the selected vertices">Delete ({selectedVerts.length})</button>
        )}
        <button className="sbtn" aria-pressed={editMode === 'surface'} onClick={() => setEditMode('surface')} title="Draw on the surface">Surface</button>
      </div>
    </div>
  )
}
