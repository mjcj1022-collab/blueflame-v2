import { db, uid } from './db.js'
import { hashPassword } from './auth.js'

// Seeds a Mandrel tenant and the two demo users. Safe to re-run.
//
// Blue Flame → Mandrel rename (2026-08): if this deployment already seeded a
// tenant under the old slug/name, rename that row in place instead of
// inserting a second tenant — keeps every existing user, design, and order
// attached to the same shop.
let tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get('mandrel') as { id: string } | undefined
if (!tenant) {
  const legacy = db.prepare('SELECT id FROM tenants WHERE slug = ?').get('blue-flame') as { id: string } | undefined
  if (legacy) {
    db.prepare('UPDATE tenants SET name = ?, slug = ? WHERE id = ?').run('Mandrel', 'mandrel', legacy.id)
    tenant = legacy
    console.log('renamed tenant blue-flame -> mandrel (id ' + legacy.id + ')')
  }
}
if (!tenant) {
  const id = uid()
  db.prepare('INSERT INTO tenants (id, name, slug) VALUES (?,?,?)').run(id, 'Mandrel', 'mandrel')
  tenant = { id }
}

// This seeded tenant is the shop's own operator account, not a paying
// customer — it should never be paywalled. New shops that register through
// the app (a separate tenant, created in index.ts) still start with
// subscription_status='none' and go through Stripe checkout as normal; this
// unconditional update only ever touches the one seeded 'mandrel' tenant.
db.prepare("UPDATE tenants SET subscription_status = 'active' WHERE id = ? AND subscription_status = 'none'")
  .run(tenant.id)

for (const [email, pw, role] of [['mike', 'mike123', 'admin'], ['liliya', 'liliya123', 'associate']] as const) {
  const exists = db.prepare('SELECT id FROM users WHERE tenant_id = ? AND email = ?').get(tenant.id, email)
  if (!exists) {
    db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, role) VALUES (?,?,?,?,?)')
      .run(uid(), tenant.id, email, hashPassword(pw), role)
    console.log(`seeded user ${email} (${role})`)
  }
}
console.log('Seed complete. Tenant:', tenant.id)
