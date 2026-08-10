import type { SculptObject } from '../state/modeler'
import { alloyById, stoneById } from '../catalog'
import { sculptEstimate, sculptWarnings, boundingSize } from './sculpt'
import { laborBreakdown, formatMinutes } from './laborTime'
import { money, gToDwt } from './units'
import type { SculptHandoff } from './sculptHandoff'

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))
/** Right-align an amount so the money column lines up in monospace. */
const amountRow = (label: string, amount: string, width = 46) =>
  `  ${pad(label, width - amount.length)}${amount}`

export interface QuoteOptions {
  brand?: string
  /** Days the price holds — metal moves, so a quote shouldn't be open-ended. */
  validDays?: number
  /** Deposit share required to start work (0–1). */
  depositRate?: number
  /** Injected so the document is deterministic in tests. */
  today?: Date
}

/**
 * A client-facing quote for a sculpted piece. Deliberately not the tech sheet:
 * no BOM, tolerances or shop notes — what the piece is, what it costs, and how
 * long the price holds. Line items come straight from the handoff, so a quote
 * can never disagree with the order or the estimate on screen.
 */
export function sculptQuote(handoff: SculptHandoff, opts: QuoteOptions = {}): string {
  const { brand = 'Mandrel', validDays = 14, depositRate = 0.5, today = new Date() } = opts
  const s = handoff.spec
  const until = new Date(today.getTime() + validDays * 86_400_000)
  const date = (d: Date) => d.toISOString().slice(0, 10)
  const deposit = handoff.total * depositRate

  // null (not '') for an omitted line, so intentional '' blank lines survive
  const stoneLine = s.stones.count > 0
    ? `  ${pad('Stones', 20)}${s.stones.count} · ${s.stones.carats.toFixed(2)} ct total`
    : null

  return [
    `${brand.toUpperCase()} — QUOTE`,
    '',
    `  ${pad('Piece', 20)}${handoff.name}`,
    `  ${pad('Quoted', 20)}${date(today)}`,
    `  ${pad('Valid until', 20)}${date(until)}`,
    '',
    'SPECIFICATION',
    `  ${pad('Metal', 20)}${s.alloyName}`,
    `  ${pad('Finished weight', 20)}${s.metal.castGrams.toFixed(2)} g  (${gToDwt(s.metal.castGrams).toFixed(2)} dwt)`,
    stoneLine,
    `  ${pad('Components', 20)}${s.parts} part${s.parts === 1 ? '' : 's'}`,
    '',
    'PRICE',
    ...handoff.lines.map(l => amountRow(l.detail ? `${l.label} — ${l.detail}` : l.label, money(l.amount))),
    `  ${'-'.repeat(46)}`,
    amountRow('TOTAL', money(handoff.total)),
    '',
    'TERMS',
    `  A ${Math.round(depositRate * 100)}% deposit (${money(deposit)}) starts production;`,
    '  the balance is due before delivery.',
    `  This price holds for ${validDays} days — precious metal is quoted at`,
    '  current market and moves daily.',
    '  Made to order from a custom model; final weight may vary slightly',
    '  after casting and finishing.',
  ].filter(l => l !== null).join('\n')
}

/**
 * A production tech sheet for a custom sculpt: a bill of materials (every part
 * with its bounding size and material), the metal totals, gemstones, and the
 * same retail estimate the panel shows. Plain monospace text for textToPdf().
 */
export function sculptTechSheet(objects: SculptObject[], alloyId: string, brand = 'Mandrel'): string {
  const alloy = alloyById(alloyId)
  const est = sculptEstimate(objects, alloyId)
  const gems = objects.filter(o => o.kind === 'gem')
  const warns = sculptWarnings(objects)

  const bom = objects.map((o, i) => {
    const [w, h, d] = boundingSize(o)
    const size = `${w.toFixed(1)} x ${h.toFixed(1)} x ${d.toFixed(1)} mm`
    const mat = o.kind === 'gem'
      ? `${stoneById(o.params?.stoneTypeId ?? 'dia').name}, ${(o.params?.carat ?? 0).toFixed(2)} ct`
      : alloy.name
    return `  ${pad(`${i + 1}. ${o.name}`, 22)}${pad(o.kind, 8)}${pad(size, 22)}${mat}`
  })

  return [
    `${brand.toUpperCase()} — CUSTOM SCULPT TECH SHEET`,
    '',
    `PARTS  ${objects.length} total`,
    ...bom,
    '',
    'METAL',
    `  Alloy             ${alloy.name}, density ${alloy.density} g/cm3`,
    `  Model volume      ${Math.round(est.vol).toLocaleString()} mm3`,
    `  Cast weight       ${est.castG.toFixed(2)} g   (${gToDwt(est.castG).toFixed(2)} dwt)`,
    gems.length > 0 ? `  Gemstones         ${gems.length} stone${gems.length === 1 ? '' : 's'}, ${est.carats.toFixed(2)} ct total` : '',
    '',
    'ESTIMATE',
    `  Metal             ${money(est.metalCost)}`,
    ...(gems.length > 0 ? [
      `  Stones (${est.carats.toFixed(2)} ct)   ${money(est.stoneCost)}`,
      `  Setting labor     ${money(est.settingLabor)}`
    ] : []),
    `  Cast, finish      ${money(est.finishFee)}`,
    `  ESTIMATE          ${money(est.total)}`,
    '',
    ...(() => {
      const lb = laborBreakdown(objects, alloyId)
      if (!lb.lines.length) return []
      return [
        'BENCH TIME',
        ...lb.lines.map(l => `  ${pad(l.op, 18)}${pad(l.detail, 16)}${pad(formatMinutes(l.minutes), 10)}${money(l.cost)}`),
        `  ${pad('TOTAL', 18)}${pad('', 16)}${pad(formatMinutes(lb.totalMinutes), 10)}${money(lb.laborCost)}`,
        '',
      ]
    })(),
    'PRODUCTION NOTES',
    '  Geometry is a custom sculpt — confirm wall thickness and stone seats',
    '  before casting. Overlapping metal parts double-count in the volume',
    '  until unioned; use "Fuse metal" for a single watertight solid, then',
    '  export STL for printing or milling.',
    ...(warns.length ? ['', 'PRINTABILITY', ...warns.map(w => `  ! ${w.part}: ${w.text}`)] : [])
  ].filter(Boolean).join('\n')
}
