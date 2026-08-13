import { useEffect, useState } from 'react'
import { api, apiConfigured, type PublicOrderStatus } from '../lib/api'
import { ORDER_STAGES, stageIndex } from '../lib/orderStages'
import { CATEGORY_LABEL, type ProductCategory } from '../spec/types'

/**
 * No-login order-status page for the buyer — opened via a `?order=<id>` link
 * (see lib/share.ts's orderTrackUrl/orderIdFromUrl and main.tsx's routing).
 * Read-only: shows where the piece is in the shop's pipeline without needing
 * an account. The id itself is the only credential, same model as the
 * existing ?review= design-approval link.
 */
export function OrderTrack({ id }: { id: string }) {
  const [order, setOrder] = useState<PublicOrderStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!apiConfigured()) { setError('This tracking link needs a connected shop backend.'); setLoading(false); return }
      try {
        const o = await api.publicOrderStatus(id)
        if (active) { setOrder(o); setError(null) }
      } catch {
        if (active) setError('We couldn’t find that order. Double-check the link, or ask the shop directly.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [id])

  const idx = order ? stageIndex(order.stage) : 0
  const category = order?.category as ProductCategory | null
  const pieceLabel = category && CATEGORY_LABEL[category] ? CATEGORY_LABEL[category] : (order?.design_name ?? 'piece')

  return (
    <>
      <header className="mast">
        <div className="mast-in">
          <span className="logo">{order?.shop_name ?? 'Mandrel'}</span>
          <span className="tag">Order status</span>
        </div>
      </header>
      <div className="order-track">
        <div className="order-track-card">
          {loading && <p className="disc">Checking your order…</p>}
          {!loading && error && <p className="disc" style={{ color: '#D98A5F' }}>{error}</p>}
          {!loading && order && (
            <>
              <h3 className="review-h">Your {pieceLabel.toLowerCase()}</h3>
              <p className="disc">
                {order.design_name ? `“${order.design_name}” — ` : ''}
                placed {new Date(order.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.
              </p>
              <div className="pipeline order-track-pipeline">
                {ORDER_STAGES.map((s, i) => (
                  <div key={s.key} className={`stage ${i < idx ? 'done' : i === idx ? 'now' : ''}`}>
                    <span className="dot" /><span className="lbl">{s.label}</span>
                  </div>
                ))}
              </div>
              <p className="disc" style={{ marginTop: 16 }}>
                This page updates as {order.shop_name} moves your piece through the shop — bookmark it to check back any
                time. Questions before then? Reach out to {order.shop_name} directly.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
