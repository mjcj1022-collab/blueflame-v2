import { create } from 'zustand'

/**
 * Every reassignable single-key shortcut in the app — the tool-switch keys on
 * the Sculpt bench and the Design/AI vertex-edit tools. Universal editor
 * conventions (Ctrl+Z undo, Escape/Enter/Delete while sketching) are left
 * fixed and aren't part of this registry.
 */
export type HotkeyAction =
  | 'sculpt.move' | 'sculpt.select' | 'sculpt.edit' | 'sculpt.add' | 'sculpt.remove'
  | 'sculpt.lasso' | 'sculpt.surface' | 'sculpt.sketch2d' | 'sculpt.sketch3d'
  | 'sculpt.addBox' | 'sculpt.addSphere' | 'sculpt.addGem'
  | 'sculpt.gizmoTranslate' | 'sculpt.gizmoRotate' | 'sculpt.gizmoScale'
  | 'design.move' | 'design.select' | 'design.edit' | 'design.add' | 'design.remove'

interface HotkeyDef { action: HotkeyAction; label: string; group: string; defaultKey: string }

export const HOTKEY_DEFS: HotkeyDef[] = [
  { action: 'sculpt.move', label: 'Move whole object', group: 'Sculpt · tools', defaultKey: '1' },
  { action: 'sculpt.select', label: 'Select vertices', group: 'Sculpt · tools', defaultKey: '2' },
  { action: 'sculpt.edit', label: 'Edit vertices (drag)', group: 'Sculpt · tools', defaultKey: '3' },
  { action: 'sculpt.add', label: 'Add a vertex', group: 'Sculpt · tools', defaultKey: '4' },
  { action: 'sculpt.remove', label: 'Remove a vertex', group: 'Sculpt · tools', defaultKey: '5' },
  { action: 'sculpt.lasso', label: 'Lasso-select vertices', group: 'Sculpt · tools', defaultKey: '6' },
  { action: 'sculpt.surface', label: 'Draw on the surface', group: 'Sculpt · tools', defaultKey: '7' },
  { action: 'sculpt.sketch2d', label: '2D sketch (revolve/extrude)', group: 'Sculpt · tools', defaultKey: '8' },
  { action: 'sculpt.sketch3d', label: '3D builder', group: 'Sculpt · tools', defaultKey: '9' },
  { action: 'sculpt.addBox', label: 'Add a box', group: 'Sculpt · primitives', defaultKey: 'b' },
  { action: 'sculpt.addSphere', label: 'Add a sphere', group: 'Sculpt · primitives', defaultKey: 'o' },
  { action: 'sculpt.addGem', label: 'Add a gem', group: 'Sculpt · primitives', defaultKey: 'j' },
  { action: 'sculpt.gizmoTranslate', label: 'Translate gizmo', group: 'Sculpt · transform gizmo', defaultKey: 'g' },
  { action: 'sculpt.gizmoRotate', label: 'Rotate gizmo', group: 'Sculpt · transform gizmo', defaultKey: 'r' },
  { action: 'sculpt.gizmoScale', label: 'Scale gizmo', group: 'Sculpt · transform gizmo', defaultKey: 's' },
  { action: 'design.move', label: 'View / orbit (exit editing)', group: 'Design & AI · vertex tools', defaultKey: '1' },
  { action: 'design.select', label: 'Select vertices', group: 'Design & AI · vertex tools', defaultKey: '2' },
  { action: 'design.edit', label: 'Edit vertices (drag)', group: 'Design & AI · vertex tools', defaultKey: '3' },
  { action: 'design.add', label: 'Add a vertex', group: 'Design & AI · vertex tools', defaultKey: '4' },
  { action: 'design.remove', label: 'Remove a vertex', group: 'Design & AI · vertex tools', defaultKey: '5' },
]

const DEF_BY_ACTION = new Map(HOTKEY_DEFS.map(d => [d.action, d]))
const KEY = 'mandrel.hotkeys.v1'
type Bindings = Record<string, string>

function defaults(): Bindings {
  const b: Bindings = {}
  for (const d of HOTKEY_DEFS) b[d.action] = d.defaultKey
  return b
}
function loadBindings(): Bindings {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Bindings
    for (const d of HOTKEY_DEFS) if (typeof saved[d.action] === 'string') base[d.action] = saved[d.action]
  } catch { /* private mode / corrupt value — fall back to defaults */ }
  return base
}
function saveBindings(b: Bindings) { try { localStorage.setItem(KEY, JSON.stringify(b)) } catch { /* private mode */ } }

interface HotkeyStore {
  bindings: Bindings
  /** The key currently bound to an action, uppercased for display (e.g. "G"). */
  keyFor: (action: HotkeyAction) => string
  /** True if `key` (already lowercased) is the live binding for `action`. */
  isBound: (action: HotkeyAction, key: string) => boolean
  /** Every other action already using this key, within the same scope — the
   *  "sculpt." or "design." prefix, i.e. the one keydown handler that would
   *  actually see both keypresses. Display `group` is cosmetic only; scope is
   *  the real collision domain. */
  conflicts: (action: HotkeyAction, key: string) => HotkeyDef[]
  setBinding: (action: HotkeyAction, key: string) => void
  resetBinding: (action: HotkeyAction) => void
  resetAll: () => void
}

export const useHotkeys = create<HotkeyStore>((set, get) => ({
  bindings: loadBindings(),
  keyFor: action => (get().bindings[action] ?? DEF_BY_ACTION.get(action)?.defaultKey ?? '').toUpperCase(),
  isBound: (action, key) => (get().bindings[action] ?? '') === key,
  conflicts: (action, key) => {
    const scope = action.split('.')[0]
    const b = get().bindings
    return HOTKEY_DEFS.filter(d => d.action !== action && d.action.split('.')[0] === scope && (b[d.action] ?? d.defaultKey) === key)
  },
  setBinding: (action, key) => set(s => {
    const next = { ...s.bindings, [action]: key.toLowerCase() }
    saveBindings(next)
    return { bindings: next }
  }),
  resetBinding: action => set(s => {
    const def = DEF_BY_ACTION.get(action)
    if (!def) return s
    const next = { ...s.bindings, [action]: def.defaultKey }
    saveBindings(next)
    return { bindings: next }
  }),
  resetAll: () => { const b = defaults(); saveBindings(b); set({ bindings: b }) },
}))

/** Keys that must stay off-limits for reassignment — they'd break navigation,
 *  typing, or an already-fixed convention elsewhere in the app. */
const RESERVED = new Set(['escape', 'enter', 'delete', 'backspace', 'tab', ' '])
export const isReservedKey = (key: string): boolean => RESERVED.has(key.toLowerCase())
