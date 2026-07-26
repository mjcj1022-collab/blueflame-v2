import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { thicknessColor, wallThicknessColors, HEATMAP_MIN_WALL } from '../lib/heatmap'

describe('thickness colour mapping', () => {
  it('is red when below the minimum, green when comfortably thick', () => {
    const c = new THREE.Color()
    thicknessColor(0.3, 0.8, c)                    // thin
    expect(c.r).toBeGreaterThan(c.g)               // red-dominant
    thicknessColor(3, 0.8, c)                      // thick
    expect(c.g).toBeGreaterThan(c.r)               // green-dominant
  })

  it('unmeasured (Infinity) returns a muted colour, not red', () => {
    const c = new THREE.Color()
    thicknessColor(Infinity, 0.8, c)
    expect(c.r).toBeLessThan(0.6)
  })
})

describe('wall thickness colours on a solid', () => {
  it('produces one RGB per vertex for a closed box', () => {
    const geo = new THREE.BoxGeometry(4, 4, 4).toNonIndexed()
    const colors = wallThicknessColors(geo, HEATMAP_MIN_WALL)
    expect(colors).not.toBeNull()
    expect(colors!.length).toBe(geo.getAttribute('position').count * 3)
    // a 4mm-thick box should read healthy (green-dominant) on most faces
    let green = 0
    for (let i = 0; i < colors!.length; i += 3) if (colors![i + 1] > colors![i]) green++
    expect(green).toBeGreaterThan(0)
  })
})
