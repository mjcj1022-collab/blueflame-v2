import { useEffect, useState } from 'react'
import { useHotkeys, HOTKEY_DEFS, isReservedKey, type HotkeyAction } from '../state/hotkeys'

const GROUPS = [...new Set(HOTKEY_DEFS.map(d => d.group))]

/**
 * Lists every reassignable tool-switch shortcut (Sculpt bench + Design/AI
 * vertex tools), grouped by where they apply. Click a key, press a new one —
 * reserved keys (Escape/Enter/Delete/Tab/Space, or anything with a modifier)
 * and keys already used by another tool in the same group are rejected with
 * an inline note instead of silently overwriting. Escape while capturing
 * cancels instead of picking Escape as the new key.
 */
export function HotkeysModal({ onClose }: { onClose: () => void }) {
  const keyFor = useHotkeys(s => s.keyFor)
  const setBinding = useHotkeys(s => s.setBinding)
  const resetBinding = useHotkeys(s => s.resetBinding)
  const resetAll = useHotkeys(s => s.resetAll)
  const conflicts = useHotkeys(s => s.conflicts)
  useHotkeys(s => s.bindings)   // subscribe so this re-renders after any change below

  const [capturing, setCapturing] = useState<HotkeyAction | null>(null)
  const [warn, setWarn] = useState<string | null>(null)

  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const key = e.key.toLowerCase()
      if (key === 'escape') { setCapturing(null); setWarn(null); return }
      if (isReservedKey(key) || e.ctrlKey || e.metaKey || e.altKey) {
        setWarn(`"${e.key}" is reserved — pick a plain letter or number.`)
        return
      }
      const clashes = conflicts(capturing, key)
      if (clashes.length) {
        setWarn(`"${key.toUpperCase()}" is already ${clashes[0].label} — pick another key or reassign that one first.`)
        return
      }
      setBinding(capturing, key)
      setCapturing(null)
      setWarn(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing, conflicts, setBinding])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-win hotkeys-win" onClick={e => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div className="settings-head">
          <h2>Keyboard shortcuts</h2>
          <button className="settings-x" onClick={onClose} aria-label="Close shortcuts">✕</button>
        </div>

        <div className="settings-body hotkeys-body">
          <p className="hotkeys-intro">Click a key, then press the one you want instead. Every tool button also shows its current key on hover.</p>

          {GROUPS.map(group => (
            <div key={group} className="settings-section hotkeys-group">
              <b>{group}</b>
              {HOTKEY_DEFS.filter(d => d.group === group).map(d => (
                <div key={d.action} className="hotkey-row">
                  <span>{d.label}</span>
                  <div className="hotkey-ctl">
                    <button
                      className={`hotkey-key ${capturing === d.action ? 'capturing' : ''}`}
                      onClick={() => { setCapturing(d.action); setWarn(null) }}
                      title="Click, then press a new key"
                    >
                      {capturing === d.action ? 'Press a key…' : keyFor(d.action)}
                    </button>
                    {keyFor(d.action) !== d.defaultKey.toUpperCase() && (
                      <button className="hotkey-reset" onClick={() => resetBinding(d.action)} title="Reset to default">↺</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {warn && <div className="hotkey-warn">{warn}</div>}

          <button className="opt hotkeys-reset-all" onClick={resetAll}>Reset all to defaults</button>
        </div>
      </div>
    </div>
  )
}
