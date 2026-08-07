/**
 * Affiliate referral capture. When a visitor arrives on an affiliate link
 * (`?ref=CODE`), we stash the code so it survives until they create an account,
 * then attach it to the signup so the affiliate gets credited. Kept tiny and
 * dependency-free; safe to call on every load.
 */
const REF_KEY = 'blue-flame.ref'

export function captureRef(): void {
  try {
    const r = new URLSearchParams(window.location.search).get('ref')
    if (r && r.trim()) localStorage.setItem(REF_KEY, r.trim().toLowerCase().slice(0, 64))
  } catch { /* no URL / storage — ignore */ }
}

export function getRef(): string | null {
  try { return localStorage.getItem(REF_KEY) } catch { return null }
}

export function clearRef(): void {
  try { localStorage.removeItem(REF_KEY) } catch { /* ignore */ }
}
