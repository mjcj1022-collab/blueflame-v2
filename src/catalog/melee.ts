/** Accent-stone quality tiers and setting styles for the melee designer. */
export interface Tier { id: string; label: string; mult: number }

/** Quality tier multiplies the per-stone melee price. */
export const MELEE_QUALITY: Tier[] = [
  { id: 'gh', label: 'G-H / VS', mult: 1.0 },
  { id: 'ij', label: 'I-J / SI', mult: 0.62 },
  { id: 'fg', label: 'F-G / VVS', mult: 1.55 }
]

/** Setting style multiplies the per-stone setting labor. */
export const MELEE_STYLE: Tier[] = [
  { id: 'bright', label: 'Bright-cut', mult: 1.0 },
  { id: 'bead', label: 'Bead', mult: 0.9 },
  { id: 'shared', label: 'Shared-prong', mult: 1.15 },
  { id: 'fishtail', label: 'Fishtail', mult: 1.35 },
  { id: 'french', label: 'French', mult: 1.5 }
]

const by = (list: Tier[], id: string) => list.find(t => t.id === id) ?? list[0]
export const meleeQuality = (id: string) => by(MELEE_QUALITY, id)
export const meleeStyle = (id: string) => by(MELEE_STYLE, id)

export interface MeleeSpec {
  count?: number       // override the setting's default accent count
  caratEach?: number   // override accent stone size
  quality?: string
  style?: string
  stoneId?: string     // accent stone type (e.g. 'rub'); defaults to the centre stone
}

export const DEFAULT_MELEE: Required<MeleeSpec> = { count: 0, caratEach: 0.015, quality: 'gh', style: 'bright', stoneId: 'dia' }
