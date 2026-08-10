import { describe, it, expect, beforeEach } from 'vitest'
import { clientSheetHtml } from '../lib/clientSheet'
import { useModeler, type SculptObject } from '../state/modeler'
import { alloyById } from '../catalog'

describe('client sheet HTML', () => {
  it('renders a self-contained page with specs, price and total', () => {
    const html = clientSheetHtml({
      brand: 'Mandrel', name: 'Solitaire',
      specs: [['Metal', '14K Yellow'], ['Ring size', 'US 7']],
      priceLines: [['Metal', '$120.00']], total: '$450.00', today: '2026-01-01',
    })
    expect(html).toMatch(/<!DOCTYPE html>/)
    expect(html).toMatch(/Mandrel/)
    expect(html).toMatch(/US 7/)
    expect(html).toMatch(/\$450\.00/)
    expect(html).toMatch(/Render preview/) // no image → placeholder
  })
  it('embeds an image when a data URL is given, and escapes HTML', () => {
    const html = clientSheetHtml({ brand: 'A&B', name: '<x>', specs: [], priceLines: [], total: '$1', imageDataUrl: 'data:image/png;base64,ABC' })
    expect(html).toMatch(/src="data:image\/png;base64,ABC"/)
    expect(html).toMatch(/A&amp;B/)
    expect(html).toMatch(/&lt;x&gt;/)
  })
})

describe('stampHallmark', () => {
  const shank = (): SculptObject => ({ id: 'sh', kind: 'shank', name: 'Shank', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], size: 6, material: 'metal', color: 0xd8b36a, params: { ringSize: 7, width: 3, thickness: 1.8, profile: 'round' } })
  beforeEach(() => useModeler.setState({ objects: [shank()], selectedId: null, past: [], future: [], placing: null, importedSig: null, explode: 0, snapshots: [], alloyId: '18ky' }))

  it('engraves the alloy hallmark into the band (turns it into a mesh)', () => {
    const ok = useModeler.getState().stampHallmark('sh', 'BF')
    expect(ok).toBe(true)
    const band = useModeler.getState().objects[0]
    expect(band.kind).toBe('mesh')          // boolean cut result
    expect(band.vertices && band.vertices.length).toBeGreaterThan(0)
    expect(alloyById('18ky').hallmark).toBe('18K')
  })
})
