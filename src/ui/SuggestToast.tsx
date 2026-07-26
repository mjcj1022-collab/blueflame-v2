import { useDesign } from '../state/design'
import { useWorkspace } from '../state/workspace'
import { useSettings } from '../state/settings'
import { nextStepTip } from '../lib/nextStep'

/**
 * A persistent next-step hint pinned to the bottom-left. It stays until you close
 * it with ✕ (which advances to the following relevant tip), and can be switched
 * off entirely in Settings. Hidden when the user has turned suggestions off.
 */
export function SuggestToast() {
  const spec = useDesign((s) => s.spec)
  const mode = useWorkspace((s) => s.mode)
  const on = useSettings((s) => s.suggestToast)
  const dismissed = useSettings((s) => s.dismissed)
  const dismiss = useSettings((s) => s.dismiss)

  if (!on) return null
  const tip = nextStepTip(spec, mode, dismissed)
  if (!tip) return null

  return (
    <div className="toast" role="status">
      <span className="toast-mark">✦</span>
      <span className="toast-text">{tip.text}</span>
      <button className="toast-x" onClick={() => dismiss(tip.id)} aria-label="Dismiss this suggestion">✕</button>
    </div>
  )
}
