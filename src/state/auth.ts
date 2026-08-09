import { create } from 'zustand'
import { api, apiConfigured, setToken } from '../lib/api'
import type { Subscription } from '../lib/plans'
import { getRef, clearRef } from '../lib/referral'

// Standalone soft gate (used when no backend is configured). NOT real security.
const USERS: Record<string, string> = { mike: 'mike123', liliya: 'liliya123' }
// Standalone (no-backend) roles. Mirrors the seeded backend roles so the admin
// gate behaves the same offline as it does against the server.
const SOFT_ROLES: Record<string, string> = { mike: 'admin', liliya: 'associate' }
const softRole = (user: string): string => SOFT_ROLES[user] ?? 'associate'
const KEY = 'blue-flame.user'
const TKEY = 'blue-flame.token'
const RKEY = 'blue-flame.role'

const stored = (): string | null => {
  try { return localStorage.getItem(KEY) } catch { return null }
}
const storedToken = (): string | null => {
  try { return localStorage.getItem(TKEY) } catch { return null }
}
const storedRole = (): string | null => {
  try { return localStorage.getItem(RKEY) } catch { return null }
}
const rememberRole = (role: string | null) => {
  try { if (role) localStorage.setItem(RKEY, role); else localStorage.removeItem(RKEY) } catch { /* */ }
}

/**
 * With a backend, a remembered username is only a real session if we still hold
 * a token. Without this the app looks signed in while every API call fails with
 * "missing bearer token" — a broken state the user can't see or escape.
 */
export const sessionUser = (user: string | null, token: string | null, backend: boolean): string | null =>
  backend && !token ? null : user

// Restore a backend token across refreshes.
const restoredToken = storedToken()
if (restoredToken) setToken(restoredToken)

/**
 * Why a backend sign-in failed. "unreachable" matters on a free host that
 * sleeps: telling someone their password is wrong when the server is simply
 * asleep sends them chasing the wrong problem.
 */
export type LoginFailure = 'credentials' | 'unreachable'
export type LoginResult = { ok: true } | { ok: false; reason: LoginFailure }

/**
 * Classify a failed sign-in. fetch() rejects with a TypeError when the request
 * never got a response (server asleep, offline, CORS-blocked); an HTTP error —
 * including a 401 for a genuinely wrong password — arrives as a plain Error
 * from the API client.
 */
export const loginFailureReason = (err: unknown): LoginFailure =>
  err instanceof TypeError ? 'unreachable' : 'credentials'

/**
 * Whether a failed session check means the stored token is actually dead.
 *
 * Only a server that ACTIVELY rejected it (401 — expired, wrong signature, a
 * tenant that no longer exists) invalidates a session. Being unable to reach
 * the server says nothing about the token's validity, and a free host that
 * sleeps would otherwise sign people out every time it naps — worse than the
 * bug this check exists to fix.
 */
export const sessionInvalidatedBy = (err: unknown): boolean =>
  loginFailureReason(err) === 'credentials'

interface AuthStore {
  user: string | null
  role: string | null
  backend: boolean
  /** Billing state for the signed-in shop; null until fetched (or no backend). */
  subscription: Subscription | null
  /**
   * Whether the first subscription fetch since sign-in has finished (success
   * or failure). Lets the paywall gate show a brief "checking" state instead
   * of flashing the pricing screen at a paying member before their real
   * status comes back — see App.tsx.
   */
  subscriptionChecked: boolean
  setSubscription: (s: Subscription | null) => void
  /** Fetch the shop's subscription from the backend (no-op without a backend). */
  refreshSubscription: () => Promise<void>
  login: (username: string, password: string) => boolean
  loginRemote: (email: string, password: string) => Promise<LoginResult>
  /** Create a new shop account (backend) and sign in. */
  registerRemote: (shop: string, email: string, password: string) => Promise<LoginResult>
  /** Confirm a restored token is still good; sign out only if it was rejected. */
  verifySession: () => Promise<void>
  logout: () => void
}

const initUser = sessionUser(stored(), restoredToken, apiConfigured())
const initRole = initUser ? (apiConfigured() ? (storedRole() ?? 'associate') : softRole(initUser)) : null

export const useAuth = create<AuthStore>((set, get) => ({
  user: initUser,
  role: initRole,
  backend: apiConfigured(),
  subscription: null,
  subscriptionChecked: false,

  setSubscription: s => set({ subscription: s }),
  refreshSubscription: async () => {
    if (!apiConfigured() || !get().user) { set({ subscriptionChecked: true }); return }
    try { set({ subscription: await api.getSubscription(), subscriptionChecked: true }) }
    catch { set({ subscriptionChecked: true }) /* leave subscription as-is on failure */ }
  },

  // Standalone gate.
  login: (username, password) => {
    const key = username.trim().toLowerCase()
    if (USERS[key] && USERS[key] === password) {
      const role = softRole(key)
      try { localStorage.setItem(KEY, key) } catch { /* */ }
      rememberRole(role)
      set({ user: key, role })
      return true
    }
    return false
  },

  // Backend auth (scrypt + JWT) when VITE_API_URL is set.
  loginRemote: async (email, password) => {
    try {
      const r = await api.login(email.trim().toLowerCase(), password) as { token: string; role?: string }
      setToken(r.token)
      const role = r.role ?? 'associate'
      try { localStorage.setItem(TKEY, r.token); localStorage.setItem(KEY, email.trim().toLowerCase()) } catch { /* */ }
      rememberRole(role)
      set({ user: email.trim().toLowerCase(), role })
      void get().refreshSubscription()
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: loginFailureReason(err) }
    }
  },

  // Create a new shop account (admin user) and sign in. Used on the paywall so a
  // brand-new customer can register, then subscribe, in one flow.
  registerRemote: async (shop, email, password) => {
    try {
      const r = await api.register(shop.trim(), email.trim().toLowerCase(), password, getRef()) as { token: string; role?: string }
      clearRef()
      setToken(r.token)
      const role = r.role ?? 'admin'
      try { localStorage.setItem(TKEY, r.token); localStorage.setItem(KEY, email.trim().toLowerCase()) } catch { /* */ }
      rememberRole(role)
      set({ user: email.trim().toLowerCase(), role })
      void get().refreshSubscription()
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: loginFailureReason(err) }
    }
  },

  // A restored token can be structurally fine but no longer accepted — expired,
  // or issued for a tenant that no longer exists. Ask the server once on load
  // rather than letting every later call fail against a session that looks live.
  // Also refreshes the role (which the token, not localStorage, is authoritative on).
  verifySession: async () => {
    if (!apiConfigured() || !get().user || !storedToken()) return
    try {
      const r = await api.me() as { user?: { role?: string } }
      const role = r?.user?.role
      if (role) { rememberRole(role); set({ role }) }
    } catch (err) {
      if (sessionInvalidatedBy(err)) get().logout()
    }
  },

  logout: () => {
    setToken(null)
    try { localStorage.removeItem(KEY); localStorage.removeItem(TKEY) } catch { /* */ }
    rememberRole(null)
    set({ user: null, role: null, subscription: null, subscriptionChecked: false })
  }
}))
