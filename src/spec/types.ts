/**
 * DesignSpec — the single source of truth for a piece.
 * Geometry, weight, cost and the tech sheet are all DERIVED from this.
 * Nothing is ever stored as a mesh.
 *
 * A design belongs to one product CATEGORY. Every category keeps its own
 * geometry block; the active `category` selects which block the engines read.
 * The stone (`center`) and `setting` are shared — a pendant and a ring set the
 * same stone the same way, so the head math is written once and reused.
 */
export type ProductCategory = 'ring' | 'pendant' | 'earring' | 'bracelet' | 'necklace' | 'body'

export type FitProfile = 'standard' | 'comfort'
export type EarringBack = 'friction' | 'screw' | 'lever' | 'latch'
export type BraceletKind = 'tennis' | 'bangle' | 'cuff' | 'chain'
export type FinishId = 'polish' | 'satin' | 'matte' | 'sandblast' | 'hammered' | 'florentine' | 'oxidized'
export type EngravePlacement = 'inside' | 'outside'

export interface Engraving {
  text: string
  placement: EngravePlacement
  font: string
  position: number   // 0–1, where the text lands around the band
}

import type { Grading, Cert } from '../catalog/grading'
import { DEFAULT_GRADING, DEFAULT_CERT } from '../catalog/grading'
import type { MeleeSpec } from '../catalog/melee'

export type BandProfile = 'round' | 'flat' | 'dshape' | 'knife'

export interface Center {
  shapeId: string
  stoneTypeId: string
  carat: number
  grading: Grading
  cert: Cert
  seat?: number   // mm the stone sits raised (+) or set deeper (−) within the mount
}

/** Ring — sized on a mandrel, inside diameter in mm. */
export interface RingGeo {
  size: number          // US ring size, quarter increments
  width: number         // mm, across the finger
  thickness: number     // mm, radial
  fit: FitProfile
  profile: BandProfile  // exterior cross-section
}

/** Pendant — a set stone hung from a bail, optionally on a chain. */
export interface PendantGeo {
  bailInner: number     // mm, inner height of the bail loop
  bailGauge: number     // mm, wire diameter of the bail
  hasChain: boolean
  chainLength: number   // inches
  chainGauge: number    // mm, chain wire gauge
}

/** Earring — a pair (or single) of set stones on posts, optionally dropped. */
export interface EarringGeo {
  pair: boolean         // price/weight a matched pair vs a single
  postGauge: number     // mm, post wire diameter
  postLength: number    // mm
  back: EarringBack
  dropLength: number    // mm, 0 for a stud
}

/** Bracelet / bangle / cuff / tennis. */
export interface BraceletGeo {
  kind: BraceletKind
  wristCircumference: number // mm, measured wrist
  fitAllowance: number       // mm added for fit (snug/standard/loose)
  width: number              // mm
  thickness: number          // mm
  linkCount: number          // tennis: number of set stones around the length
}

/** Necklace / chain, optionally carrying a pendant. */
export type NecklaceStyle = 'cable' | 'curb' | 'rope' | 'figaro' | 'bead'
/** Decorative motif hung on the chain, rendered as a medallion pendant. */
export type NecklaceMotif = 'none' | 'celtic' | 'cross' | 'infinity' | 'heart' | 'halo' | 'cluster' | 'floral'
/** Stones set at intervals along the chain — a "station" / "by-the-yard" necklace. */
export interface NecklaceStation {
  stoneId: string   // catalog stone id (e.g. 'rub')
  shapeId: string   // cut
  carat: number     // per stone
  everyIn: number   // spacing along the chain, inches
}
export interface NecklaceGeo {
  length: number        // inches
  gauge: number         // mm, chain wire gauge
  hasPendant: boolean
  chainStyle: NecklaceStyle
  motif?: NecklaceMotif // optional decorative pendant motif (default: none)
  station?: NecklaceStation // optional stones spaced along the chain
}

/**
 * Body jewelry — barbells, rings and plugs sized in true millimetres and by wire
 * gauge, the way piercers actually spec them. One geometry block covers every
 * style; `style` selects which shape the engines and viewer read.
 */
export type BodyStyle =
  | 'barbell'    // straight barbell (tongue, industrial, nipple)
  | 'curved'     // curved barbell / banana (eyebrow, navel)
  | 'cbr'        // captive bead ring
  | 'circular'   // circular barbell / horseshoe
  | 'septum'     // septum clicker
  | 'labret'     // labret / flat-back stud
  | 'plug'       // double-flared plug (stretched lobe)
  | 'hoop'       // seamless / continuous hoop ring
  | 'tunnel'     // hollow ear tunnel (eyelet)
  | 'taper'      // stretching taper (cone)
  | 'spike'      // barbell with conical spike ends
  | 'nostril'    // nose stud / nostril screw
  | 'nipple'     // nipple shield (barbell + decorative plate)
  | 'pincher'    // tapered talon / pincher
export interface BodyGeo {
  style: BodyStyle
  gauge: number     // mm, shaft / wire diameter (1.6 mm = 14g, 1.2 mm = 16g)
  size: number      // mm, wearable length (barbell) or inner diameter (ring / plug)
  ballSize: number  // mm, ball / bead / disc diameter
}

export interface DesignSpec {
  version: 1
  category: ProductCategory
  hidden?: string[]     // feature keys removed via the attribute pane
  metal: { alloyId: string; rhodium?: boolean; twoTone?: boolean; headAlloyId?: string; form?: string }
  center: Center
  setting: { typeId: string; melee?: MeleeSpec }
  finish: FinishId
  engraving: Engraving
  ring: RingGeo
  pendant: PendantGeo
  earring: EarringGeo
  bracelet: BraceletGeo
  necklace: NecklaceGeo
  body: BodyGeo
}

export const DEFAULT_RING: RingGeo = { size: 6.5, width: 2.0, thickness: 1.8, fit: 'standard', profile: 'round' }
export const DEFAULT_PENDANT: PendantGeo = { bailInner: 4.0, bailGauge: 1.2, hasChain: true, chainLength: 18, chainGauge: 1.0 }
export const DEFAULT_EARRING: EarringGeo = { pair: true, postGauge: 0.8, postLength: 10, back: 'friction', dropLength: 0 }
export const DEFAULT_BRACELET: BraceletGeo = { kind: 'tennis', wristCircumference: 165, fitAllowance: 12, width: 3.5, thickness: 2.2, linkCount: 42 }
export const DEFAULT_NECKLACE: NecklaceGeo = { length: 18, gauge: 1.2, hasPendant: false, chainStyle: 'cable', motif: 'none' }
export const DEFAULT_BODY: BodyGeo = { style: 'barbell', gauge: 1.6, size: 10, ballSize: 4 }

export const DEFAULT_SPEC: DesignSpec = {
  version: 1,
  category: 'ring',
  metal: { alloyId: '14ky' },
  center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1.0, grading: DEFAULT_GRADING, cert: DEFAULT_CERT },
  setting: { typeId: 'p4' },
  finish: 'polish',
  engraving: { text: '', placement: 'inside', font: 'Serif', position: 0.75 },
  ring: DEFAULT_RING,
  pendant: DEFAULT_PENDANT,
  earring: DEFAULT_EARRING,
  bracelet: DEFAULT_BRACELET,
  necklace: DEFAULT_NECKLACE,
  body: DEFAULT_BODY
}

/** Sentinel stone id for a plain, unstoned piece (a wedding band, a chain). */
export const NO_STONE = 'none'

/** Does this category carry a single center stone in a head? */
export const hasCenterStone = (c: ProductCategory): boolean =>
  c === 'ring' || c === 'pendant' || c === 'earring'

/** Does this category use the prong/bezel setting head? */
export const usesSetting = (c: ProductCategory): boolean => hasCenterStone(c)

/**
 * Does this specific design actually carry a set stone? Accounts both for the
 * category (a plain chain never does) and for an explicit "no stone" choice
 * (a wedding band in a stone-bearing category).
 */
export function stoneOnPiece(spec: DesignSpec): boolean {
  if (spec.center.stoneTypeId === NO_STONE) return false
  if (hasCenterStone(spec.category)) return true
  if (spec.category === 'bracelet') return spec.bracelet.kind === 'tennis'
  if (spec.category === 'necklace') return spec.necklace.hasPendant
  return false
}

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  ring: 'Ring',
  pendant: 'Pendant',
  earring: 'Earrings',
  bracelet: 'Bracelet',
  necklace: 'Necklace',
  body: 'Body Jewelry'
}
