import type { SculptObject } from '../state/modeler'
import { stoneById } from '../catalog'
import { mmForCarat } from './stoneSize'

/**
 * Gemstone inventory — the parcels of stones a shop already has on hand, and a
 * match against what a design needs. A maker shouldn't buy a stone they own; this
 * tracks stock by type + shape + millimetre size (the way stones are parcelled)
 * and tells them, per design, how many they have versus have to order. localStorage.
 */

export interface GemStock {
  id: string
  stoneId: string
  shapeId: string
  mm: number
  qty: number
}

const KEY = 'mandrel.geminv.v1'

function readAll(): GemStock[] {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) as GemStock[] : [] } catch { return [] }
}
function writeAll(list: GemStock[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* quota / private mode */ }
}
function uid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return c?.randomUUID ? c.randomUUID() : 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

export const gemInventory = {
  list: (): GemStock[] => readAll(),
  add: (s: Omit<GemStock, 'id'>): GemStock => {
    const list = readAll()
    // merge into an existing matching parcel (same stone/shape/mm within 0.05 mm)
    const hit = list.find(x => x.stoneId === s.stoneId && x.shapeId === s.shapeId && Math.abs(x.mm - s.mm) < 0.05)
    if (hit) { hit.qty += s.qty; writeAll(list); return hit }
    const rec = { ...s, id: uid() }
    writeAll([...list, rec]); return rec
  },
  remove: (id: string): void => writeAll(readAll().filter(x => x.id !== id)),
  clear: (): void => writeAll([]),
}

export interface MatchRow { stone: string; shapeId: string; mm: number; need: number; have: number; toBuy: number }

/** How many of each size the design needs, and how many are on hand. */
export function matchDesign(objects: SculptObject[], stock: GemStock[]): MatchRow[] {
  const need = new Map<string, { stoneId: string; shapeId: string; mm: number; need: number }>()
  for (const o of objects) {
    if (o.kind !== 'gem') continue
    const stoneId = o.params?.stoneTypeId ?? 'dia'
    const shapeId = o.params?.shapeId ?? 'rd'
    const mm = Math.round(mmForCarat(shapeId, stoneId, o.params?.carat ?? 0).width * 20) / 20
    const key = `${stoneId}:${shapeId}:${mm}`
    const cur = need.get(key) ?? { stoneId, shapeId, mm, need: 0 }
    cur.need++; need.set(key, cur)
  }
  return [...need.values()].map(n => {
    const have = stock.filter(s => s.stoneId === n.stoneId && s.shapeId === n.shapeId && Math.abs(s.mm - n.mm) < 0.06).reduce((a, s) => a + s.qty, 0)
    return { stone: stoneById(n.stoneId).name, shapeId: n.shapeId, mm: n.mm, need: n.need, have, toBuy: Math.max(0, n.need - have) }
  }).sort((a, b) => b.toBuy - a.toBuy)
}
