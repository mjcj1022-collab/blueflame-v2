import { describe, it, expect } from 'vitest'
import { applyAiDesign } from '../lib/aiAssistant'
import { useDesign } from '../state/design'
import { DEFAULT_SPEC } from '../spec/types'
import { isHidden } from '../lib/features'

describe('auto-unhide on design apply', () => {
  it('clears leftover hidden flags so a fresh motif is visible', () => {
    // Start with the head hidden — the exact trap that hid the motif before.
    useDesign.setState({ spec: { ...DEFAULT_SPEC, category: 'necklace', hidden: ['head'] } })
    expect(isHidden(useDesign.getState().spec, 'head')).toBe(true)
    applyAiDesign({ category: 'necklace', motif: 'celtic' })
    const s = useDesign.getState().spec
    expect(isHidden(s, 'head')).toBe(false)     // no longer hidden
    expect(s.necklace.motif).toBe('celtic')
  })

  it('reveal() only clears the given key', () => {
    useDesign.setState({ spec: { ...DEFAULT_SPEC, hidden: ['head', 'stone'] } })
    useDesign.getState().reveal('head')
    const s = useDesign.getState().spec
    expect(isHidden(s, 'head')).toBe(false)
    expect(isHidden(s, 'stone')).toBe(true)     // untouched
  })
})
