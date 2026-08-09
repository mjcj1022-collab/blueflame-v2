import { create } from 'zustand'
import {
  DEFAULT_SPEC, NO_STONE, type DesignSpec, type FitProfile, type ProductCategory, type FinishId
} from '../spec/types'
import { registerAlloy, SETTINGS, type Alloy } from '../catalog'
import { MARKET, setMarket as applyMarket, type Market } from '../lib/market'
import type { WeightUnit } from '../lib/units'

interface DesignStore {
  spec: DesignSpec
  unit: WeightUnit
  compareOpen: boolean
  market: Market
  setMarket: (patch: Partial<Market>) => void
  shop: { name: string; hideCost: boolean }
  setShop: (patch: Partial<{ name: string; hideCost: boolean }>) => void
  orderStage: number
  setOrderStage: (i: number) => void
  viewWire: boolean
  toggleWire: () => void
  colorwork: { metal: string | null; stone: string | null; bg: string | null }
  setColorwork: (patch: Partial<{ metal: string | null; stone: string | null; bg: string | null }>) => void
  resetColorwork: () => void
  colorTarget: 'metal' | 'stone' | 'bg'
  setColorTarget: (t: 'metal' | 'stone' | 'bg') => void
  explode: number
  setExplode: (v: number) => void
  tryOn: boolean
  toggleTryOn: () => void
  skinTone: string
  setSkinTone: (c: string) => void
  variants: DesignSpec[]
  pinVariant: () => void
  unpinVariant: (i: number) => void
  setCategory: (c: ProductCategory) => void
  setRing: (patch: Partial<DesignSpec['ring']>) => void
  setPendant: (patch: Partial<DesignSpec['pendant']>) => void
  setEarring: (patch: Partial<DesignSpec['earring']>) => void
  setBracelet: (patch: Partial<DesignSpec['bracelet']>) => void
  setNecklace: (patch: Partial<DesignSpec['necklace']>) => void
  setBody: (patch: Partial<DesignSpec['body']>) => void
  setAlloy: (id: string) => void
  setRhodium: (on: boolean) => void
  setTwoTone: (on: boolean) => void
  setHeadAlloy: (id: string) => void
  setMetalForm: (id: string) => void
  applyCustomAlloy: (alloy: Alloy) => void
  setShape: (id: string) => void
  setStone: (id: string) => void
  setCarat: (ct: number) => void
  setSeat: (v: number) => void
  setGrading: (patch: Partial<DesignSpec['center']['grading']>) => void
  setCert: (patch: Partial<DesignSpec['center']['cert']>) => void
  setSetting: (id: string) => void
  setProfile: (p: DesignSpec['ring']['profile']) => void
  setMelee: (patch: Partial<NonNullable<DesignSpec['setting']['melee']>>) => void
  setFinish: (id: FinishId) => void
  setEngraving: (patch: Partial<DesignSpec['engraving']>) => void
  setFit: (fit: FitProfile) => void
  toggleHidden: (key: string) => void
  deleteFeature: (key: string) => void
  reveal: (key: string) => void
  clearHidden: () => void
  load: (spec: DesignSpec) => void
  toggleUnit: () => void
  toggleCompare: () => void
  reset: () => void
  past: DesignSpec[]
  future: DesignSpec[]
  undo: () => void
  redo: () => void
}

const HISTORY_LIMIT = 80

export const useDesign = create<DesignStore>((rawSet, get) => {
  let timeTravel = false
  // Wrap set: whenever a mutation changes `spec`, snapshot the prior spec onto
  // the undo stack. Non-spec changes (view toggles, market, variants) are not
  // recorded. undo/redo flip `timeTravel` so restores don't re-enter history.
  const call = rawSet as (p: unknown, r?: boolean) => void
  const set = ((partial: unknown, replace?: boolean) => {
    const before = get().spec
    call(partial, replace)
    const after = get().spec
    if (!timeTravel && after !== before) {
      call((s: DesignStore) => ({ past: [...s.past, before].slice(-HISTORY_LIMIT), future: [] }))
    }
  }) as typeof rawSet

  return {
  spec: DEFAULT_SPEC,
  unit: 'g',
  compareOpen: true,
  past: [],
  future: [],
  undo: () => {
    const { past, spec, future } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    timeTravel = true
    rawSet({ spec: prev, past: past.slice(0, -1), future: [spec, ...future].slice(0, HISTORY_LIMIT) })
    timeTravel = false
  },
  redo: () => {
    const { past, spec, future } = get()
    if (!future.length) return
    const next = future[0]
    timeTravel = true
    rawSet({ spec: next, future: future.slice(1), past: [...past, spec].slice(-HISTORY_LIMIT) })
    timeTravel = false
  },
  market: { ...MARKET },
  // Update the shared engine settings and clone spec so every price display refreshes.
  setMarket: patch => { applyMarket(patch); set(s => ({ market: { ...s.market, ...patch }, spec: { ...s.spec } })) },
  shop: { name: 'Blue Flame', hideCost: false },
  setShop: patch => set(s => ({ shop: { ...s.shop, ...patch } })),
  orderStage: 0,
  setOrderStage: i => set({ orderStage: Math.max(0, Math.min(6, i)) }),
  viewWire: false,
  toggleWire: () => set(s => ({ viewWire: !s.viewWire })),
  colorwork: { metal: null, stone: null, bg: null },
  setColorwork: patch => set(s => ({ colorwork: { ...s.colorwork, ...patch } })),
  resetColorwork: () => set({ colorwork: { metal: null, stone: null, bg: null } }),
  colorTarget: 'metal',
  setColorTarget: t => set({ colorTarget: t }),
  explode: 0,
  setExplode: v => set({ explode: v }),
  tryOn: false,
  toggleTryOn: () => set(s => ({ tryOn: !s.tryOn })),
  skinTone: '#C89778',
  setSkinTone: c => set({ skinTone: c }),
  variants: [],
  pinVariant: () => set(s => (s.variants.length >= 4 ? {} : { variants: [...s.variants, s.spec] })),
  unpinVariant: i => set(s => ({ variants: s.variants.filter((_, j) => j !== i) })),
  setCategory: c => set(s => ({ spec: { ...s.spec, category: c } })),
  setRing: patch => set(s => ({ spec: { ...s.spec, ring: { ...s.spec.ring, ...patch } } })),
  setPendant: patch => set(s => ({ spec: { ...s.spec, pendant: { ...s.spec.pendant, ...patch } } })),
  setEarring: patch => set(s => ({ spec: { ...s.spec, earring: { ...s.spec.earring, ...patch } } })),
  setBracelet: patch => set(s => ({ spec: { ...s.spec, bracelet: { ...s.spec.bracelet, ...patch } } })),
  setNecklace: patch => set(s => ({ spec: { ...s.spec, necklace: { ...s.spec.necklace, ...patch } } })),
  setBody: patch => set(s => ({ spec: { ...s.spec, body: { ...s.spec.body, ...patch } } })),
  setAlloy: id => set(s => ({ spec: { ...s.spec, metal: { ...s.spec.metal, alloyId: id } } })),
  setRhodium: (on: boolean) => set(s => ({ spec: { ...s.spec, metal: { ...s.spec.metal, rhodium: on } } })),
  setTwoTone: (on: boolean) => set(s => ({ spec: { ...s.spec, metal: { ...s.spec.metal, twoTone: on, headAlloyId: s.spec.metal.headAlloyId ?? (s.spec.metal.alloyId === '14ky' ? '14kw' : '14ky') } } })),
  setHeadAlloy: (id: string) => set(s => ({ spec: { ...s.spec, metal: { ...s.spec.metal, headAlloyId: id } } })),
  setMetalForm: (id: string) => set(s => ({ spec: { ...s.spec, metal: { ...s.spec.metal, form: id } } })),
  applyCustomAlloy: alloy => { registerAlloy(alloy); set(s => ({ spec: { ...s.spec, metal: { ...s.spec.metal, alloyId: alloy.id } } })) },
  setShape: id => set(s => ({ spec: { ...s.spec, center: { ...s.spec.center, shapeId: id } } })),
  setStone: id => set(s => ({ spec: { ...s.spec, center: { ...s.spec.center, stoneTypeId: id } } })),
  setCarat: ct => set(s => ({ spec: { ...s.spec, center: { ...s.spec.center, carat: ct } } })),
  setSeat: v => set(s => ({ spec: { ...s.spec, center: { ...s.spec.center, seat: v } } })),
  setGrading: patch => set(s => ({ spec: { ...s.spec, center: { ...s.spec.center, grading: { ...s.spec.center.grading, ...patch } } } })),
  setCert: patch => set(s => ({ spec: { ...s.spec, center: { ...s.spec.center, cert: { ...s.spec.center.cert, ...patch } } } })),
  setSetting: id => set(s => ({ spec: { ...s.spec, setting: { typeId: id } } })),
  setProfile: p => set(s => ({ spec: { ...s.spec, ring: { ...s.spec.ring, profile: p } } })),
  setMelee: patch => set(s => ({ spec: { ...s.spec, setting: { ...s.spec.setting, melee: { ...s.spec.setting.melee, ...patch } } } })),
  setFinish: id => set(s => ({ spec: { ...s.spec, finish: id } })),
  setEngraving: patch => set(s => ({ spec: { ...s.spec, engraving: { ...s.spec.engraving, ...patch } } })),
  setFit: fit => set(s => ({ spec: { ...s.spec, ring: { ...s.spec.ring, fit } } })),
  // Backfill any fields absent from an older saved design.
  toggleHidden: key => set(s => {
    const cur = s.spec.hidden ?? []
    const hidden = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
    return { spec: { ...s.spec, hidden } }
  }),
  // Permanently remove an optional feature (as opposed to toggleHidden, which
  // just hides-and-can-restore it). Clears the underlying spec field so it's
  // gone for good; structural parts (band, bail, posts) aren't handled here —
  // see isDeletable() in lib/features, which gates whether the UI offers this.
  deleteFeature: key => set(s => {
    const spec = s.spec
    switch (key) {
      case 'engraving':
        return { spec: { ...spec, engraving: { ...spec.engraving, text: '' } } }
      case 'chain':
        return spec.category === 'pendant'
          ? { spec: { ...spec, pendant: { ...spec.pendant, hasChain: false } } }
          : s
      case 'station':
        return spec.category === 'necklace'
          ? { spec: { ...spec, necklace: { ...spec.necklace, station: undefined } } }
          : s
      case 'halo':
        // Reset to a plain, non-halo/non-eternity setting; drops any melee too.
        return { spec: { ...spec, setting: { typeId: SETTINGS[0].id } } }
      case 'stone':
      case 'head':
        return { spec: { ...spec, center: { ...spec.center, stoneTypeId: NO_STONE } } }
      default:
        return s
    }
  }),
  reveal: key => set(s => {
    const cur = s.spec.hidden ?? []
    return cur.includes(key) ? { spec: { ...s.spec, hidden: cur.filter(k => k !== key) } } : s
  }),
  clearHidden: () => set(s => ((s.spec.hidden?.length ?? 0) ? { spec: { ...s.spec, hidden: [] } } : s)),
  load: spec => set({ spec: {
    ...DEFAULT_SPEC, ...spec,
    ring: { ...DEFAULT_SPEC.ring, ...spec.ring },
    center: { ...DEFAULT_SPEC.center, ...spec.center, grading: { ...DEFAULT_SPEC.center.grading, ...spec.center?.grading }, cert: { ...DEFAULT_SPEC.center.cert, ...spec.center?.cert } },
    engraving: { ...DEFAULT_SPEC.engraving, ...spec.engraving }
  } }),
  toggleUnit: () => set(s => ({ unit: s.unit === 'g' ? 'dwt' : 'g' })),
  toggleCompare: () => set(s => ({ compareOpen: !s.compareOpen })),
  reset: () => set({ spec: DEFAULT_SPEC })
  }
})
