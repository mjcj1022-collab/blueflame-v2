import { useEffect, useState } from 'react'
import { useDesign } from '../state/design'
import { reviewUrl, orderTrackUrl } from '../lib/share'
import { api, apiConfigured, type ServerOrder, type Customer } from '../lib/api'
import { ORDER_STAGES, stageIndex, stageLabel, stageKey } from '../lib/orderStages'

/** Order status tracker. With a backend it manages the real, tenant-wide order
 *  pipeline (parametric and sculpted alike); standalone it's a local tracker. */
export function OrderPanel() {
  const spec = useDesign(s => s.spec)
  const shop = useDesign(s => s.shop)
  const stage = useDesign(s => s.orderStage)
  const setStage = useDesign(s => s.setOrderStage)
  const [copied, setCopied] = useState(false)

  const sendForApproval = async () => {
    try { await navigator.clipboard.writeText(reviewUrl(spec, shop.name)); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { /* clipboard blocked */ }
  }

  return apiConfigured() ? <ServerOrders /> : (
    <div className="panel-block">
      <h4>Order status <span className="mfg-sum"><b className="ok">{ORDER_STAGES[stage].label}</b></span></h4>
      <div className="pipeline">
        {ORDER_STAGES.map((s, i) => (
          <button key={s.key} className={`stage ${i < stage ? 'done' : i === stage ? 'now' : ''}`} onClick={() => setStage(i)}>
            <span className="dot" /><span className="lbl">{s.label}</span>
          </button>
        ))}
      </div>
      <div className="opts c2" style={{ marginTop: 12 }}>
        <button className="opt" disabled={stage === 0} onClick={() => setStage(stage - 1)}>Back</button>
        <button className="opt" disabled={stage === ORDER_STAGES.length - 1} onClick={() => setStage(stage + 1)}>Advance</button>
      </div>
      {stage === 0 && (
        <button className="opt" style={{ width: '100%', marginTop: 8 }} onClick={sendForApproval}>{copied ? 'Approval link copied ✓' : 'Copy approval link for client'}</button>
      )}
      <p className="disc">Send the client a no-login link to review and sign off before anything is cast. Advance the stage as the piece moves through the shop.</p>
    </div>
  )
}

/** Live, server-backed order pipeline — every order for the shop, newest first. */
function ServerOrders() {
  const [orders, setOrders] = useState<ServerOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null)

  /** A no-login order-status link for the buyer — hand it to them once the
   *  piece is in production so they can check progress without emailing. */
  const copyTrackLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(orderTrackUrl(id))
      setCopiedTrackId(id); setTimeout(() => setCopiedTrackId(cur => (cur === id ? null : cur)), 2500)
    } catch { /* clipboard blocked */ }
  }

  const refresh = async () => {
    setLoading(true)
    try { setOrders(await api.listOrders()); setError(null) }
    catch { setError('Couldn’t reach the server — it may be waking up.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh(); api.listCustomers().then(setCustomers).catch(() => {}) }, [])

  /** Attach (or clear) a customer on an order, reflecting it locally. */
  const assign = async (o: ServerOrder, cid: string) => {
    try {
      await api.setOrderCustomer(o.id, cid || null)
      setOrders(list => list.map(x => x.id === o.id ? { ...x, customer_id: cid || null, customer_name: customers.find(c => c.id === cid)?.name ?? null } : x))
    } catch { setError('Couldn’t set the client — try again.') }
  }

  /** Move one order to a stage on the server, then reflect it locally. */
  const move = async (o: ServerOrder, index: number) => {
    const key = stageKey(index)
    setBusyId(o.id)
    try {
      await api.advanceOrder(o.id, key)
      setOrders(list => list.map(x => x.id === o.id ? { ...x, stage: key } : x))
    } catch { setError('Couldn’t update that order — try again.') }
    finally { setBusyId(null) }
  }

  return (
    <div className="panel-block">
      <h4>Orders <span className="mfg-sum"><b>{orders.length}</b></span>
        <button className="mini" style={{ marginLeft: 'auto' }} onClick={() => void refresh()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </h4>
      {error && <p className="disc" style={{ color: '#D98A5F' }}>{error}</p>}
      {!error && orders.length === 0 && (
        <p className="disc">{loading ? 'Loading…' : 'No orders yet. Approve a design, or send a sculpted piece to order.'}</p>
      )}
      {orders.map(o => {
        const idx = stageIndex(o.stage)
        return (
          <div key={o.id} className="order-card">
            <div className="order-head">
              <b>{o.design_name ?? 'Untitled'}</b>
              <span className="attr-kind">{o.is_sculpt ? 'sculpt' : 'design'}</span>
              <span className="order-stage">{stageLabel(o.stage)}</span>
              <button className="mini" onClick={() => void copyTrackLink(o.id)} title="Copy a no-login link the buyer can use to check their order status">
                {copiedTrackId === o.id ? 'Copied ✓' : 'Copy tracking link'}
              </button>
            </div>
            {customers.length > 0 && (
              <label className="order-client">
                <span>Client</span>
                <select value={o.customer_id ?? ''} onChange={e => void assign(o, e.target.value)}>
                  <option value="">— none —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            <div className="pipeline" style={{ marginTop: 8 }}>
              {ORDER_STAGES.map((s, i) => (
                <button key={s.key} disabled={busyId === o.id}
                  className={`stage ${i < idx ? 'done' : i === idx ? 'now' : ''}`}
                  title={`Set stage: ${s.label}`} onClick={() => void move(o, i)}>
                  <span className="dot" /><span className="lbl">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      <p className="disc">Every order for the shop, live from the server. Click a stage to move a piece through the pipeline — parametric and sculpted alike.</p>
    </div>
  )
}
