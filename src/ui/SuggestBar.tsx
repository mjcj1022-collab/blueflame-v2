import { useState, useEffect } from 'react'
import { useDesign } from '../state/design'
import { summarizeDesign } from '../lib/designSummary'
import { askAssistant, applyAiDesign, assistantEnabled, type AiDesignPatch } from '../lib/aiAssistant'

/**
 * A compact assistant bar pinned to the bottom of the builder. On demand it asks
 * the AI for one specific next move given the current design, shows it, and lets
 * you apply the change in a click. Hidden entirely when the assistant isn't
 * switched on, so the builder stays clean without a key.
 */
export function SuggestBar() {
  const spec = useDesign(s => s.spec)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [tip, setTip] = useState<{ text: string; design: AiDesignPatch | null; matched: string[] } | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => { void assistantEnabled().then(setEnabled) }, [])

  if (!enabled) return null   // dormant without a key

  const suggest = async () => {
    if (busy) return
    setBusy(true); setErr(false); setTip(null)
    try {
      const res = await askAssistant([{
        role: 'user',
        content: `I'm designing this piece: ${summarizeDesign(spec)}. Suggest ONE specific next move to improve or complete it — a metal, stone, setting, finish, size or proportion change. One short sentence in "reply", and put the concrete change in "design".`
      }])
      if (res.disabled) { setEnabled(false); return }
      setTip({ text: res.reply, design: res.design, matched: res.matched })
    } catch { setErr(true) }
    finally { setBusy(false) }
  }

  const apply = () => { if (tip?.design) { applyAiDesign(tip.design); setTip(null) } }

  return (
    <div className="suggestbar">
      {tip ? (
        <div className="suggestbar-tip">
          <span className="sb-mark">✦</span>
          <span className="sb-text">{tip.text}</span>
          {tip.matched.length > 0 && <span className="sb-chips">{tip.matched.map((c, i) => <i key={i}>{c}</i>)}</span>}
          {tip.design && <button className="sb-apply" onClick={apply}>Apply</button>}
          <button className="sb-x" onClick={() => setTip(null)} aria-label="Dismiss">×</button>
        </div>
      ) : (
        <button className="suggestbar-ask" onClick={suggest} disabled={busy}>
          ✦ {busy ? 'Thinking…' : err ? 'Try again' : 'Suggest a next move'}
        </button>
      )}
    </div>
  )
}
