import { useEffect, useRef, useState } from 'react'
import { useAiChat } from '../state/aiChat'

const SUGGESTIONS = [
  '2 ct emerald-cut diamond three-stone in platinum, size 6.5',
  'Rose-gold oval halo with a 1.25 ct center, satin finish',
  'A vintage-style cushion sapphire ring in 18k yellow gold',
  'Simple 2.5 mm comfort-fit wedding band, no stone',
]

/**
 * The AI studio — a full-tab design assistant. You describe the piece in as much
 * detail as you like (or drop in a reference photo/sketch); the model replies and
 * applies a design to the live render beside this panel, so the ring builds as
 * you talk. The conversation lives in a persistent store, so switching tabs (or a
 * request still running) never loses your work — only Reset or a page reload clears it.
 */
export function AIStudioPanel() {
  const { enabled, messages, input, image, busy, error, routes, checkEnabled, setInput, setImage, send, applyRoute, reset } = useAiChat()
  const scroller = useRef<HTMLDivElement>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => { void checkEnabled() }, [checkEnabled])
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])

  // Count up while the model works, so a slow first request (a sleeping server can
  // take up to a minute to wake) visibly progresses instead of looking frozen.
  useEffect(() => {
    if (!busy) { setElapsed(0); return }
    setElapsed(1)
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [busy])

  const pickImage = (file: File) => {
    const r = new FileReader()
    r.onload = () => setImage(typeof r.result === 'string' ? r.result : null)
    r.readAsDataURL(file)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) }   // Enter sends, Shift+Enter = newline
  }

  return (
    <div className="aistudio">
      <div className="aistudio-head">
        <div>
          <h2>AI design studio ✦</h2>
          <p>Describe the piece in detail — the render beside this builds as you go. Drop in a photo or sketch to start from a reference.</p>
        </div>
        {messages.length > 0 && <button className="aistudio-reset" onClick={reset} title="Start a new conversation">Reset</button>}
      </div>

      {enabled === false ? (
        <div className="ai-off">
          <p><b>Not switched on yet.</b> The studio runs on your shop's own API key, held on the server.</p>
          <p>Add <code>AI_API_KEY</code> to the backend environment on Render (optionally <code>AI_PROVIDER=openai</code>), then reopen this tab. Nothing is sent anywhere until a key is set.</p>
        </div>
      ) : (
        <>
          <div className="ai-chat" ref={scroller}>
            {messages.length === 0 && (
              <div className="ai-intro">
                <p>Try one of these, or write your own:</p>
                <div className="ai-sugg">
                  {SUGGESTIONS.map(s => <button key={s} className="opt" onClick={() => void send(s)} disabled={busy || enabled === null}>{s}</button>)}
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              const liveRoutes = m.routes && routes.length && m.routes === routes
              return (
              <div key={i} className={`ai-msg ${m.role}`}>
                {m.image && <img src={m.image} alt="upload" className="ai-thumb" />}
                <div className="ai-bubble">
                  {m.content}
                  {m.matched && m.matched.length > 0 && (
                    <div className="ai-chips">{m.matched.map((c, j) => <span key={j} className="ai-chip">{c}</span>)}</div>
                  )}
                  {m.assumptions && m.assumptions.length > 0 && (
                    <div className="ai-chips">{m.assumptions.map((a, j) => <span key={j} className="ai-chip" title="An assumption the AI made">≈ {a}</span>)}</div>
                  )}
                  {m.routes && m.routes.length > 0 && (
                    <div className="ai-routes">
                      {m.routes.map((r, j) => (
                        <div key={j} className="ai-route">
                          <div className="ai-route-head"><span className="ai-route-n">{j + 1}</span><b>{r.label}</b></div>
                          {r.note && <p className="ai-route-note">{r.note}</p>}
                          {r.matched.length > 0 && <div className="ai-chips">{r.matched.map((c, k) => <span key={k} className="ai-chip">{c}</span>)}</div>}
                          {liveRoutes
                            ? <button className="primary ai-route-build" onClick={() => applyRoute(j)}>Build this ✦</button>
                            : <span className="ai-route-done">choice made above</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )})}
            {busy && <div className="ai-msg assistant"><div className="ai-bubble ai-typing">Designing… {elapsed}s{elapsed > 8 ? ' · waking the server can take up to a minute' : ''}</div></div>}
          </div>

          {error && <div className="ai-err">{error}</div>}
          {image && <div className="ai-attach">Reference image attached <button onClick={() => setImage(null)} aria-label="remove image">✕</button></div>}

          <div className="ai-composer">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={3}
              placeholder={enabled === null ? 'Checking…' : 'e.g. A three-stone engagement ring: 2 ct oval center flanked by half-carat pears, platinum, size 6, cathedral shoulders…'}
              disabled={busy || enabled === null}
            />
            <div className="ai-composer-row">
              <label className="ai-upload" title="Attach a photo or sketch">
                📷 Reference<input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = '' }} />
              </label>
              <span className="ai-hint">Enter to send · Shift+Enter for a new line · your chat stays as you switch tabs</span>
              <button className="primary" onClick={() => void send(input)} disabled={busy || (!input.trim() && !image)}>Generate ✦</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
