import { describe, it, expect } from 'vitest'
import { nextStepTip } from '../lib/nextStep'
import { DEFAULT_SPEC, NO_STONE, type DesignSpec } from '../spec/types'

describe('next-step suggestions', () => {
  it('shows the welcome tip first, then advances as tips are dismissed', () => {
    const first = nextStepTip(DEFAULT_SPEC, 'design', [])
    expect(first?.id).toBe('welcome')
    const second = nextStepTip(DEFAULT_SPEC, 'design', ['welcome'])
    expect(second?.id).not.toBe('welcome')
    expect(second).not.toBeNull()
  })

  it('suggests adding a stone when a stone-bearing piece has none', () => {
    const bare: DesignSpec = { ...DEFAULT_SPEC, center: { ...DEFAULT_SPEC.center, stoneTypeId: NO_STONE } }
    const tip = nextStepTip(bare, 'design', ['welcome'])
    expect(tip?.id).toBe('add-stone')
  })

  it('returns null once everything relevant is dismissed', () => {
    const all = ['welcome', 'add-stone', 'explode', 'try-ai', 'try-sculpt', 'color']
    expect(nextStepTip(DEFAULT_SPEC, 'design', all)).toBeNull()
  })

  it('does not offer the sculpt tip while already in the modeler', () => {
    const tip = nextStepTip(DEFAULT_SPEC, 'model', ['welcome', 'color'])
    expect(tip?.id).not.toBe('try-sculpt')
  })
})
