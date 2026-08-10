/**
 * Optional backend client. Set VITE_API_URL at build time to point the app at a
 * running Mandrel server (see server/README.md). When unset, the app runs
 * fully standalone on localStorage — nothing here is called.
 *
 * The offline desktop build (`npm run build:offline`, see offline/README.txt)
 * is built with VITE_OFFLINE=1, which forces standalone mode here regardless
 * of any VITE_API_URL left over in the shell — a buyer's downloaded copy must
 * never accidentally try to phone home to the hosted backend or show the
 * paywall (they already paid once, at checkout).
 */
import type { Subscription } from './plans'

const OFFLINE_BUILD = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_OFFLINE === '1'
const BASE = OFFLINE_BUILD ? undefined : (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL

export const apiConfigured = (): boolean => !!BASE
export const apiBase = (): string | undefined => BASE

/** An order row as the server returns it, joined with its design and customer. */
export interface ServerOrder {
  id: string
  design_id: string | null
  design_name: string | null
  customer_id: string | null
  customer_name: string | null
  is_sculpt: 0 | 1
  stage: string
  created_at: string
  approved_at: string | null
}

/** A team member (user) in the shop, as the server returns it. */
export interface TeamMember {
  id: string
  email: string
  role: string
  created_at: string
}

/** A cloud sculpt library entry (list view omits `data`). */
export interface CloudSculpt {
  id: string
  name: string
  tags: string | null
  updated_at: string
}

/** A CRM customer record. */
export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

/** Ping the backend's health endpoint. Never throws — returns false if the API
 *  is unset, unreachable, or unhealthy. Used by the connection indicator. */
export async function apiHealth(signal?: AbortSignal): Promise<boolean> {
  if (!BASE) return false
  try {
    const res = await fetch(BASE + '/api/health', { signal })
    if (!res.ok) return false
    const body = await res.json().catch(() => null) as { ok?: boolean } | null
    return body?.ok === true
  } catch { return false }
}

let token: string | null = null
export const setToken = (t: string | null): void => { token = t }

/** Statuses worth retrying — a gateway/timeout usually means the host is still
 *  coming up, not that the request was wrong. 4xx (e.g. bad password) is final. */
const TRANSIENT = new Set([408, 429, 502, 503, 504])
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export interface RetryOptions {
  /** How long to keep trying, ms. Must outlast a cold start, not a blip. */
  budgetMs?: number
  baseDelay?: number
  maxDelay?: number
}

/**
 * fetch that keeps trying for a TIME BUDGET, not a fixed attempt count.
 *
 * A free host sleeps when idle and can take ~50 s to wake, during which it may
 * refuse connections or answer 503 immediately. A handful of quick retries just
 * burns through in seconds and surfaces a bogus "login failed" — so the budget
 * has to outlast the wake, not the blip.
 *
 * Only network errors and TRANSIENT statuses are retried; anything else (a 401
 * for a genuinely wrong password) returns on the first try so real errors stay
 * fast.
 */
export async function fetchWithRetry(
  url: string, opts: RequestInit = {}, retry: RetryOptions = {},
): Promise<Response> {
  const { budgetMs = 75_000, baseDelay = 1_000, maxDelay = 5_000 } = retry
  const deadline = Date.now() + budgetMs
  let attempt = 0, lastErr: unknown, lastRes: Response | undefined
  for (;;) {
    try {
      const res = await fetch(url, opts)
      if (!TRANSIENT.has(res.status)) return res   // answered — success or a real error
      lastRes = res
    } catch (err) {
      lastErr = err
    }
    const delay = Math.min(baseDelay * ++attempt, maxDelay)
    if (Date.now() + delay >= deadline) break
    await sleep(delay)
  }
  if (lastRes) return lastRes            // out of budget — surface the last transient answer
  throw lastErr ?? new Error('request failed')
}

async function req(path: string, opts: RequestInit = {}): Promise<unknown> {
  if (!BASE) throw new Error('Backend not configured — set VITE_API_URL')
  const res = await fetchWithRetry(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {})
    }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; detail?: string }
    // Surface the server's `detail` (e.g. the provider's own message) so failures are diagnosable,
    // not an opaque "assistant failed". Falls back to error, then HTTP status text.
    const msg = [body.error, body.detail].filter(Boolean).join(': ') || res.statusText
    throw new Error(msg)
  }
  return res.json()
}

export const api = {
  login: (email: string, password: string) => req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (shop: string, email: string, password: string, ref?: string | null) => req('/api/auth/register', { method: 'POST', body: JSON.stringify({ shop, email, password, ref: ref ?? undefined }) }),
  me: () => req('/api/me'),
  listTeam: () => req('/api/team') as Promise<TeamMember[]>,
  addTeam: (email: string, password: string, role: string) => req('/api/team', { method: 'POST', body: JSON.stringify({ email, password, role }) }) as Promise<{ id: string; role: string }>,
  setTeamRole: (id: string, role: string) => req(`/api/team/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }) as Promise<{ updated: number }>,
  removeTeam: (id: string) => req(`/api/team/${id}`, { method: 'DELETE' }) as Promise<{ deleted: number }>,
  listDesigns: () => req('/api/designs'),
  saveDesign: (name: string, spec: unknown) => req('/api/designs', { method: 'POST', body: JSON.stringify({ name, spec }) }),
  loadDesign: (id: string) => req(`/api/designs/${id}`),
  deleteDesign: (id: string) => req(`/api/designs/${id}`, { method: 'DELETE' }),
  listSculpts: () => req('/api/sculpts') as Promise<CloudSculpt[]>,
  getSculpt: (id: string) => req(`/api/sculpts/${id}`) as Promise<CloudSculpt & { data: unknown[] }>,
  saveSculpt: (name: string, tags: string[], data: unknown) => req('/api/sculpts', { method: 'POST', body: JSON.stringify({ name, tags, data }) }) as Promise<{ id: string }>,
  deleteSculpt: (id: string) => req(`/api/sculpts/${id}`, { method: 'DELETE' }) as Promise<{ deleted: number }>,
  listOrders: () => req('/api/orders') as Promise<ServerOrder[]>,
  createOrder: (design_id: string, customer_id?: string) => req('/api/orders', { method: 'POST', body: JSON.stringify({ design_id, customer_id }) }),
  advanceOrder: (id: string, stage: string) => req(`/api/orders/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }) as Promise<{ updated: number }>,
  setOrderCustomer: (id: string, customer_id: string | null) => req(`/api/orders/${id}/customer`, { method: 'PATCH', body: JSON.stringify({ customer_id }) }) as Promise<{ updated: number }>,
  listCustomers: () => req('/api/customers') as Promise<Customer[]>,
  createCustomer: (c: { name: string; email?: string; phone?: string; notes?: string }) => req('/api/customers', { method: 'POST', body: JSON.stringify(c) }) as Promise<{ id: string }>,
  updateCustomer: (id: string, c: Partial<{ name: string; email: string; phone: string; notes: string }>) => req(`/api/customers/${id}`, { method: 'PATCH', body: JSON.stringify(c) }) as Promise<{ updated: number }>,
  deleteCustomer: (id: string) => req(`/api/customers/${id}`, { method: 'DELETE' }) as Promise<{ deleted: number }>,
  listGallery: () => req('/api/gallery') as Promise<ServerGalleryItem[]>,
  addGallery: (item: { title: string; subtitle?: string; image: string; spec?: unknown }) => req('/api/gallery', { method: 'POST', body: JSON.stringify(item) }) as Promise<{ id: string }>,
  deleteGallery: (id: string) => req(`/api/gallery/${id}`, { method: 'DELETE' }) as Promise<{ deleted: number }>,
  assistantStatus: () => req('/api/assistant/status') as Promise<{ enabled: boolean }>,
  assistant: (body: { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; image?: string | null }) =>
    req('/api/assistant', { method: 'POST', body: JSON.stringify(body) }) as Promise<{ text?: string; disabled?: boolean }>,
  checkout: (amount_cents: number, order_id: string, design_id?: string) => req('/api/checkout', { method: 'POST', body: JSON.stringify({ amount_cents, order_id, design_id }) }) as Promise<{ clientSecret: string; order_id: string | null }>,
  // Subscription / purchase billing.
  getSubscription: () => req('/api/subscription') as Promise<Subscription>,
  // Pass our own app URL so Stripe returns the customer to the actual app (which
  // may live on a subpath), not just the bare origin.
  startCheckout: (planId: string) => req('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ planId, returnTo: window.location.origin + window.location.pathname }) }) as Promise<{ url: string }>,
  // Affiliate program (admin).
  listAffiliates: () => req('/api/affiliates') as Promise<Affiliate[]>,
  createAffiliate: (a: { name?: string; email?: string; code?: string; ratePct?: number }) => req('/api/affiliates', { method: 'POST', body: JSON.stringify(a) }) as Promise<{ id: string; code: string; rate: number }>,
  updateAffiliate: (id: string, patch: { ratePct?: number; active?: boolean; name?: string; email?: string }) => req(`/api/affiliates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) as Promise<{ updated: number }>,
  deactivateAffiliate: (id: string) => req(`/api/affiliates/${id}`, { method: 'DELETE' }) as Promise<{ deactivated: number }>,
}

/** Trigger a browser download of the offline .zip for a shop that's already
 *  paid for it. Doesn't go through req() above since the response here is a
 *  binary file, not JSON. */
export async function downloadOffline(): Promise<void> {
  if (!BASE) throw new Error('Backend not configured — set VITE_API_URL')
  const res = await fetch(BASE + '/api/offline-download', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || res.statusText)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Mandrel-Offline.zip'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** An affiliate link with its per-link rate and running earnings. */
export interface Affiliate {
  id: string
  code: string
  name: string | null
  email: string | null
  rate: number          // fraction, e.g. 0.2 = 20%
  active: number
  created_at: string
  referrals: number     // shops that signed up on this link
  conversions: number   // commission-earning payments
  earned_cents: number
  pending_cents: number
}

/** A curated gallery entry as the server returns it (spec is a JSON string). */
export interface ServerGalleryItem {
  id: string
  title: string
  subtitle: string | null
  image: string
  spec: string | null
  created_at: string
}
