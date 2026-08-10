import type { SculptObject } from '../state/modeler'
import { browserKV, type KV } from './library'

/** A saved, reusable jewelry component — one part (a shank, head, halo) or a
 *  small assembly — that can be dropped into any sculpt. */
export interface SavedComponent {
  id: string
  name: string
  at: number
  objects: SculptObject[]
}

const KEY = 'mandrel.parts.v1'

function defaultId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return c?.randomUUID ? c.randomUUID() : 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

/** Component library over an injected KV + clock + id generator, so it unit-tests
 *  without a DOM; the app wires it to localStorage. */
export function makeComponentLibrary(kv: KV = browserKV, clock: () => number = () => Date.now(), idGen: () => string = defaultId) {
  const read = (): SavedComponent[] => {
    try { const raw = kv.get(KEY); return raw ? (JSON.parse(raw) as SavedComponent[]) : [] } catch { return [] }
  }
  const write = (list: SavedComponent[]): void => kv.set(KEY, JSON.stringify(list))
  return {
    list: (): SavedComponent[] => read().sort((a, b) => b.at - a.at),
    save: (name: string, objects: SculptObject[]): SavedComponent => {
      const rec: SavedComponent = { id: idGen(), name: name.trim() || 'Part', at: clock(), objects }
      write([...read(), rec])
      return rec
    },
    remove: (id: string): void => write(read().filter(c => c.id !== id)),
    get: (id: string): SavedComponent | null => read().find(c => c.id === id) ?? null,
  }
}

export const componentLibrary = makeComponentLibrary()
