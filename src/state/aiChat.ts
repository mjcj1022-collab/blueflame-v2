import { create } from 'zustand'
import { askAssistant, applyAiDesign, assistantEnabled, type ChatTurn, type AiDesignPatch } from '../lib/aiAssistant'

/**
 * Persistent AI-studio conversation. Kept in a module-level store (not component
 * state) so switching tabs — or closing and reopening the studio — retains the
 * whole conversation, and an in-flight request keeps running and lands its reply
 * even if you navigate away mid-generation. Cleared only by Reset or a page reload.
 */

export interface AiMsg { role: 'user' | 'assistant'; content: string; matched?: string[]; image?: string }

interface AiChatStore {
  enabled: boolean | null
  messages: AiMsg[]
  input: string
  image: string | null
  busy: boolean
  error: string | null
  checkEnabled: () => Promise<void>
  setInput: (s: string) => void
  setImage: (s: string | null) => void
  send: (text: string) => Promise<void>
  reset: () => void
}

export const useAiChat = create<AiChatStore>((set, get) => ({
  enabled: null,
  messages: [],
  input: '',
  image: null,
  busy: false,
  error: null,

  checkEnabled: async () => {
    // Re-check if we haven't confirmed it's on yet (a key may have just been added).
    if (get().enabled === true) return
    try { set({ enabled: await assistantEnabled() }) } catch { set({ enabled: false }) }
  },

  setInput: s => set({ input: s }),
  setImage: s => set({ image: s }),

  send: async (text: string) => {
    const st = get()
    const content = text.trim()
    if ((!content && !st.image) || st.busy) return
    const userMsg: AiMsg = { role: 'user', content: content || 'What can you make from this image?', image: st.image ?? undefined }
    const history: ChatTurn[] = [...st.messages, userMsg].map(m => ({ role: m.role, content: m.content }))
    const img = st.image
    set({ messages: [...st.messages, userMsg], input: '', image: null, busy: true, error: null })
    console.log('[AI] sending request:', content || '(image only)')
    try {
      const res = await askAssistant(history, img)
      if (res.disabled) { set({ enabled: false, busy: false }); return }
      // Note when the model replied but changed nothing, so the render staying put
      // reads as an intentional answer rather than a silent failure.
      const note = res.design ? undefined : ['no change to the piece']
      set(s => ({ messages: [...s.messages, { role: 'assistant', content: res.reply, matched: res.matched?.length ? res.matched : note }], busy: false, enabled: true }))
      if (res.design) applyAiDesign(res.design as AiDesignPatch)
    } catch (e) {
      console.error('[AI] request failed:', e)
      set({ error: e instanceof Error ? e.message : 'The assistant could not be reached.', busy: false })
    }
  },

  reset: () => set({ messages: [], input: '', image: null, error: null }),
}))
