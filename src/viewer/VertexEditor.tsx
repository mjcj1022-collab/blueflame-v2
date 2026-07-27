import { useModeler, type SculptObject } from '../state/modeler'
import { VertexSculptor } from './VertexSculptor'
import { VertexTools } from './VertexTools'

/**
 * Sculpt-tab vertex editing for a baked 'mesh'. Thin wrapper that binds the
 * shared VertexSculptor to the modeler store: the active Select/Edit tool, the
 * region falloff and symmetry, the picked-vertex highlight, and committing the
 * result back onto the object (one history step per drag).
 */
export function VertexEditor({ o }: { o: SculptObject }) {
  const falloff = useModeler(s => s.falloff)
  const symmetry = useModeler(s => s.symmetry)
  const tool = useModeler(s => s.vertexTool)
  const selectedVertex = useModeler(s => s.selectedVertex)
  const update = useModeler(s => s.update)
  const pickVertex = useModeler(s => s.pickVertex)

  return (
    <>
      <VertexSculptor
        vertices={o.vertices ?? []}
        color={o.color}
        falloff={falloff}
        symmetry={symmetry}
        tool={tool}
        selectedVertex={selectedVertex}
        onPick={i => pickVertex(i)}
        onCommit={v => update(o.id, { vertices: v })}
      />
      <VertexTools o={o} />
    </>
  )
}
