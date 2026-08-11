import { useModeler } from '../state/modeler'
import { useHotkeys } from '../state/hotkeys'

/**
 * Bottom-of-stage tool bar for the Sculpt tab: the drawing options (sketch,
 * quick primitives) on the left, and the tool group on the right — Move (whole
 * object), Select (highlight a vertex, safe orbiting), Edit (drag vertices),
 * and Surface (draw on the part). Mirrors the richer controls in the side panel
 * so the common actions are always one click away over the grid. Every button's
 * hotkey shown here is live — reassign it from the ⌨ shortcuts modal and the
 * tooltip updates immediately.
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
  const key = useHotkeys(s => s.keyFor)

  const move = () => { setEditMode('object'); setMode('translate') }

  return (
    <div className="stage-toolbar">
      <div className="tbar-grp">
        <span className="tbar-lbl">Draw</span>
        <button className="sbtn" aria-pressed={sketching} onClick={() => setSketching(!sketching)} title={`2D profile, revolved or extruded into a solid  ·  key ${key('sculpt.sketch2d')}`}>Sketch</button>
        <button className="sbtn" aria-pressed={sketching3D} onClick={() => setSketching3D(!sketching3D)} title={`No template — place vertices anywhere in 3D and wire them together  ·  key ${key('sculpt.sketch3d')}`}>Build 3D</button>
        <button className="sbtn" onClick={() => add('box')} title={`key ${key('sculpt.addBox')}`}>+ Box</button>
        <button className="sbtn" onClick={() => add('sphere')} title={`key ${key('sculpt.addSphere')}`}>+ Sphere</button>
        <button className="sbtn" onClick={() => add('gem')} title={`key ${key('sculpt.addGem')}`}>+ Gem</button>
      </div>
      <div className="tbar-grp">
        <span className="tbar-lbl">Tools</span>
        <button className="sbtn" aria-pressed={editMode === 'object'} onClick={move} title={`Move whole objects  ·  key ${key('sculpt.move')} or ${key('sculpt.gizmoTranslate')}  (${key('sculpt.gizmoRotate')} rotate, ${key('sculpt.gizmoScale')} scale)`}>Move</button>
        <button className="sbtn" aria-pressed={editMode === 'vertex' && vertexTool === 'select'} onClick={() => setVertexTool('select')} title={`Select vertices only  ·  key ${key('sculpt.select')}`}>Select</button>
        <button className="sbtn" aria-pressed={editMode === 'vertex' && vertexTool === 'edit'} onClick={() => setVertexTool('edit')} title={`Left-click a vertex and drag to reshape  ·  key ${key('sculpt.edit')}`}>Edit</button>
        <button className="sbtn" aria-pressed={editMode === 'vertex' && vertexTool === 'add'} onClick={() => setVertexTool('add')} title={`Click the surface to add a vertex  ·  key ${key('sculpt.add')}`}>Add</button>
        <button className="sbtn" aria-pressed={editMode === 'vertex' && vertexTool === 'remove'} onClick={() => setVertexTool('remove')} title={`Double-click a vertex to remove it  ·  key ${key('sculpt.remove')}`}>Remove</button>
        <button className="sbtn" aria-pressed={editMode === 'vertex' && vertexTool === 'lasso'} onClick={() => setVertexTool('lasso')} title={`Drag a lasso to select a group of vertices, then move them with the gizmo  ·  key ${key('sculpt.lasso')}`}>Lasso</button>
        {selectedVerts.length > 0 && selectedId && (
          <button className="sbtn" onClick={() => deleteVertsGroup(selectedId, selectedVerts)} title="Delete the selected vertices  ·  key Delete">Delete ({selectedVerts.length})</button>
        )}
        <button className="sbtn" aria-pressed={editMode === 'surface'} onClick={() => setEditMode('surface')} title={`Draw on the surface  ·  key ${key('sculpt.surface')}`}>Surface</button>
      </div>
    </div>
  )
}
