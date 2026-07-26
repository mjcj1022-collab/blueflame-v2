import { create } from 'zustand'
import type { ProductCategory } from '../spec/types'

/**
 * App-wide user preferences, persisted to localStorage:
 *  - suggestToast: show the bottom-left next-step hint.
 *  - enabledCategories: which piece types the shop builds (prunes the picker + panels).
 *  - hiddenPanels: side panels the user has switched off.
 *  - paperTexture: the warm paper grain overlay on/off.
 *  - compact: tighter spacing throughout.
 * At least one category is always kept enabled. `dismissed` is session-only.
 */
const KEY = 'blue-flame.settings.v1'
export const ALL_CATEGORIES: ProductCategory[] = ['ring', 'pendant', 'earring', 'bracelet', 'necklace', 'body']

/** Toggleable side panels (key → label). Order matches the builder. */
export const PANELS: [string, string][] = [
  ['stoneSource', 'Stone sourcing'],
  ['variants', 'Variants'],
  ['metalOptions', 'Metal options'],
  ['production', 'Production'],
  ['customers', 'Customers'],
  ['library', 'Library'],
  ['projects', 'Projects'],
]

interface Persisted {
  suggestToast: boolean
  enabledCategories: ProductCategory[]
  hiddenPanels: string[]
  paperTexture: boolean
  compact: boolean
}

function load(): Persisted {
  const fb: Persisted = { suggestToast: true, enabledCategories: [...ALL_CATEGORIES], hiddenPanels: [], paperTexture: true, compact: false }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fb
    const p = JSON.parse(raw) as Partial<Persisted>
    const cats = Array.isArray(p.enabledCategories) ? p.enabledCategories.filter((c): c is ProductCategory => ALL_CATEGORIES.includes(c as ProductCategory)) : fb.enabledCategories
    return {
      suggestToast: p.suggestToast !== false,
      enabledCategories: cats.length ? cats : fb.enabledCategories,
      hiddenPanels: Array.isArray(p.hiddenPanels) ? p.hiddenPanels.filter((x): x is string => typeof x === 'string') : [],
      paperTexture: p.paperTexture !== false,
      compact: p.compact === true,
    }
  } catch { return fb }
}

interface SettingsStore extends Persisted {
  dismissed: string[]
  setSuggestToast: (on: boolean) => void
  toggleCategory: (c: ProductCategory) => void
  togglePanel: (key: string) => void
  setPaperTexture: (on: boolean) => void
  setCompact: (on: boolean) => void
  dismiss: (id: string) => void
}

export const useSettings = create<SettingsStore>((set, get) => {
  const persist = () => {
    const s = get()
    try { localStorage.setItem(KEY, JSON.stringify({ suggestToast: s.suggestToast, enabledCategories: s.enabledCategories, hiddenPanels: s.hiddenPanels, paperTexture: s.paperTexture, compact: s.compact })) } catch { /* private mode */ }
  }
  return {
    ...load(),
    dismissed: [],
    setSuggestToast: (on) => { set({ suggestToast: on }); persist() },
    toggleCategory: (c) => {
      const cur = get().enabledCategories
      const next = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
      if (next.length === 0) return
      set({ enabledCategories: ALL_CATEGORIES.filter((x) => next.includes(x)) }); persist()
    },
    togglePanel: (key) => {
      const cur = get().hiddenPanels
      set({ hiddenPanels: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] }); persist()
    },
    setPaperTexture: (on) => { set({ paperTexture: on }); persist() },
    setCompact: (on) => { set({ compact: on }); persist() },
    dismiss: (id) => set((s) => (s.dismissed.includes(id) ? s : { dismissed: [...s.dismissed, id] })),
  }
})
