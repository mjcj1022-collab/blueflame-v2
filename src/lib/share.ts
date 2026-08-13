import type { DesignSpec } from '../spec/types'

/**
 * Encode a design into a URL-safe token and back. The full spec travels in the
 * link, so a client can open the exact design with no login — the basis for the
 * no-login share/approve flow.
 */
export function encodeSpec(spec: DesignSpec): string {
  const json = JSON.stringify(spec)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeSpec(token: string): DesignSpec | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(escape(atob(b64)))
    const obj = JSON.parse(json)
    return obj && obj.version === 1 ? (obj as DesignSpec) : null
  } catch {
    return null
  }
}

export function shareUrl(spec: DesignSpec): string {
  const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : ''
  return `${base}?d=${encodeSpec(spec)}`
}

export function specFromUrl(): DesignSpec | null {
  if (typeof location === 'undefined') return null
  const token = new URLSearchParams(location.search).get('d')
  return token ? decodeSpec(token) : null
}

/** A no-login, read-only client-approval link: the design plus the shop name. */
export function reviewUrl(spec: DesignSpec, shop: string): string {
  const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : ''
  return `${base}?review=${encodeSpec(spec)}&shop=${encodeURIComponent(shop)}`
}

export function reviewFromUrl(): { spec: DesignSpec; shop: string } | null {
  if (typeof location === 'undefined') return null
  const params = new URLSearchParams(location.search)
  const token = params.get('review')
  if (!token) return null
  const spec = decodeSpec(token)
  return spec ? { spec, shop: params.get('shop') || 'Mandrel' } : null
}

/** A no-login, read-only order-status link for the buyer — just the order's
 *  own id (a crypto.randomUUID, unguessable) in the URL; the status itself is
 *  fetched live from the server so it always reflects the current stage. */
export function orderTrackUrl(orderId: string): string {
  const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : ''
  return `${base}?order=${encodeURIComponent(orderId)}`
}

export function orderIdFromUrl(): string | null {
  if (typeof location === 'undefined') return null
  return new URLSearchParams(location.search).get('order')
}
