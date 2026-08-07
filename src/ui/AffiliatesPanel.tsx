import { useEffect, useState } from 'react'
import { api, apiConfigured, type Affiliate } from '../lib/api'
import { useAuth } from '../state/auth'

/**
 * Affiliate program — admin console for the referral system. Create a unique
 * link per person, set (and change) each one's commission rate, copy the link to
 * hand out, and watch signups and earnings roll in. Commissions are tracked
 * automatically when a referred customer pays. Admin + backend only.
 */
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`
const linkFor = (code: string) => `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(code)}`

export function AffiliatesPanel() {
  const role = useAuth(s => s.role)
  const [list, setList] = useState<Affiliate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [rateEdit, setRateEdit] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ name: '', email: '', ratePct: '20' })

  const refresh = async () => {
    try { setList(await api.listAffiliates()); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t load affiliates.') }
  }
  useEffect(() => { if (apiConfigured() && role === 'admin') void refresh() }, [role])

  if (!apiConfigured() || role !== 'admin') return null

  const create = async () => {
    if (busy) return
    setBusy(true)
    try {
      await api.createAffiliate({ name: form.name.trim() || undefined, email: form.email.trim() || undefined, ratePct: Number(form.ratePct) || 20 })
      setForm({ name: '', email: '', ratePct: '20' }); await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t create the link.') }
    finally { setBusy(false) }
  }
  const saveRate = async (id: string) => {
    const pct = Number(rateEdit[id])
    if (!Number.isFinite(pct)) return
    try { await api.updateAffiliate(id, { ratePct: pct }); setRateEdit(s => { const n = { ...s }; delete n[id]; return n }); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t update the rate.') }
  }
  const deactivate = async (id: string) => {
    try { await api.deactivateAffiliate(id); await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t deactivate.') }
  }
  const copy = (code: string) => {
    navigator.clipboard?.writeText(linkFor(code)).then(() => { setCopied(code); setTimeout(() => setCopied(null), 1500) }, () => {})
  }

  return (
    <div className="panel-block">
      <h4 style={{ margin: 0 }}>Affiliate program</h4>
      {error && <p className="disc" style={{ color: 'var(--warn)' }}>{error}</p>}

      {list.length === 0 && <p className="disc">No affiliate links yet. Create one below and share it — each signup and sale on that link is credited automatically.</p>}

      {list.map(af => (
        <div key={af.id} className={`aff-row${af.active ? '' : ' aff-off'}`}>
          <div className="aff-head">
            <b>{af.name || af.code}</b>
            <span className="aff-earn">{dollars(af.earned_cents)} earned · {dollars(af.pending_cents)} pending</span>
          </div>
          <div className="aff-link">
            <input readOnly value={linkFor(af.code)} onFocus={e => e.currentTarget.select()} />
            <button className="mini" onClick={() => copy(af.code)}>{copied === af.code ? 'Copied' : 'Copy'}</button>
          </div>
          <div className="aff-meta">
            <label className="aff-rate">Rate
              <input type="number" min="0" max="100" step="1"
                value={rateEdit[af.id] ?? String(Math.round(af.rate * 100))}
                onChange={e => setRateEdit(s => ({ ...s, [af.id]: e.target.value }))} /> %
              {rateEdit[af.id] !== undefined && rateEdit[af.id] !== String(Math.round(af.rate * 100)) &&
                <button className="mini" onClick={() => saveRate(af.id)}>Save</button>}
            </label>
            <span className="aff-stats">{af.referrals} signup{af.referrals === 1 ? '' : 's'} · {af.conversions} sale{af.conversions === 1 ? '' : 's'}</span>
            {af.active ? <button className="mini danger" onClick={() => deactivate(af.id)} title="Stop crediting this link">Off</button> : <span className="aff-inactive">inactive</span>}
          </div>
        </div>
      ))}

      <div className="row" style={{ marginTop: 12, gap: 4 }}>
        <input className="lib-name" style={{ flex: 1 }} placeholder="Affiliate name (e.g. Jane)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <label className="aff-rate">Rate <input type="number" min="0" max="100" style={{ width: 52 }} value={form.ratePct} onChange={e => setForm(f => ({ ...f, ratePct: e.target.value }))} /> %</label>
      </div>
      <div className="row" style={{ marginTop: 4, gap: 4 }}>
        <input className="lib-name" style={{ flex: 1 }} placeholder="their email (optional)" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <button className="primary" onClick={create} disabled={busy}>Create link</button>
      </div>
      <p className="disc">Each link is unique to one person. Set any commission rate per link and change it any time — new sales use the current rate. Referrals are credited when a customer signs up on the link and pays; recurring subscriptions credit every month.</p>
    </div>
  )
}
