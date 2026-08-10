// One-time migration for the Blue Flame → Mandrel rename (2026-08).
// Copies every localStorage key that used the old 'blue-flame.' prefix to
// the new 'mandrel.' prefix, so returning visitors keep their saved
// settings, autosave, snapshots, gallery, sketch presets, referral code,
// and tour-seen flag instead of losing them when the key names changed.
// Safe to run on every load — it's a no-op once the copy has happened.
const OLD_PREFIX = 'blue-flame.'
const NEW_PREFIX = 'mandrel.'
const OLD_COLON_PREFIX = 'blue-flame:'
const NEW_COLON_PREFIX = 'mandrel:'

export function migrateLegacyStorage() {
  try {
    const ls = window.localStorage
    const keys: string[] = []
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (k) keys.push(k)
    }
    for (const key of keys) {
      let newKey: string | null = null
      if (key.startsWith(OLD_PREFIX)) newKey = NEW_PREFIX + key.slice(OLD_PREFIX.length)
      else if (key.startsWith(OLD_COLON_PREFIX)) newKey = NEW_COLON_PREFIX + key.slice(OLD_COLON_PREFIX.length)
      if (newKey && ls.getItem(newKey) === null) {
        const value = ls.getItem(key)
        if (value !== null) ls.setItem(newKey, value)
      }
    }
  } catch {
    // localStorage unavailable (private mode, SSR, etc.) — nothing to migrate
  }
}
