import { ALLOYS, SHAPES, STONES, SETTINGS, FINISHES } from '../catalog'
import { NO_STONE, type ProductCategory, type FinishId, type NecklaceMotif, type NecklaceStyle, type BandProfile, type BraceletKind, type BodyStyle } from '../spec/types'
import { NECKLACE_STYLES } from './necklaceChain'
import { BODY_STYLES } from './body'
import { MOTIFS, MOTIF_IDS } from './motif'
import { api } from './api'
import { useDesign } from '../state/design'

/**
 * The client half of the AI design assistant. The model is asked to reply in
 * strict JSON — a friendly message plus an optional `design` patch of real
 * catalog ids — which we validate here (a hallucinated id is simply dropped) and
 * apply to the live design. The server holds the key; this only shapes the
 * prompt, parses the reply, and drives the store. Photo/sketch → design is the
 * same path with an image attached.
 */

const CATEGORIES: ProductCategory[] = ['ring', 'pendant', 'earring', 'bracelet', 'necklace', 'body']

export interface AiDesignPatch {
  category?: ProductCategory
  alloyId?: string
  shapeId?: string
  stoneTypeId?: string
  carat?: number
  settingId?: string
  size?: number
  finish?: FinishId
  motif?: NecklaceMotif   // 'celtic' → an interlaced knot medallion on a necklace
  // Dimensional / per-category controls so the AI drives the real geometry:
  bandWidth?: number         // ring band width, mm
  bandProfile?: BandProfile  // ring cross-section
  chainStyle?: NecklaceStyle // necklace link pattern
  necklaceLength?: number    // necklace length, inches
  braceletKind?: BraceletKind
  dropLength?: number        // earring drop, mm (0 = stud)
  bodyStyle?: BodyStyle
  bodyGauge?: number         // body jewelry wire gauge, mm
  bodySize?: number          // body jewelry length / diameter, mm
}
export interface AiReply { reply: string; design: AiDesignPatch | null; matched: string[] }
export interface ChatTurn { role: 'user' | 'assistant'; content: string }

const list = (rows: { id: string; name: string }[]) => rows.map(r => `${r.id} (${r.name})`).join(', ')

/** The system prompt — teaches the model the exact catalog ids it may use and
 *  the strict JSON envelope we parse. Built from the live catalog. */
export function buildSystemPrompt(): string {
  return [
    'You are the design assistant for Blue Flame, a fine-jewelry CAD app.',
    'Help the user design a piece. When they describe (or show a photo/sketch of) a piece, translate it into the app\'s parametric design.',
    'ALWAYS reply with a single JSON object and nothing else, in this exact shape:',
    '{ "reply": "<one or two friendly sentences>", "design": { ...fields... } | null }',
    'Include only the design fields you are changing. Use ONLY these ids:',
    `category: ${CATEGORIES.join(', ')}`,
    `alloyId: ${list(ALLOYS)}`,
    `shapeId (stone cut): ${list(SHAPES)}`,
    `stoneTypeId: ${list(STONES)}, or "${NO_STONE}" for no center stone`,
    `settingId: ${list(SETTINGS)}`,
    `finish: ${list(FINISHES)}`,
    'carat: number 0.05–20. size: US ring size 2–16.',
    `motif (a medallion on a necklace): ${MOTIFS.map(([id, name]) => `${id} (${name})`).join(', ')}, or "none". Set category to "necklace" and pick the motif whenever the request names one — e.g. Celtic/knotwork/triquetra→celtic, cross/crucifix→cross, infinity/eternity→infinity, heart→heart, halo→halo, cluster→cluster, flower/floral→floral.`,
    '--- Dimensional fields — set these to shape the real geometry, not just the category: ---',
    'RING: bandWidth (mm, 1–12, e.g. a wide band is 6–8), bandProfile (round, flat, dshape, knife).',
    `NECKLACE: chainStyle (${NECKLACE_STYLES.map(([id]) => id).join(', ')}), necklaceLength (inches, 14–30; 16=choker, 18=princess, 24=opera).`,
    'BRACELET: braceletKind (tennis, bangle, cuff, chain).',
    'EARRING: dropLength (mm, 0 for a stud, >0 for a drop/dangle).',
    `BODY (barbells, rings, plugs): bodyStyle (${BODY_STYLES.map(([id]) => id).join(', ')}), bodyGauge (mm, 0.8–3.2; 1.6=14g, 1.2=16g), bodySize (mm; barbell length or ring/plug diameter). Set category to "body".`,
    'Always translate descriptive words into these fields — "wide hammered band" → bandProfile+bandWidth+finish; "16g gold septum" → category body, bodyStyle septum, bodyGauge 1.2; "20-inch rope chain" → chainStyle rope, necklaceLength 20.',
    'If the request is a question or chit-chat, set "design" to null and just answer in "reply".'
  ].join('\n')
}

/** Pull the JSON envelope out of a model reply that may be fenced or chatty. */
export function parseAiReply(text: string): AiReply {
  const raw = extractJson(text)
  if (!raw) return { reply: text.trim() || 'Done.', design: null, matched: [] }
  let obj: { reply?: unknown; design?: unknown }
  try { obj = JSON.parse(raw) } catch { return { reply: text.trim(), design: null, matched: [] } }
  const design = normalizeAiDesign(obj.design)
  return {
    reply: typeof obj.reply === 'string' && obj.reply.trim() ? obj.reply.trim() : (design ? 'Updated the design.' : 'Done.'),
    design,
    matched: describe(design)
  }
}

function extractJson(text: string): string | null {
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const src = fence ? fence[1] : text
  const start = src.indexOf('{')
  if (start < 0) return null
  // Balance braces, but ignore any that live inside a string literal (a reply
  // like "use a } shape" must not close the object early). Tracks escapes too.
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(start, i + 1) }
  }
  return null
}

const ALLOY_IDS = new Set(ALLOYS.map(a => a.id))
const SHAPE_IDS = new Set(SHAPES.map(s => s.id))
const STONE_IDS = new Set<string>([...STONES.map(s => s.id), NO_STONE])
const SETTING_IDS = new Set(SETTINGS.map(s => s.id))
const FINISH_IDS = new Set<string>(FINISHES.map(f => f.id))
const BAND_PROFILES = new Set<string>(['round', 'flat', 'dshape', 'knife'])
const NECKLACE_STYLE_IDS = new Set<string>(NECKLACE_STYLES.map(([id]) => id))
const BRACELET_KINDS = new Set<string>(['tennis', 'bangle', 'cuff', 'chain'])
const BODY_STYLE_IDS = new Set<string>(BODY_STYLES.map(([id]) => id))
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Keep only fields that reference real catalog ids / sane numbers. */
export function normalizeAiDesign(raw: unknown): AiDesignPatch | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const out: AiDesignPatch = {}
  if (typeof r.category === 'string' && (CATEGORIES as string[]).includes(r.category)) out.category = r.category as ProductCategory
  if (typeof r.alloyId === 'string' && ALLOY_IDS.has(r.alloyId)) out.alloyId = r.alloyId
  if (typeof r.shapeId === 'string' && SHAPE_IDS.has(r.shapeId)) out.shapeId = r.shapeId
  if (typeof r.stoneTypeId === 'string' && STONE_IDS.has(r.stoneTypeId)) out.stoneTypeId = r.stoneTypeId
  if (typeof r.settingId === 'string' && SETTING_IDS.has(r.settingId)) out.settingId = r.settingId
  if (typeof r.finish === 'string' && FINISH_IDS.has(r.finish)) out.finish = r.finish as FinishId
  if (num(r.carat)) out.carat = clamp(r.carat, 0.05, 20)
  if (num(r.size)) out.size = clamp(r.size, 2, 16)
  if (typeof r.motif === 'string' && MOTIF_IDS.has(r.motif)) out.motif = r.motif as NecklaceMotif
  // Dimensional / per-category fields, each range-clamped or enum-checked.
  if (num(r.bandWidth)) out.bandWidth = clamp(r.bandWidth, 1, 12)
  if (typeof r.bandProfile === 'string' && BAND_PROFILES.has(r.bandProfile)) out.bandProfile = r.bandProfile as BandProfile
  if (typeof r.chainStyle === 'string' && NECKLACE_STYLE_IDS.has(r.chainStyle)) out.chainStyle = r.chainStyle as NecklaceStyle
  if (num(r.necklaceLength)) out.necklaceLength = clamp(r.necklaceLength, 14, 30)
  if (typeof r.braceletKind === 'string' && BRACELET_KINDS.has(r.braceletKind)) out.braceletKind = r.braceletKind as BraceletKind
  if (num(r.dropLength)) out.dropLength = clamp(r.dropLength, 0, 60)
  if (typeof r.bodyStyle === 'string' && BODY_STYLE_IDS.has(r.bodyStyle)) out.bodyStyle = r.bodyStyle as BodyStyle
  if (num(r.bodyGauge)) out.bodyGauge = clamp(r.bodyGauge, 0.8, 3.2)
  if (num(r.bodySize)) out.bodySize = clamp(r.bodySize, 3, 25)
  return Object.keys(out).length ? out : null
}

function describe(d: AiDesignPatch | null): string[] {
  if (!d) return []
  const m: string[] = []
  if (d.category) m.push(d.category)
  if (d.alloyId) m.push(ALLOYS.find(a => a.id === d.alloyId)?.name ?? d.alloyId)
  if (d.carat) m.push(`${d.carat.toFixed(2)} ct`)
  if (d.shapeId) m.push(SHAPES.find(s => s.id === d.shapeId)?.name ?? d.shapeId)
  if (d.stoneTypeId) m.push(d.stoneTypeId === NO_STONE ? 'no stone' : (STONES.find(s => s.id === d.stoneTypeId)?.name ?? d.stoneTypeId))
  if (d.settingId) m.push(SETTINGS.find(s => s.id === d.settingId)?.name ?? d.settingId)
  if (d.size) m.push(`size ${d.size}`)
  if (d.finish) m.push(FINISHES.find(f => f.id === d.finish)?.name ?? d.finish)
  if (d.motif && d.motif !== 'none') m.push(MOTIFS.find(([id]) => id === d.motif)?.[1] ?? d.motif)
  if (d.bandWidth) m.push(`${d.bandWidth} mm band`)
  if (d.bandProfile) m.push(`${d.bandProfile} profile`)
  if (d.chainStyle) m.push(`${d.chainStyle} chain`)
  if (d.necklaceLength) m.push(`${d.necklaceLength}"`)
  if (d.braceletKind) m.push(d.braceletKind)
  if (typeof d.dropLength === 'number') m.push(d.dropLength > 0 ? `${d.dropLength} mm drop` : 'stud')
  if (d.bodyStyle) m.push(BODY_STYLES.find(([id]) => id === d.bodyStyle)?.[1] ?? d.bodyStyle)
  if (d.bodyGauge) m.push(`${d.bodyGauge} mm gauge`)
  if (d.bodySize) m.push(`${d.bodySize} mm`)
  return m
}

/** Apply a validated patch to the live design. The AI studio shows the same
 *  piece, so we don't switch tabs — the render just updates in place. */
export function applyAiDesign(d: AiDesignPatch): void {
  const s = useDesign.getState()
  // The AI is defining a fresh piece — clear any leftover "hidden" flags from a
  // previous design so nothing it builds (a motif in the head slot, a new band)
  // ends up invisible. This was a real trap: a hidden 'head' hid the whole motif.
  s.clearHidden()
  // A Celtic knot only makes sense on a necklace — force the category so the
  // motif has somewhere to render even if the model forgot to set it.
  if ((d.motif && d.motif !== 'none') && !d.category) s.setCategory('necklace')
  if (d.category) s.setCategory(d.category)
  if (d.alloyId) s.setAlloy(d.alloyId)
  if (d.shapeId) s.setShape(d.shapeId)
  if (d.stoneTypeId) s.setStone(d.stoneTypeId)
  if (typeof d.carat === 'number') s.setCarat(d.carat)
  if (d.settingId) s.setSetting(d.settingId)
  if (typeof d.size === 'number') s.setRing({ size: d.size })
  if (d.finish) s.setFinish(d.finish)
  if (d.motif) s.setNecklace({ motif: d.motif })
  // Dimensional / per-category geometry.
  if (typeof d.bandWidth === 'number') s.setRing({ width: d.bandWidth })
  if (d.bandProfile) s.setRing({ profile: d.bandProfile })
  if (d.chainStyle) s.setNecklace({ chainStyle: d.chainStyle })
  if (typeof d.necklaceLength === 'number') s.setNecklace({ length: d.necklaceLength })
  if (d.braceletKind) s.setBracelet({ kind: d.braceletKind })
  if (typeof d.dropLength === 'number') s.setEarring({ dropLength: d.dropLength })
  if (d.bodyStyle) s.setBody({ style: d.bodyStyle })
  if (typeof d.bodyGauge === 'number') s.setBody({ gauge: d.bodyGauge })
  if (typeof d.bodySize === 'number') s.setBody({ size: d.bodySize })
}

/** Ask the assistant. Returns the parsed reply; throws on transport error. */
export async function askAssistant(history: ChatTurn[], image?: string | null): Promise<AiReply & { disabled?: boolean }> {
  const res = await api.assistant({ system: buildSystemPrompt(), messages: history, image: image ?? null }) as { text?: string; disabled?: boolean }
  // Trace the round-trip so a "nothing happened" report is diagnosable from the
  // browser console (F12 → Console, filter "[AI]"): raw model text + parse result.
  console.log('[AI] raw server response:', res)
  if (res.disabled) { console.log('[AI] assistant reports disabled (no key)'); return { reply: '', design: null, matched: [], disabled: true } }
  const parsed = parseAiReply(res.text ?? '')
  console.log('[AI] parsed reply:', parsed.reply, '| design patch:', parsed.design, '| matched:', parsed.matched)
  return parsed
}

export async function assistantEnabled(): Promise<boolean> {
  try { const r = await api.assistantStatus() as { enabled?: boolean }; return !!r.enabled } catch { return false }
}
