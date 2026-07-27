import { api } from './api'

/**
 * AI command layer for the modeler. Where the design assistant BUILDS a piece,
 * this DRIVES the finishing/setting tools on the piece already on the bench:
 * "hammer the band, dome the top, add a gallery, flush-set the stone" becomes an
 * ordered list of tool operations the store executes in sequence.
 *
 * The model returns { reply, commands: [ {op, ...args} ] }; we validate every op
 * name and clamp every argument here, so a hallucinated op or a wild number can
 * never reach the geometry engine.
 */

export type TextureStyleCmd = 'hammered' | 'stipple' | 'florentine'
export type AxisCmd = 'x' | 'y' | 'z'

export type ModelerCommand =
  | { op: 'texture'; style: TextureStyleCmd; depth: number }
  | { op: 'dome'; height: number }
  | { op: 'sizingBeads' }
  | { op: 'milgrain'; radius: number; beadDia: number }
  | { op: 'bail' }
  | { op: 'drill'; axis: AxisCmd; dia: number }
  | { op: 'pierce'; count: number; mode: 'row' | 'ring'; dia: number; axis: AxisCmd }
  | { op: 'flush' }
  | { op: 'halo'; count: number; carat: number }
  | { op: 'fitHead'; prongs: number }
  | { op: 'fitBezel' }
  | { op: 'signet'; width: number; length: number; thickness: number }
  | { op: 'symmetrize'; axis: AxisCmd }
  | { op: 'autoOrient' }
  | { op: 'gallery' }
  | { op: 'subtractAll' }

export const COMMAND_OPS = [
  'texture', 'dome', 'sizingBeads', 'milgrain', 'bail', 'drill', 'pierce',
  'flush', 'halo', 'fitHead', 'fitBezel', 'signet', 'symmetrize', 'autoOrient', 'gallery', 'subtractAll',
] as const

const clamp = (n: unknown, lo: number, hi: number, dflt: number): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : dflt
  return Math.min(hi, Math.max(lo, v))
}
const oneOf = <T extends string>(v: unknown, set: readonly T[], dflt: T): T =>
  typeof v === 'string' && (set as readonly string[]).includes(v) ? (v as T) : dflt

const TEX: readonly TextureStyleCmd[] = ['hammered', 'stipple', 'florentine']
const AX: readonly AxisCmd[] = ['x', 'y', 'z']

/** Validate + clamp a single raw command object; null if the op is unknown. */
export function normalizeCommand(raw: unknown): ModelerCommand | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const op = r.op
  switch (op) {
    case 'texture': return { op, style: oneOf(r.style, TEX, 'hammered'), depth: clamp(r.depth, 0.02, 1, 0.15) }
    case 'dome': return { op, height: clamp(r.height, 0.1, 6, 1.5) }
    case 'sizingBeads': return { op }
    case 'milgrain': return { op, radius: clamp(r.radius, 0.5, 40, 4), beadDia: clamp(r.beadDia, 0.2, 2, 0.5) }
    case 'bail': return { op }
    case 'drill': return { op, axis: oneOf(r.axis, AX, 'y'), dia: clamp(r.dia, 0.2, 20, 1.2) }
    case 'pierce': return { op, count: clamp(r.count, 1, 100, 6), mode: oneOf(r.mode, ['row', 'ring'] as const, 'ring'), dia: clamp(r.dia, 0.2, 20, 1), axis: oneOf(r.axis, AX, 'y') }
    case 'flush': return { op }
    case 'halo': return { op, count: clamp(r.count, 3, 60, 12), carat: clamp(r.carat, 0.005, 2, 0.03) }
    case 'fitHead': return { op, prongs: clamp(r.prongs, 3, 8, 4) }
    case 'fitBezel': return { op }
    case 'signet': return { op, width: clamp(r.width, 1, 40, 10), length: clamp(r.length, 1, 40, 12), thickness: clamp(r.thickness, 0.3, 6, 1.5) }
    case 'symmetrize': return { op, axis: oneOf(r.axis, AX, 'x') }
    case 'autoOrient': return { op }
    case 'gallery': return { op }
    case 'subtractAll': return { op }
    default: return null
  }
}

export interface CommandReply { reply: string; commands: ModelerCommand[] }

function extractJson(text: string): string | null {
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const src = fence ? fence[1] : text
  const start = src.indexOf('{')
  if (start < 0) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(start, i + 1) }
  }
  return null
}

export function parseCommandReply(text: string): CommandReply {
  const raw = extractJson(text)
  if (!raw) return { reply: text.trim() || 'No changes.', commands: [] }
  let obj: { reply?: unknown; commands?: unknown }
  try { obj = JSON.parse(raw) } catch { return { reply: text.trim(), commands: [] } }
  const commands = Array.isArray(obj.commands)
    ? obj.commands.map(normalizeCommand).filter((c): c is ModelerCommand => c !== null).slice(0, 20)
    : []
  const reply = typeof obj.reply === 'string' && obj.reply.trim() ? obj.reply.trim()
    : commands.length ? `Applying ${commands.length} step${commands.length === 1 ? '' : 's'}.` : 'No changes.'
  return { reply, commands }
}

export function buildCommandPrompt(): string {
  return [
    'You control the finishing and setting tools of the Blue Flame jewelry modeler, on the piece ALREADY on the bench. The maker tells you what to do to it; you return an ordered list of tool operations.',
    'Reply with a SINGLE JSON object and NOTHING else: { "reply": "<one short sentence>", "commands": [ { "op": "...", ...args } ] }',
    'Use ONLY these ops and argument shapes:',
    'texture {style: hammered|stipple|florentine, depth: mm} — hammer/stipple/engrave the selected metal surface',
    'dome {height: mm} — bulge the top into a cabochon/comfort dome',
    'sizingBeads {} — add two sizing beads inside a band',
    'milgrain {radius: mm, beadDia: mm} — a ring of milgrain beads',
    'bail {} — add a bail/loop to the top (for a pendant)',
    'drill {axis: x|y|z, dia: mm} — bore one through-hole',
    'pierce {count, mode: row|ring, dia: mm, axis: x|y|z} — pierce a row/ring of holes',
    'flush {} — flush/gypsy-set the stone into the metal below it',
    'halo {count, carat} — ring the centre stone with accent stones',
    'fitHead {prongs: 3-8} — add a prong head sized to the stone',
    'fitBezel {} — wrap the stone in a bezel',
    'signet {width: mm, length: mm, thickness: mm} — add a flat signet face on top',
    'symmetrize {axis: x|y|z} — force the part symmetric across a plane',
    'autoOrient {} — rotate the whole piece to the best print orientation',
    'gallery {} — add a decorative gallery ring under the stone',
    'subtractAll {} — subtract the selected part from every other metal part',
    'Order matters — list the steps in the sequence they should run. Translate plain words: "hammered band"→texture hammered; "add a halo"→halo; "flush set the stone"→flush; "make it symmetric"→symmetrize; "get it ready to print"→autoOrient.',
    'If the request is a question or nothing actionable, return an empty commands array and answer in reply.',
  ].join('\n')
}

export async function askCommands(text: string): Promise<CommandReply & { disabled?: boolean }> {
  const res = await api.assistant({ system: buildCommandPrompt(), messages: [{ role: 'user', content: text }], image: null }) as { text?: string; disabled?: boolean }
  if (res.disabled) return { reply: '', commands: [], disabled: true }
  return parseCommandReply(res.text ?? '')
}
