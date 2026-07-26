import { create } from 'zustand'

/**
 * App-wide user preferences. `suggestToast` (the bottom-left next-step hint) is
 * persisted to localStorage so the choice sticks across sessions; the per-tip
 * `dismissed` set is session-only so hints can return on a fresh visit.
 */
const KEY = 'blue-flame.settings.v1'

function loadSuggest(): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw).suggestToast !== false : true
  } catch { return true }
}

interface SettingsStore {
  suggestToast: boolean
  dismissed: string[]
  setSuggestToast: (on: boolean) => void
  dismiss: (id: string) => void
}

export const useSettings = create<SettingsStore>((set) => ({
  suggestToast: loadSuggest(),
  dismissed: [],
  setSuggestToast: (on) => {
    set({ suggestToast: on })
    try { localStorage.setItem(KEY, JSON.stringify({ suggestToast: on })) } catch { /* private mode */ }
  },
  dismiss: (id) => set((s) => (s.dismissed.includes(id) ? s : { dismissed: [...s.dismissed, id] })),
}))
