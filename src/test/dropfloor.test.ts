import { describe, it, expect } from 'vitest'
import { useModeler } from '../state/modeler'
import { bakedVertices } from '../lib/sculpt'

const bottomY = (id: string) => {
  const o = useModeler.getState().objects.find((x) => x.id === id)!
  const v = bakedVertices(o)
  let minY = Infinity
  for (let i = 1; i < v.length; i += 3) minY = Math.min(minY, v[i])
  return minY
}

describe('drop to floor', () => {
  it('seats the selected object so its lowest point is at y=0, keeping x/z', () => {
    useModeler.setState({ objects: [], selectedId: null, past: [], future: [] })
    useModeler.getState().add('box')
    const id = useModeler.getState().selectedId!
    useModeler.getState().update(id, { position: [3, 12, -2] })   // lift & offset it
    expect(bottomY(id)).toBeGreaterThan(1)                        // currently off the plate
    useModeler.getState().dropToFloor(id)
    expect(Math.abs(bottomY(id))).toBeLessThan(1e-5)             // now seated on y=0
    const o = useModeler.getState().objects.find((x) => x.id === id)!
    expect(o.position[0]).toBeCloseTo(3)
    expect(o.position[2]).toBeCloseTo(-2)
  })

  it('is undoable', () => {
    useModeler.setState({ objects: [], selectedId: null, past: [], future: [] })
    useModeler.getState().add('box')
    const id = useModeler.getState().selectedId!
    useModeler.getState().update(id, { position: [0, 10, 0] })
    const before = useModeler.getState().objects.find((x) => x.id === id)!.position[1]
    useModeler.getState().dropToFloor(id)
    useModeler.getState().undo()
    expect(useModeler.getState().objects.find((x) => x.id === id)!.position[1]).toBeCloseTo(before)
  })
})
