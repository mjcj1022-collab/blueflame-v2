import { useEffect, useState } from 'react'
import { api, apiConfigured, type TeamMember } from '../lib/api'
import { useAuth } from '../state/auth'

/**
 * Team & roles — a shop owner (admin) invites bench and setter accounts into the
 * same shop, changes their roles, or removes them. Server-backed and tenant-
 * scoped; only shown to an admin on a configured backend. The server enforces the
 * real guardrails (last-admin protection, uniqueness); this is the console for it.
 */

const ROLES = ['admin', 'bench', 'setter', 'associate'] as const
const ROLE_LABEL: Record<string, string> = { admin: 'Owner / admin', bench: 'Bench', setter: 'Setter', associate: 'Associate' }

export function TeamPanel() {
  const role = useAuth(s => s.role)
  const [list, setList] = useState<TeamMember[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', role: 'bench' })

  const refresh = async () => {
    try { setList(await api.listTeam()); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t load the team.') }
  }
  useEffect(() => { if (apiConfigured() && role === 'admin') void refresh() }, [role])

  // Only an admin on a real backend manages the team.
  if (!apiConfigured() || role !== 'admin') return null

  const add = async () => {
    if (!form.email.trim() || form.password.length < 6 || busy) return
    setBusy(true)
    try { await api.addTeam(form.email.trim(), form.password, form.role); setForm({ email: '', password: '', role: 'bench' }); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t add that member.') }
    finally { setBusy(false) }
  }
  const changeRole = async (id: string, r: string) => {
    try { await api.setTeamRole(id, r); await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t change role.') }
  }
  const remove = async (id: string) => {
    try { await api.removeTeam(id); await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t remove.') }
  }

  return (
    <div className="panel-block">
      <h4 style={{ margin: 0 }}>Team &amp; roles</h4>
      {error && <p className="disc" style={{ color: 'var(--warn)' }}>{error}</p>}
      {list.map(m => (
        <div key={m.id} className="attr-row">
          <span>{m.email}</span>
          <span className="attr-acts">
            <select className="lib-name" style={{ width: 110 }} value={m.role} onChange={e => changeRole(m.id, e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <button onClick={() => remove(m.id)} title="Remove from the shop">×</button>
          </span>
        </div>
      ))}
      <div className="row" style={{ marginTop: 10, gap: 4 }}>
        <input className="lib-name" style={{ flex: 1 }} placeholder="new member email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </div>
      <div className="row" style={{ marginTop: 4, gap: 4 }}>
        <input className="lib-name" style={{ flex: 1 }} type="password" placeholder="temp password (6+)" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        <select className="lib-name" style={{ width: 100 }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <button className="primary" onClick={add} disabled={busy || !form.email.trim() || form.password.length < 6}>Add</button>
      </div>
      <p className="disc">Invite bench &amp; setter accounts into your shop. They sign in with these credentials and see the same designs and orders. The last admin can’t be removed or demoted.</p>
    </div>
  )
}
