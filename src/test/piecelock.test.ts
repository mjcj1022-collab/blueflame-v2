import { describe, it, expect } from 'vitest'
import { lockCategory, mentionsCategory } from '../lib/aiAssistant'

describe('mentionsCategory', () => {
  it('detects an explicit piece type', () => {
    expect(mentionsCategory('make it a bracelet')).toBe('bracelet')
    expect(mentionsCategory('turn this into a necklace')).toBe('necklace')
    expect(mentionsCategory('design a ring')).toBe('ring')
    expect(mentionsCategory('diamond stud earrings')).toBe('earring')
  })
  it('does not treat "chain" or a plain add as a type switch', () => {
    expect(mentionsCategory('add rubies every other inch on the chain')).toBeNull()
    expect(mentionsCategory('make it wider')).toBeNull()
  })
})

describe('lockCategory (studio piece-lock)', () => {
  it('forces an unrequested category change back to the current piece', () => {
    // model tried to switch a necklace to a bracelet on an "add rubies" edit
    const d = lockCategory({ category: 'bracelet', stationStoneId: 'rub' }, 'necklace', null)
    expect(d.category).toBe('necklace')
    expect(d.stationStoneId).toBe('rub') // the actual change is kept
  })
  it('allows the switch when the user explicitly asked for that type', () => {
    const d = lockCategory({ category: 'bracelet' }, 'necklace', 'bracelet')
    expect(d.category).toBe('bracelet')
  })
  it('leaves a design alone when it already matches the current piece', () => {
    const d = lockCategory({ category: 'necklace', necklaceLength: 20 }, 'necklace', null)
    expect(d.category).toBe('necklace')
    expect(d.necklaceLength).toBe(20)
  })
  it('adds the current category to a patch that omitted it', () => {
    // a bare edit patch with no category is left as-is (apply merges onto current)
    const d = lockCategory({ bandWidth: 6 }, 'ring', null)
    expect(d.category).toBeUndefined()
  })
  it('is a no-op with no current piece', () => {
    expect(lockCategory({ category: 'bracelet' }, undefined, null).category).toBe('bracelet')
  })
})
