import { api, apiConfigured, type ServerGalleryItem } from './api'
import type { DesignSpec } from '../spec/types'

/** One curated showcase piece. `spec`, when present, lets a viewer open the
 *  exact design in the editor. */
export interface GalleryItem {
  id: string
  title: string
  subtitle: string | null
  image: string            // data URL thumbnail
  spec: DesignSpec | null
  created_at: string
}

export interface NewGalleryItem {
  title: string
  subtitle?: string
  image: string
  spec?: DesignSpec | null
}

const LKEY = 'mandrel.gallery'

function parseServer(row: ServerGalleryItem): GalleryItem {
  let spec: DesignSpec | null = null
  if (row.spec) { try { spec = JSON.parse(row.spec) as DesignSpec } catch { spec = null } }
  return { id: row.id, title: row.title, subtitle: row.subtitle, image: row.image, spec, created_at: row.created_at }
}

function readLocal(): GalleryItem[] {
  try { return JSON.parse(localStorage.getItem(LKEY) || '[]') as GalleryItem[] } catch { return [] }
}
function writeLocal(items: GalleryItem[]) {
  try { localStorage.setItem(LKEY, JSON.stringify(items)) } catch { /* quota / private mode */ }
}

/**
 * The curated gallery store. Backed by the server (shared across the shop, only
 * admins may write) when a backend is configured; otherwise a per-browser
 * localStorage copy so the feature still works in the standalone demo.
 */
export const gallery = {
  backed: (): boolean => apiConfigured(),

  async list(): Promise<GalleryItem[]> {
    if (apiConfigured()) {
      const rows = await api.listGallery()
      return rows.map(parseServer)
    }
    // Local copy is kept newest-first by prepending on add (stable across equal timestamps).
    return readLocal()
  },

  async add(item: NewGalleryItem): Promise<GalleryItem> {
    if (apiConfigured()) {
      const { id } = await api.addGallery({ title: item.title, subtitle: item.subtitle, image: item.image, spec: item.spec ?? undefined })
      return { id, title: item.title, subtitle: item.subtitle ?? null, image: item.image, spec: item.spec ?? null, created_at: new Date().toISOString() }
    }
    const entry: GalleryItem = {
      id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
      title: item.title, subtitle: item.subtitle ?? null, image: item.image, spec: item.spec ?? null,
      created_at: new Date().toISOString()
    }
    writeLocal([entry, ...readLocal()])
    return entry
  },

  async remove(id: string): Promise<void> {
    if (apiConfigured()) { await api.deleteGallery(id); return }
    writeLocal(readLocal().filter(i => i.id !== id))
  }
}
