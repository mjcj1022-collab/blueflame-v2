import { useSettings, ALL_CATEGORIES, PANELS } from '../state/settings'
import { CATEGORY_LABEL } from '../spec/types'

/** A reusable on/off switch row. */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span className="toggle-knob" />
    </button>
  )
}

/** Full settings window — customize suggestions, which pieces you build, which
 *  side panels show, and the look. Everything persists across visits. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useSettings()

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-win" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="settings-head">
          <h2>Settings</h2>
          <button className="settings-x" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className="settings-body">
          {/* Suggestions */}
          <label className="settings-row">
            <span>
              <b>Next-step suggestions</b>
              <small>Show the ✦ hint that suggests what to do next.</small>
            </span>
            <Toggle on={s.suggestToast} onChange={s.setSuggestToast} label="Next-step suggestions" />
          </label>

          {/* Pieces you build */}
          <div className="settings-section">
            <b>Pieces you build</b>
            <small>Tick the piece types you make. The picker and per-piece panels show only these.</small>
            <div className="settings-checks">
              {ALL_CATEGORIES.map((c) => {
                const on = s.enabledCategories.includes(c)
                const last = on && s.enabledCategories.length === 1
                return (
                  <label key={c} className={`settings-check ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} disabled={last} onChange={() => s.toggleCategory(c)} />
                    <span>{CATEGORY_LABEL[c]}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Side panels */}
          <div className="settings-section">
            <b>Side panels</b>
            <small>Show or hide panels in the right-hand builder. Untick what you don't use to keep it clean.</small>
            <div className="settings-checks">
              {PANELS.map(([key, label]) => {
                const on = !s.hiddenPanels.includes(key)
                return (
                  <label key={key} className={`settings-check ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => s.togglePanel(key)} />
                    <span>{label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Appearance */}
          <div className="settings-section">
            <b>Appearance</b>
            <label className="settings-row inset">
              <span><b>Paper texture</b><small>The warm grain over panels and bars.</small></span>
              <Toggle on={s.paperTexture} onChange={s.setPaperTexture} label="Paper texture" />
            </label>
            <label className="settings-row inset">
              <span><b>Compact spacing</b><small>Tighter padding to fit more on screen.</small></span>
              <Toggle on={s.compact} onChange={s.setCompact} label="Compact spacing" />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
