import { describe, it, expect } from 'vitest'
import { buildApprovalPdf } from '../lib/approval'
import { DEFAULT_SPEC } from '../spec/types'

describe('approval receipt PDF', () => {
  it('builds a non-trivial PDF with the signature', () => {
    const doc = buildApprovalPdf(DEFAULT_SPEC, 'Mandrel', { name: 'Jane Client', date: 'Jul 23, 2026' })
    expect(doc.getNumberOfPages()).toBe(1)
    const bytes = doc.output('arraybuffer') as ArrayBuffer
    expect(bytes.byteLength).toBeGreaterThan(1500)
  })

  it('does not throw for a piece with no center stone', () => {
    const noStone = { ...DEFAULT_SPEC, category: 'bracelet' as const }
    expect(() => buildApprovalPdf(noStone, 'Mandrel', { name: 'A B', date: 'x' })).not.toThrow()
  })
})
