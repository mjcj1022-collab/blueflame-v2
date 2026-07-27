import { useEffect, useState } from 'react'
import { api, apiConfigured, type CloudSculpt } from '../lib/api'
import { useAuth } from '../state/auth'
import { useModeler, type SculptObject } from '../state/modeler'
import { sculptLibrary } from '../lib/sculptLibrary'

/**
 * Cloud maker library. Saved sculpts live in the browser by default; signed into
 * a shop, this syncs them to the server so the whole team sees the same library
 * across devices. Explicit push (upload the local library, skipping names already
 * in the cloud) + load/delete on the cloud copies. Only shown on a backend when
 * signed in.
 */
export function CloudLibrary() {
  const user = useAuth(s => s.user)
  const load = useModeler(s => s.load)
  const [list, setList] = useState<CloudSculpt[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = async () => {
    try { setList(await api.listSculpts()); setMsg(null) }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Couldn’t reach the cloud library.') }
  }
  useEffect(() => { if (apiConfigured() && user) void refresh() }, [user])

  if (!apiConfigured() || !user) return null

  const pushLocal = async () => {
    setBusy(true)
    try {
      const cloudNames = new Set(list.map(c => c.name))
      const local = sculptLibrary.list()
      let pushed = 0
      for (const s of local) {
        if (cloudNames.has(s.name)) continue                 // already synced by name
        await api.saveSculpt(s.name, s.tags ?? [], s.objects)
        pushed++
      }
      await refresh()
      setMsg(pushed ? `Pushed ${pushed} sculpt${pushed === 1 ? '' : 's'} to the cloud.` : 'Local library already synced.')
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Push failed.') }
    finally { setBusy(false) }
  }
  const loadCloud = async (id: string) => {
    try { const r = await api.getSculpt(id); load(r.data as SculptObject[]) }
    catch { setMsg('Couldn’t load that piece.') }
  }
  const del = async (id: string) => {
    try { await api.deleteSculpt(id); await refresh() } catch { setMsg('Couldn’t delete.') }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="row">
        <label>Cloud library <small style={{ color: 'var(--slate)' }}>(syncs across devices)</small></label>
        <button className="mini" style={{ marginLeft: 'auto' }} disabled={busy} onClick={pushLocal}>☁ Push local</button>
      </div>
      {msg && <p className="disc">{msg}</p>}
      {list.length === 0 && <p className="disc">No cloud sculpts yet — push your local library to sync it to the shop.</p>}
      {list.map(c => (
        <div key={c.id} className="lib-row obj-row">
          <div className="lib-meta"><b>{c.name}</b><small>{c.tags ? c.tags : 'cloud'} · {new Date(c.updated_at).toLocaleDateString()}</small></div>
          <div className="lib-acts">
            <button className="mini" onClick={() => loadCloud(c.id)}>Load</button>
            <button className="mini danger" onClick={() => del(c.id)}>×</button>
          </div>
        </div>
      ))}
    </div>
  )
}
