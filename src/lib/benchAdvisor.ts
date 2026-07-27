import type { SculptObject } from '../state/modeler'
import { alloyById, stoneById } from '../catalog'
import { printReadiness } from './printReady'
import { mmForCarat } from './stoneSize'
import { sculptMetalVolume } from './sculpt'
import { api } from './api'

/**
 * AI bench advisor. Answers the questions a jeweler actually asks at the bench —
 * "what bur for this stone?", "will this cast?", "are these prongs enough?",
 * "how heavy is it?" — grounded in the SAME manufacturing checks the app runs
 * (print readiness, per-alloy wall minimums, calibrated stone sizes). The facts
 * are computed here and handed to the model as context, so the AI can't invent
 * numbers; if the AI is off, a deterministic answer from those facts still
 * responds. Never confident junk — always tied to the real geometry.
 */

export interface StoneFact { mm: number; carat: number; stone: string; bur: number }
export interface BenchFacts {
  verdict: 'pass' | 'warn' | 'fail'
  minWall: number
  minWallLimit: number
  watertight: boolean
  castGrams: number
  alloyName: string
  stones: StoneFact[]
  heads: { prongs: number; stoneMm: number }[]
}

/** Recommended setting/bearing bur size for a stone of this face-up diameter. A
 *  seat is cut roughly to the girdle; burs step in 0.1 mm. */
export function burForStoneMm(mm: number): number {
  return Math.max(0.8, Math.round(mm * 10) / 10)
}

export function benchFacts(objects: SculptObject[], alloyId: string): BenchFacts {
  const pr = printReadiness(objects, alloyId)
  const alloy = alloyById(alloyId)
  const castGrams = (sculptMetalVolume(objects) / 1000) * alloy.density
  const stones: StoneFact[] = objects.filter(o => o.kind === 'gem').map(o => {
    const shapeId = o.params?.shapeId ?? 'rd'
    const stoneId = o.params?.stoneTypeId ?? 'dia'
    const carat = o.params?.carat ?? 0
    const mm = mmForCarat(shapeId, stoneId, carat).width
    return { mm, carat, stone: stoneById(stoneId).name, bur: burForStoneMm(mm) }
  })
  const heads = objects.filter(o => o.kind === 'head').map(o => ({ prongs: o.params?.prongs ?? 4, stoneMm: o.params?.stoneW ?? 0 }))
  return {
    verdict: pr.verdict, minWall: pr.minWall, minWallLimit: pr.minWallLimit, watertight: pr.watertight,
    castGrams, alloyName: alloy.name, stones, heads,
  }
}

/** Compact grounded fact sheet handed to the model so answers stay tied to reality. */
export function benchFactSheet(f: BenchFacts): string {
  const lines = [
    `Metal: ${f.alloyName}, cast weight ${f.castGrams.toFixed(2)} g.`,
    `Print/cast check: ${f.verdict.toUpperCase()}. Thinnest wall ${f.minWall === Infinity ? 'n/a' : f.minWall.toFixed(2) + ' mm'} vs ${f.minWallLimit.toFixed(2)} mm minimum for this metal. ${f.watertight ? 'Watertight.' : 'Has open edges (holes).'}`,
  ]
  if (f.stones.length) {
    lines.push('Stones: ' + f.stones.map(s => `${s.mm.toFixed(2)} mm ${s.stone} (${s.carat.toFixed(2)} ct) → ${s.bur.toFixed(1)} mm setting bur`).join('; ') + '.')
  }
  if (f.heads.length) lines.push('Heads: ' + f.heads.map(h => `${h.prongs}-prong`).join(', ') + '.')
  return lines.join('\n')
}

/** Deterministic grounded answer — the offline fallback and the source of truth
 *  the AI is told not to contradict. Routes on the intent of the question. */
export function localBenchAnswer(question: string, f: BenchFacts): string {
  const q = question.toLowerCase()
  const out: string[] = []

  const wantsBur = /\bbur|seat|bearing|set\b|setting/.test(q)
  const wantsCast = /\bcast|castable|print|pour|porous|watertight|manifold\b/.test(q)
  const wantsProng = /\bprong|claw|hold|secure|durab/.test(q)
  const wantsWeight = /\bweight|heavy|grams|gram|light\b/.test(q)
  const wantsWall = /\bwall|thin|thick|gauge|strong\b/.test(q)

  if (wantsBur || (!wantsCast && !wantsProng && !wantsWeight && !wantsWall && f.stones.length)) {
    if (!f.stones.length) out.push('No stones placed yet — add one, then I can size the setting bur.')
    else for (const s of f.stones) out.push(`Set the ${s.mm.toFixed(2)} mm ${s.stone} (${s.carat.toFixed(2)} ct) with a ~${s.bur.toFixed(1)} mm setting bur; cut the bearing to about ${(s.mm * 0.4).toFixed(2)} mm deep so the girdle seats and the culet clears.`)
  }
  if (wantsCast) {
    out.push(f.verdict === 'fail'
      ? `Not ready to cast: ${!f.watertight ? 'the shell has open edges — run “Fix for print”. ' : ''}${f.minWall < f.minWallLimit ? `thinnest wall ${f.minWall.toFixed(2)} mm is under the ${f.minWallLimit.toFixed(2)} mm minimum for ${f.alloyName} and will cast porous.` : ''}`
      : f.verdict === 'warn'
        ? `Castable, with care — thinnest wall ${f.minWall.toFixed(2)} mm clears the ${f.minWallLimit.toFixed(2)} mm minimum but leaves little margin.`
        : `Yes — watertight and the thinnest wall ${f.minWall.toFixed(2)} mm clears the ${f.minWallLimit.toFixed(2)} mm minimum for ${f.alloyName}.`)
  }
  if (wantsProng) {
    if (!f.heads.length) out.push('No prong head on the bench — add one and I can check it against the stone.')
    else for (const h of f.heads) out.push(h.prongs < 6
      ? `A ${h.prongs}-prong head holds a modest stone, but for a larger or active-wear stone step up to 6 prongs (or double-claw) for security.`
      : `${h.prongs} prongs give a secure hold; keep each tip full and even so none is doing all the work.`)
  }
  if (wantsWeight) out.push(`Cast weight is about ${f.castGrams.toFixed(2)} g in ${f.alloyName}.${f.castGrams > 12 ? ' That’s substantial for daily wear — consider hollowing or trimming the gallery to lighten it.' : ''}`)
  if (wantsWall) out.push(f.minWall === Infinity
    ? 'Add a metal part and I can measure the wall thickness.'
    : `Thinnest wall is ${f.minWall.toFixed(2)} mm; the minimum for ${f.alloyName} is ${f.minWallLimit.toFixed(2)} mm. ${f.minWall < f.minWallLimit ? 'Thicken it before casting.' : 'You have margin.'}`)

  if (!out.length) out.push('Ask me about setting burs, whether it will cast, prong security, weight, or wall thickness — I answer from this piece’s actual geometry.')
  return out.join(' ')
}

const SYSTEM = `You are a master bench jeweler advising a maker at the bench. Answer briefly and practically (setting burs and gauges, castability, prong security, finishing, weight). You are given a FACTS block measured from the actual model — treat those numbers as ground truth and NEVER contradict or invent numbers. If a fact isn't given, say what to measure. No fluff.`

/** Ask the bench advisor. Sends the grounded fact sheet + question to the model;
 *  falls back to the deterministic answer if the AI is off or errors. */
export async function askBenchAdvisor(question: string, objects: SculptObject[], alloyId: string): Promise<{ text: string; grounded: string; ai: boolean }> {
  const f = benchFacts(objects, alloyId)
  const sheet = benchFactSheet(f)
  const local = localBenchAnswer(question, f)
  try {
    const res = await api.assistant({
      system: SYSTEM,
      messages: [{ role: 'user', content: `FACTS (measured from the model):\n${sheet}\n\nQuestion: ${question}` }],
      image: null,
    }) as { text?: string; disabled?: boolean }
    if (res.disabled || !res.text) return { text: local, grounded: sheet, ai: false }
    return { text: res.text, grounded: sheet, ai: true }
  } catch {
    return { text: local, grounded: sheet, ai: false }
  }
}
