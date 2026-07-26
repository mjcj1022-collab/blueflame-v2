/**
 * Provider-agnostic LLM proxy. The frontend builds the system prompt (it owns
 * the catalog) and sends the conversation; this holds the key and relays it to
 * Anthropic or OpenAI, optionally with an image for photo/sketch → design. The
 * key never reaches the browser. With no key set, the feature reports disabled
 * and nothing is called.
 *
 * Env:
 *   AI_API_KEY   provider key (unset → disabled)
 *   AI_PROVIDER  'anthropic' (default) | 'openai'
 *   AI_MODEL     override the default model
 */

export interface AiMessage { role: 'user' | 'assistant'; content: string }
export interface AiRequest { system?: string; messages: AiMessage[]; image?: string | null }

const provider = () => (process.env.AI_PROVIDER || 'anthropic').toLowerCase()
const key = () => process.env.AI_API_KEY || ''
// Default to a current, non-deprecated model. The Claude API dropped "-latest"
// aliases and retired claude-3-5-sonnet, so an old default 404s; claude-sonnet-4-6
// is the current balanced choice. Override per-shop with AI_MODEL on the server.
const model = () => process.env.AI_MODEL || (provider() === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-6')

export const aiEnabled = (): boolean => !!key()

/** Split a data URL into its media type + base64 payload. */
function splitDataUrl(url: string): { media: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(url)
  return m ? { media: m[1], data: m[2] } : null
}

async function callAnthropic(k: string, req: AiRequest): Promise<string> {
  const last = req.messages[req.messages.length - 1]
  const img = req.image ? splitDataUrl(req.image) : null
  const messages = req.messages.map((m, i) => {
    if (i === req.messages.length - 1 && img && m.role === 'user') {
      return { role: m.role, content: [
        { type: 'image', source: { type: 'base64', media_type: img.media, data: img.data } },
        { type: 'text', text: m.content }
      ] }
    }
    return { role: m.role, content: m.content }
  })
  void last
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: model(), max_tokens: 1024, system: req.system, messages })
  })
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${await r.text()}`)
  const j = await r.json() as { content?: { type: string; text?: string }[] }
  return (j.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('').trim()
}

async function callOpenAI(k: string, req: AiRequest): Promise<string> {
  const messages: unknown[] = [{ role: 'system', content: req.system ?? '' }]
  req.messages.forEach((m, i) => {
    if (i === req.messages.length - 1 && req.image && m.role === 'user') {
      messages.push({ role: 'user', content: [
        { type: 'text', text: m.content },
        { type: 'image_url', image_url: { url: req.image } }
      ] })
    } else messages.push({ role: m.role, content: m.content })
  })
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${k}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: model(), max_tokens: 1024, messages })
  })
  if (!r.ok) throw new Error(`openai ${r.status}: ${await r.text()}`)
  const j = await r.json() as { choices?: { message?: { content?: string } }[] }
  return (j.choices?.[0]?.message?.content ?? '').trim()
}

export async function runAssistant(req: AiRequest): Promise<string> {
  if (!key()) return ''
  return provider() === 'openai' ? callOpenAI(key(), req) : callAnthropic(key(), req)
}
