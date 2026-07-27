import { describe, it, expect } from 'vitest'
import { multiViewHtml } from '../lib/multiView'
import { captureThreeViews, setCapturer } from '../lib/capture'

describe('multi-view sheet', () => {
  it('lays out three labelled images with dimensions', () => {
    const html = multiViewHtml(
      { front: 'data:image/png;base64,AAA', side: 'data:image/png;base64,BBB', top: 'data:image/png;base64,CCC' },
      { brand: 'Blue Flame', name: 'Solitaire', dims: [18, 22, 12], ringSize: 7 },
    )
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toMatch(/data:image\/png;base64,AAA/)
    expect(html).toMatch(/data:image\/png;base64,BBB/)
    expect(html).toMatch(/data:image\/png;base64,CCC/)
    expect(html).toMatch(/Front/); expect(html).toMatch(/Side/); expect(html).toMatch(/Top/)
    expect(html).toMatch(/18\.0 × 22\.0 × 12\.0 mm · US 7/)
  })
})

describe('capture bridge', () => {
  it('returns null when no stage rig is registered', () => {
    setCapturer(null)
    expect(captureThreeViews()).toBeNull()
  })
  it('delegates to a registered capturer', () => {
    const fake = { front: 'f', side: 's', top: 't' }
    setCapturer(() => fake)
    expect(captureThreeViews()).toBe(fake)
    setCapturer(null)
  })
})
