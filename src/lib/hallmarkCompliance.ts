import { alloyById } from '../catalog'

/**
 * Hallmark & quality-mark compliance advisor. Every finished precious piece has
 * to be marked correctly for the market it's sold in, and the rules differ by
 * country: the UK requires a compulsory assay-office hallmark, the US requires a
 * maker's mark alongside any quality stamp, and the EU recognises the Common
 * Control Mark. This turns the chosen alloy + destination into the exact marks
 * the piece needs and the fineness thresholds it has to clear.
 *
 * Guidance for the bench, not legal advice — always confirm current rules with
 * your assay office or a compliance authority before stamping for sale.
 */

export type Market = 'US' | 'UK' | 'EU' | 'CA' | 'AU'

export const MARKETS: [Market, string][] = [
  ['US', 'United States'],
  ['UK', 'United Kingdom'],
  ['EU', 'European Union'],
  ['CA', 'Canada'],
  ['AU', 'Australia'],
]

/** Minimum fineness (parts per thousand) to legally call a piece by the metal name. */
interface MetalThreshold { word: string; min: number }         // e.g. { 'gold', 375 }

interface MarketRule {
  name: string
  compulsoryAssay: boolean
  makersMarkRequired: boolean
  requiredMarks: (fineness: number, symbol: string) => string[]
  minToBeCalled: Record<'Au' | 'Ag' | 'Pt' | 'Pd', MetalThreshold | undefined>
  exemptionNote?: string
  authority: string
}

const finenessMark = (fineness: number) => `${fineness}` // parts-per-thousand numeric mark

const RULES: Record<Market, MarketRule> = {
  US: {
    name: 'United States',
    compulsoryAssay: false,
    makersMarkRequired: true,   // National Gold & Silver Stamping Act: a quality mark obliges a maker's mark
    requiredMarks: (_fineness, symbol) => [
      symbol === 'Au' ? 'Karat mark (e.g. 14K)' : symbol === 'Pt' ? 'Fineness + PLAT/platinum' : 'Fineness (e.g. 925 / STERLING)',
      "Registered maker's mark (required whenever a quality mark is applied)",
    ],
    minToBeCalled: {
      Au: { word: 'gold', min: 417 },        // 10K floor for "gold" in the US
      Ag: { word: 'sterling', min: 925 },    // "sterling" ≥ 925; "silver" ≥ 900
      Pt: { word: 'platinum', min: 950 },     // "platinum" unqualified ≥ 950
      Pd: { word: 'palladium', min: 500 },
    },
    exemptionNote: 'No government assay office; the maker self-certifies. Tolerances are tight — plumb to the marked karat.',
    authority: 'FTC Jewelry Guides / National Stamping Act',
  },
  UK: {
    name: 'United Kingdom',
    compulsoryAssay: true,
    makersMarkRequired: true,
    requiredMarks: (fineness) => [
      "Sponsor's (maker's) mark — registered at an assay office",
      `Fineness mark in parts per thousand (${finenessMark(fineness)})`,
      'Assay office mark (London leopard, Birmingham anchor, Sheffield rose, Edinburgh castle)',
      'Traditional fineness symbol; date letter optional',
    ],
    minToBeCalled: {
      Au: { word: 'gold', min: 375 },        // 9ct floor
      Ag: { word: 'silver', min: 800 },      // legal standards 800/925/958.4/999
      Pt: { word: 'platinum', min: 850 },
      Pd: { word: 'palladium', min: 500 },
    },
    exemptionNote: 'Hallmarking is compulsory above the exemption weights: gold < 1 g, silver < 7.78 g, platinum < 0.5 g, palladium < 1 g are exempt.',
    authority: 'Hallmarking Act 1973 (UK assay offices)',
  },
  EU: {
    name: 'European Union',
    compulsoryAssay: false,   // varies by member state; CCM is the cross-border route
    makersMarkRequired: true,
    requiredMarks: (fineness) => [
      "Responsibility (maker's) mark",
      `Fineness mark (${finenessMark(fineness)})`,
      'National hallmark, or the Common Control Mark (CCM) under the Vienna Convention for cross-border trade',
    ],
    minToBeCalled: {
      Au: { word: 'gold', min: 375 },        // recognised standards 375/585/750/916/999
      Ag: { word: 'silver', min: 800 },      // 800/925/999
      Pt: { word: 'platinum', min: 850 },     // 850/900/950/999
      Pd: { word: 'palladium', min: 500 },    // 500/950/999
    },
    exemptionNote: 'Rules differ by member state; several require a national assay mark. The CCM is accepted across Vienna Convention signatories.',
    authority: 'Convention on the Control & Marking of Articles of Precious Metals',
  },
  CA: {
    name: 'Canada',
    compulsoryAssay: false,
    makersMarkRequired: true,   // a quality mark is only lawful with a registered trademark alongside it
    requiredMarks: (_fineness, symbol) => [
      symbol === 'Au' ? 'Karat or fineness quality mark' : 'Fineness quality mark',
      'Registered Canadian trademark (required whenever a quality mark is applied)',
    ],
    minToBeCalled: {
      Au: { word: 'gold', min: 375 },
      Ag: { word: 'silver', min: 925 },
      Pt: { word: 'platinum', min: 950 },
      Pd: { word: 'palladium', min: 500 },
    },
    exemptionNote: 'Quality marks are optional, but if applied they must be truthful and accompanied by a registered trademark.',
    authority: 'Precious Metals Marking Act',
  },
  AU: {
    name: 'Australia',
    compulsoryAssay: false,
    makersMarkRequired: false,
    requiredMarks: (_fineness, symbol) => [
      `Fineness or ${symbol === 'Au' ? 'karat' : 'standard'} mark (voluntary but must be accurate)`,
    ],
    minToBeCalled: {
      Au: { word: 'gold', min: 375 },
      Ag: { word: 'silver', min: 800 },
      Pt: { word: 'platinum', min: 850 },
      Pd: { word: 'palladium', min: 500 },
    },
    exemptionNote: 'No compulsory hallmarking; any mark applied must not be misleading under consumer law.',
    authority: 'Australian Consumer Law (no statutory hallmark)',
  },
}

export interface HallmarkCompliance {
  market: Market
  marketName: string
  alloyName: string
  symbol: string
  finenessPpt: number          // parts per thousand
  requiredMarks: string[]
  compulsoryAssay: boolean
  makersMarkRequired: boolean
  callable: { word: string; ok: boolean; threshold: number } | null
  notes: string[]
  authority: string
}

/** What marks this alloy needs for this destination market, and whether it clears
 *  the threshold to be described by its metal name. */
export function hallmarkCompliance(alloyId: string, market: Market): HallmarkCompliance {
  const alloy = alloyById(alloyId)
  const rule = RULES[market]
  const fineness = Math.round(alloy.fine * 1000)
  const sym = alloy.symbol as 'Au' | 'Ag' | 'Pt' | 'Pd'
  const threshold = rule.minToBeCalled[sym]
  const notes: string[] = []
  if (rule.exemptionNote) notes.push(rule.exemptionNote)
  if (!alloy.precious) notes.push(`${alloy.name} is a base metal — precious-metal hallmarking does not apply; describe it by material, not fineness.`)
  if (threshold && fineness < threshold.min) {
    notes.push(`At ${fineness}‰ this is below the ${threshold.min}‰ needed to be sold as "${threshold.word}" in ${rule.name}.`)
  }

  return {
    market,
    marketName: rule.name,
    alloyName: alloy.name,
    symbol: alloy.symbol,
    finenessPpt: fineness,
    requiredMarks: alloy.precious ? rule.requiredMarks(fineness, alloy.symbol) : [],
    compulsoryAssay: rule.compulsoryAssay && alloy.precious,
    makersMarkRequired: rule.makersMarkRequired && alloy.precious,
    callable: threshold ? { word: threshold.word, ok: fineness >= threshold.min, threshold: threshold.min } : null,
    notes,
    authority: rule.authority,
  }
}
