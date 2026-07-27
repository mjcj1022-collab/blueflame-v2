import { describe, it, expect } from 'vitest'
import { necklaceChainVertices, NECKLACE_STYLES } from '../lib/necklaceChain'

describe('necklace chain geometry', () => {
  it('produces a valid non-empty triangle soup', () => {
    const v = necklaceChainVertices(70, 0.6, 'cable')
    expect(v.length).toBeGreaterThan(0)
    expect(v.length % 9).toBe(0)
  })

  it('lays links around a loop of ~radius R', () => {
    const R = 70
    const v = necklaceChainVertices(R, 0.6, 'cable')
    let maxR = 0
    for (let i = 0; i < v.length; i += 3) maxR = Math.max(maxR, Math.hypot(v[i], v[i + 1]))
    expect(maxR).toBeGreaterThan(R * 0.9)          // reaches out to the loop
    expect(maxR).toBeLessThan(R * 1.3)             // and not wildly beyond it
  })

  it('is deterministic per style', () => {
    expect(necklaceChainVertices(60, 0.7, 'curb')).toEqual(necklaceChainVertices(60, 0.7, 'curb'))
  })

  it('different styles yield different geometry', () => {
    const cable = necklaceChainVertices(60, 0.7, 'cable').length
    const rope = necklaceChainVertices(60, 0.7, 'rope').length     // smaller, tighter links → more of them
    const bead = necklaceChainVertices(60, 0.7, 'bead').length
    expect(rope).not.toBe(cable)
    expect(bead).not.toBe(cable)
  })

  it('exposes a labelled style list', () => {
    expect(NECKLACE_STYLES.map(s => s[0])).toContain('figaro')
    expect(NECKLACE_STYLES.length).toBeGreaterThanOrEqual(4)
  })

  it('every listed chain style produces a valid non-empty soup', () => {
    for (const [id] of NECKLACE_STYLES) {
      const v = necklaceChainVertices(64, 0.6, id)
      expect(v.length, id).toBeGreaterThan(0)
      expect(v.length % 9, id).toBe(0)
      expect(v.every(Number.isFinite), id).toBe(true)
    }
  })

  it('includes the expanded chain range (box, cuban, snake, herringbone, mariner, rolo)', () => {
    const ids = NECKLACE_STYLES.map(s => s[0])
    for (const id of ['box', 'cuban', 'snake', 'herringbone', 'mariner', 'rolo']) expect(ids).toContain(id)
  })
})
