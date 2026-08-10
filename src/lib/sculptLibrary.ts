import type { SculptObject } from '../state/modeler'

/** Named, multi-slot saves for the Sculpt workspace (localStorage). */
export interface SavedSculpt {
  id: string
  name: string
  at: number
  objects: SculptObject[]
  tags?: string[]
}

/** Split a free-text tag string into clean, lowercased tags. */
export const parseTags = (s: string): string[] =>
  Array.from(new Set(s.split(/[,\n]/).map(t => t.trim().toLowerCase()).filter(Boolean)))

const KEY = 'mandrel.sculpts.v1'

function readAll(): SavedSculpt[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SavedSculpt[]) : []
  } catch { return [] }
}

function writeAll(list: SavedSculpt[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* quota / private mode */ }
}

function uid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return c?.randomUUID ? c.randomUUID() : 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

/** Filter a saved list by a free-text query (name or tag) and an optional tag. */
export function searchSculpts(list: SavedSculpt[], query = '', tag = ''): SavedSculpt[] {
  const q = query.trim().toLowerCase()
  const t = tag.trim().toLowerCase()
  return list.filter(s => {
    const tags = s.tags ?? []
    if (t && !tags.includes(t)) return false
    if (!q) return true
    return s.name.toLowerCase().includes(q) || tags.some(x => x.includes(q))
  })
}

/** Every tag in use, sorted, for a filter chip row. */
export function allTags(list: SavedSculpt[]): string[] {
  return Array.from(new Set(list.flatMap(s => s.tags ?? []))).sort()
}

export const sculptLibrary = {
  list: (): SavedSculpt[] => readAll().sort((a, b) => b.at - a.at),
  save: (name: string, objects: SculptObject[], tags?: string[]): SavedSculpt => {
    const rec: SavedSculpt = { id: uid(), name, at: Date.now(), objects, tags }
    writeAll([...readAll(), rec])
    return rec
  },
  remove: (id: string): void => writeAll(readAll().filter(s => s.id !== id)),
  get: (id: string): SavedSculpt | null => readAll().find(s => s.id === id) ?? null
}
