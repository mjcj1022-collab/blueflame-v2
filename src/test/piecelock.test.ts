import { describe, it, expect } from 'vitest'
import { lockCategory, mentionsCategory, stationSpacingFrom, coerceStationStones } from '../lib/aiAssistant'

describe('mentionsCategory', () => {
  it('detects an explicit piece type', () => {
    expect(mentionsCategory('make it a bracelet')).toBe('bracelet')
    expect(mentionsCategory('turn this into a necklace')).toBe('necklace')
    expect(mentionsCategory('design a ring')).toBe('ring')
    expect(mentionsCategory('diamond stud earrings')).toBe('earring')
  })
  it('catches the "neckless" misspelling', () => {
    expect(mentionsCategory('knotted neckless')).toBe('necklace')
    expect(mentionsCategory('i want the knotted neckless')).toBe('necklace')
  })
  it('does not treat "chain" or a plain add as a type switch', () => {
    expect(mentionsCategory('add rubies every other inch on the chain')).toBeNull()
    expect(mentionsCategory('make it wider')).toBeNull()
  })
})

describe('coerceStationStones — ring eternity', () => {
  it('routes "rubies around it" on a ring to an eternity accent row, keeping the centre', () => {
    // model returned centre-stone fields on a ring "add rubies" edit
    const d = coerceStationStones({ category: 'ring', stoneTypeId: 'rub', shapeId: 'rd', carat: 1 }, 'add rubies everyother inch going around it', 'ring')
    expect(d.settingId).toBe('etr')            // eternity setting
    expect(d.accentStoneId).toBe('rub')        // ruby accents
    expect(d.stoneTypeId).toBeUndefined()      // centre stone left as-is
    expect(d.carat).toBeUndefined()
  })
  it('handles the "everyother" no-space spelling and "going around"', () => {
    const d = coerceStationStones({ category: 'necklace', stoneTypeId: 'rub' }, 'rubies everyother inch', 'necklace')
    expect(d.stationStoneId).toBe('rub')
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

describe('stationSpacingFrom', () => {
  it('reads the spacing from natural phrasing', () => {
    expect(stationSpacingFrom('add rubies every other inch')).toBe(2)
    expect(stationSpacingFrom('rubies every inch on the chain')).toBe(1)
    expect(stationSpacingFrom('sapphires every 3 inches')).toBe(3)
    expect(stationSpacingFrom('stations of ruby along the chain')).toBe(2)
  })
  it('is null when the ask is not distributed', () => {
    expect(stationSpacingFrom('a 1ct ruby center')).toBeNull()
    expect(stationSpacingFrom('make it wider')).toBeNull()
  })
})

describe('coerceStationStones', () => {
  it('moves a centre ruby onto the station fields for a necklace', () => {
    // what the model wrongly returned: centre-stone ruby + flush on a necklace
    const d = coerceStationStones({ category: 'necklace', stoneTypeId: 'rub', shapeId: 'rd', carat: 0.1, settingId: 'fl' }, 'add rubies every other inch', 'necklace')
    expect(d.stationStoneId).toBe('rub')
    expect(d.stationEveryIn).toBe(2)
    expect(d.stationCarat).toBeCloseTo(0.1, 6)
    // centre-stone fields cleared so a plain chain doesn't try to use them
    expect(d.stoneTypeId).toBeUndefined()
    expect(d.settingId).toBeUndefined()
  })
  it('uses the current category when the patch omits it', () => {
    const d = coerceStationStones({ stoneTypeId: 'sap', carat: 0.05 }, 'sapphires every inch', 'necklace')
    expect(d.stationStoneId).toBe('sap')
    expect(d.stationEveryIn).toBe(1)
  })
  it('leaves a ring or a non-distributed ask alone', () => {
    expect(coerceStationStones({ category: 'ring', stoneTypeId: 'rub', carat: 1 }, 'a ruby ring', 'ring').stationStoneId).toBeUndefined()
    expect(coerceStationStones({ category: 'necklace', stoneTypeId: 'rub' }, 'a ruby pendant', 'necklace').stationStoneId).toBeUndefined()
  })
})
