import { useSettings } from '../state/settings'

/** A small settings window. Currently: toggle the next-step suggestion toast.
 *  Built to grow — add more preference rows here as settings are introduced. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const suggestToast = useSettings((s) => s.suggestToast)
  const setSuggestToast = useSettings((s) => s.setSuggestToast)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-win" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="settings-head">
          <h2>Settings</h2>
          <button className="settings-x" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className="settings-body">
          <label className="settings-row">
            <span>
              <b>Next-step suggestions</b>
              <small>Show the ✦ hint in the bottom-left that suggests what to do next.</small>
            </span>
            <button
              className={`toggle ${suggestToast ? 'on' : ''}`}
              role="switch"
              aria-checked={suggestToast}
              onClick={() => setSuggestToast(!suggestToast)}
            >
              <span className="toggle-knob" />
            </button>
          </label>
        </div>
      </div>
    </div>
  )
}
