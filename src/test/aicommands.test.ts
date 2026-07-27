import { describe, it, expect, beforeEach } from 'vitest'
import { parseCommandReply, normalizeCommand, buildCommandPrompt } from '../lib/aiCommands'
import { useModeler, type SculptObject } from '../state/modeler'

describe('normalizeCommand', () => {
  it('validates and clamps a texture command', () => {
    expect(normalizeCommand({ op: 'texture', style: 'hammered', depth: 0.2 })).toEqual({ op: 'texture', style: 'hammered', depth: 0.2 })
    // out-of-range depth clamps, bad style falls back
    expect(normalizeCommand({ op: 'texture', style: 'zzz', depth: 99 })).toEqual({ op: 'texture', style: 'hammered', depth: 1 })
  })
  it('fills defaults for arg-less and partial ops', () => {
    expect(normalizeCommand({ op: 'flush' })).toEqual({ op: 'flush' })
    expect(normalizeCommand({ op: 'halo' })).toEqual({ op: 'halo', count: 12, carat: 0.03 })
    expect(normalizeCommand({ op: 'fitHead', prongs: 20 })).toEqual({ op: 'fitHead', prongs: 8 })
  })
  it('rejects an unknown op', () => {
    expect(normalizeCommand({ op: 'explode' })).toBeNull()
    expect(normalizeCommand({})).toBeNull()
  })
})

describe('parseCommandReply', () => {
  it('parses an ordered command list and drops hallucinated ops', () => {
    const text = JSON.stringify({ reply: 'On it.', commands: [{ op: 'texture', style: 'hammered', depth: 0.15 }, { op: 'nope' }, { op: 'halo', count: 10, carat: 0.02 }] })
    const r = parseCommandReply(text)
    expect(r.commands).toHaveLength(2)
    expect(r.commands[0].op).toBe('texture')
    expect(r.commands[1].op).toBe('halo')
  })
  it('handles a fenced reply and a no-command answer', () => {
    expect(parseCommandReply('```json\n{"reply":"Done","commands":[{"op":"dome","height":2}]}\n```').commands[0]).toEqual({ op: 'dome', height: 2 })
    expect(parseCommandReply('I cannot do that.').commands).toEqual([])
  })
  it('prompt names every op', () => {
    const p = buildCommandPrompt()
    for (const op of ['texture', 'dome', 'flush', 'halo', 'symmetrize', 'autoOrient', 'gallery']) expect(p).toContain(op)
  })
})

describe('runModelerCommands', () => {
  const s = () => useModeler.getState()
  const part = (over: Partial<SculptObject>): Omit<SculptObject, 'id' | 'name'> => ({
    kind: 'box', size: 8, material: 'metal', color: 0xffffff, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], ...over,
  })
  beforeEach(() => useModeler.setState({ objects: [], selectedId: null, past: [], future: [] }))

  it('applies a metal-op sequence to the band and reports results', () => {
    s().addObjects([part({ kind: 'box', size: 8 })])
    const { applied, skipped } = s().runModelerCommands([
      { op: 'texture', style: 'hammered', depth: 0.15 },
      { op: 'dome', height: 1.5 },
      { op: 'sizingBeads' },
    ])
    expect(applied).toContain('texture')
    expect(applied).toContain('dome')
    expect(applied).toContain('sizingBeads')
    expect(skipped).toEqual([])
    // the band is now a domed/textured mesh, plus two sizing beads added
    expect(s().objects.some(o => o.name?.startsWith('Sizing bead'))).toBe(true)
  })

  it('runs gem ops against the gem and metal ops against the band', () => {
    s().addObjects([
      part({ kind: 'shank', material: 'metal', params: { ringSize: 7, width: 2.2, thickness: 1.8, profile: 'round' } }),
      part({ kind: 'gem', material: 'gem', position: [0, 8, 0], params: { shapeId: 'rd', carat: 1 } }),
    ])
    const { applied } = s().runModelerCommands([{ op: 'fitHead', prongs: 6 }, { op: 'halo', count: 10, carat: 0.03 }])
    expect(applied).toContain('fitHead')
    expect(applied).toContain('halo')
    expect(s().objects.some(o => o.kind === 'head')).toBe(true)
    expect(s().objects.filter(o => o.name?.startsWith('Halo')).length).toBe(10)
  })

  it('skips gem ops when there is no gem', () => {
    s().addObjects([part({ kind: 'box' })])
    const { skipped } = s().runModelerCommands([{ op: 'flush' }])
    expect(skipped).toContain('flush')
  })
})
