import type { DesignSpec } from '../spec/types'
import type { SculptObject } from '../state/modeler'

/**
 * Local persistence so nothing is lost on refresh:
 *  - autosave: the live Design spec and Sculpt objects, written (debounced) on
 *    every change and restored on load.
 *  - projects: named snapshots that bundle a design AND a sculpt together.
 */

const D_KEY = 'mandrel.autosave.design'
const S_KEY = 'mandrel.autosave.sculpt'
const P_KEY = 'mandrel.projects.v1'

function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined
  return (...a: A) => { if (t) clearTimeout(t); t = setTimeout(() => fn(...a), ms) }
}

const read = <T>(key: string): T | null => {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : null } catch { return null }
}
const write = (key: string, val: unknown): void => {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* quota / private mode */ }
}

export const autosave = {
  writeDesign: debounce((spec: DesignSpec) => write(D_KEY, spec), 400),
  readDesign: (): DesignSpec | null => read<DesignSpec>(D_KEY),
  writeSculpt: debounce((objs: SculptObject[]) => write(S_KEY, objs), 400),
  readSculpt: (): SculptObject[] | null => read<SculptObject[]>(S_KEY)
}

export interface Project {
  id: string
  name: string
  at: number
  spec: DesignSpec
  sculpt: SculptObject[]
}

function uid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return c?.randomUUID ? c.randomUUID() : 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

export const projects = {
  list: (): Project[] => (read<Project[]>(P_KEY) ?? []).sort((a, b) => b.at - a.at),
  save: (name: string, spec: DesignSpec, sculpt: SculptObject[]): Project => {
    const rec: Project = { id: uid(), name, at: Date.now(), spec, sculpt }
    write(P_KEY, [...(read<Project[]>(P_KEY) ?? []), rec])
    return rec
  },
  get: (id: string): Project | null => (read<Project[]>(P_KEY) ?? []).find(p => p.id === id) ?? null,
  remove: (id: string): void => write(P_KEY, (read<Project[]>(P_KEY) ?? []).filter(p => p.id !== id))
}
