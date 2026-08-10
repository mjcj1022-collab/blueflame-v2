import express, { type Request, type Response } from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, uid, audit } from './db.js'
import { requireAuth, requireRole, signToken, hashPassword, verifyPassword, type Claims } from './auth.js'
import { createPaymentIntent, constructWebhookEvent, createCheckoutSession } from './stripe.js'
import { getSpot } from './spot.js'
import { runAssistant, aiEnabled } from './ai.js'
import { sendOfflineDownloadEmail } from './mail.js'

const app = express()
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? '*' }))

/* ---------- Stripe webhook (raw body, before the JSON parser) ----------
 * Stripe posts here when a payment settles; the signature is verified against
 * the raw bytes, so this route must NOT go through express.json(). On a
 * successful PaymentIntent we advance the linked order to "approved" and record
 * the payment. Idempotent — Stripe may deliver an event more than once. */
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  if (!sig || typeof sig !== 'string') { res.status(400).json({ error: 'missing stripe-signature' }); return }
  let event
  try {
    event = await constructWebhookEvent(req.body as Buffer, sig)
  } catch (e) {
    res.status(400).json({ error: `signature verification failed: ${(e as Error).message}` }); return
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as { id?: string; amount_received?: number; amount?: number; metadata?: Record<string, string> }
    const orderId = pi.metadata?.order_id
    const tenantId = pi.metadata?.tenant_id
    const amount = pi.amount_received ?? pi.amount ?? 0
    if (orderId && orderId !== 'quote' && orderId !== 'adhoc') {
      const info = db.prepare(
        `UPDATE orders SET stage = 'approved', approved_at = COALESCE(approved_at, datetime('now')),
         stripe_payment_intent = ?, deposit_cents = ? WHERE id = ? AND stage IN ('designed','approved')`
      ).run(pi.id ?? null, amount, orderId)
      if (info.changes && tenantId) audit(tenantId, null, 'order.paid', orderId, { amount, payment_intent: pi.id })
    } else if (tenantId) {
      audit(tenantId, null, 'payment.received', null, { amount, payment_intent: pi.id })
    }
  }

  // Subscription / offline-purchase lifecycle — keep the tenant's billing state
  // in step with Stripe so the paywall gate can trust it.
  const updateTenantSub = (tenantId: string, patch: Record<string, unknown>) => {
    const cols = Object.keys(patch)
    if (!cols.length || !tenantId) return
    const set = cols.map(c => `${c} = ?`).join(', ')
    db.prepare(`UPDATE tenants SET ${set} WHERE id = ?`).run(...cols.map(c => patch[c] as never), tenantId)
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as {
      mode?: string; client_reference_id?: string; metadata?: Record<string, string>
      customer?: string; subscription?: string; customer_details?: { email?: string }; customer_email?: string
    }
    const tenantId = s.metadata?.tenant_id ?? s.client_reference_id ?? ''
    const planId = s.metadata?.plan_id ?? null
    if (tenantId) {
      if (s.mode === 'payment') {
        // Prefer the email Stripe actually collected at checkout; fall back to
        // the tenant's own admin user if that's ever missing.
        let buyerEmail = s.customer_details?.email ?? s.customer_email ?? null
        if (!buyerEmail) {
          const u = db.prepare('SELECT email FROM users WHERE tenant_id = ? ORDER BY created_at LIMIT 1').get(tenantId) as { email?: string } | undefined
          buyerEmail = u?.email ?? null
        }
        updateTenantSub(tenantId, {
          offline_purchase: 1,
          subscription_plan: planId ?? 'offline-lifetime',
          stripe_customer_id: s.customer ?? null,
          offline_purchase_email: buyerEmail,
        })
        if (buyerEmail) {
          const t = db.prepare('SELECT name FROM tenants WHERE id = ?').get(tenantId) as { name?: string } | undefined
          // Fire-and-forget: a slow or failed email must never hold up the
          // webhook response, which Stripe expects promptly.
          void sendOfflineDownloadEmail(buyerEmail, t?.name ?? '')
        }
      } else {
        updateTenantSub(tenantId, { subscription_status: 'active', subscription_plan: planId ?? 'studio-monthly', stripe_customer_id: s.customer ?? null, stripe_subscription_id: s.subscription ?? null })
      }
      audit(tenantId, null, 'billing.checkout', planId ?? undefined, { mode: s.mode })
    }
  } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as { status?: string; current_period_end?: number; metadata?: Record<string, string> }
    const tenantId = sub.metadata?.tenant_id ?? ''
    if (tenantId) {
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : (sub.status ?? 'active')
      updateTenantSub(tenantId, { subscription_status: status, current_period_end: sub.current_period_end ? sub.current_period_end * 1000 : null })
    }
  } else if (event.type === 'invoice.payment_failed') {
    const inv = event.data.object as { subscription?: string }
    if (inv.subscription) {
      const t = db.prepare('SELECT id FROM tenants WHERE stripe_subscription_id = ?').get(inv.subscription) as { id?: string } | undefined
      if (t?.id) updateTenantSub(t.id, { subscription_status: 'past_due' })
    }
  }

  res.json({ received: true })
})

app.use(express.json({ limit: '2mb' }))

const me = (req: Request) => (req as Request & { user: Claims }).user

// Email must be unique ACROSS tenants: login matches on email alone (first row
// wins), so two shops sharing an email would lock one out or, worse, cross into
// the other's data. Enforce global uniqueness at every account-creation path.
const emailExists = (email: string): boolean =>
  !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(String(email).toLowerCase())

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'mandrel', db: 'sqlite', time: new Date().toISOString() }))

// Daily precious-metal spot (public — prices aren't sensitive). Cached server-side.
app.get('/api/spot', async (_req, res) => {
  try { res.json(await getSpot()) }
  catch { res.json({ prices: {}, at: new Date().toISOString(), source: 'static', stale: true }) }
})

// AI design assistant proxy (auth-gated so it can't be used to burn the key).
app.get('/api/assistant/status', requireAuth, (_req, res) => res.json({ enabled: aiEnabled() }))
app.post('/api/assistant', requireAuth, async (req, res) => {
  if (!aiEnabled()) { res.json({ disabled: true, text: '' }); return }
  try {
    const { system, messages, image } = req.body ?? {}
    if (!Array.isArray(messages)) { res.status(400).json({ error: 'messages required' }); return }
    const text = await runAssistant({ system, messages, image })
    res.json({ text })
  } catch (e) {
    const detail = (e as Error).message || 'unknown error'
    console.error('[assistant] call failed:', detail)          // shows in Render logs
    res.status(502).json({ error: 'assistant failed', detail: detail.slice(0, 400) })
  }
})

/* ---------------- auth ---------------- */

app.post('/api/auth/register', (req, res) => {
  const { shop, email, password } = req.body ?? {}
  if (!shop || !email || !password) { res.status(400).json({ error: 'shop, email and password are required' }); return }
  if (emailExists(email)) { res.status(400).json({ error: 'that email is already registered' }); return }
  const tenantId = uid()
  const slug = `${String(shop).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${tenantId.slice(0, 4)}`
  try {
    db.prepare('INSERT INTO tenants (id, name, slug) VALUES (?,?,?)').run(tenantId, shop, slug)
    const userId = uid()
    db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, role) VALUES (?,?,?,?,?)')
      .run(userId, tenantId, String(email).toLowerCase(), hashPassword(password), 'admin')
    audit(tenantId, userId, 'register')
    res.json({ token: signToken({ id: userId, tenant_id: tenantId, role: 'admin' }), tenant: { id: tenantId, name: shop, slug }, role: 'admin' })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {}
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email ?? '').toLowerCase()) as
    { id: string; tenant_id: string; role: string; password_hash: string } | undefined
  if (!u || !verifyPassword(String(password ?? ''), u.password_hash)) { res.status(401).json({ error: 'invalid credentials' }); return }
  res.json({ token: signToken({ id: u.id, tenant_id: u.tenant_id, role: u.role }), role: u.role })
})

app.get('/api/me', requireAuth, (req, res) => {
  const t = db.prepare('SELECT id, name, slug, markup FROM tenants WHERE id = ?').get(me(req).tenant_id)
  res.json({ user: me(req), tenant: t })
})

/* ---------------- team (users & roles) ----------------
 * A shop owner (admin) invites bench and setter accounts into the same tenant.
 * All routes are admin-only and tenant-scoped. Guardrails: you can't demote or
 * remove the last admin, and you can't remove yourself. */
const ROLES = ['admin', 'bench', 'setter', 'associate']
const adminCount = (tenantId: string): number =>
  (db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id = ? AND role = 'admin'").get(tenantId) as { n: number }).n
const userRole = (id: string, tenantId: string): string | undefined =>
  (db.prepare('SELECT role FROM users WHERE id = ? AND tenant_id = ?').get(id, tenantId) as { role?: string } | undefined)?.role

app.get('/api/team', requireAuth, requireRole('admin'), (req, res) => {
  res.json(db.prepare('SELECT id, email, role, created_at FROM users WHERE tenant_id = ? ORDER BY created_at').all(me(req).tenant_id))
})

app.post('/api/team', requireAuth, requireRole('admin'), (req, res) => {
  const { email, password, role } = req.body ?? {}
  if (!email || !password) { res.status(400).json({ error: 'email and password are required' }); return }
  if (String(password).length < 6) { res.status(400).json({ error: 'password must be at least 6 characters' }); return }
  if (emailExists(email)) { res.status(400).json({ error: 'that email is already in use' }); return }
  const r = ROLES.includes(role) ? role : 'associate'
  const id = uid()
  try {
    db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, role) VALUES (?,?,?,?,?)')
      .run(id, me(req).tenant_id, String(email).toLowerCase(), hashPassword(String(password)), r)
    audit(me(req).tenant_id, me(req).id, 'team.add', id, { role: r })
    res.json({ id, role: r })
  } catch { res.status(400).json({ error: 'a user with that email already exists in this shop' }) }
})

app.patch('/api/team/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { role } = req.body ?? {}
  if (!ROLES.includes(role)) { res.status(400).json({ error: 'invalid role' }); return }
  if (role !== 'admin' && userRole(req.params.id, me(req).tenant_id) === 'admin' && adminCount(me(req).tenant_id) <= 1) {
    res.status(400).json({ error: 'cannot demote the last admin' }); return
  }
  const info = db.prepare('UPDATE users SET role = ? WHERE id = ? AND tenant_id = ?').run(role, req.params.id, me(req).tenant_id)
  audit(me(req).tenant_id, me(req).id, 'team.role', req.params.id, { role })
  res.json({ updated: info.changes })
})

app.delete('/api/team/:id', requireAuth, requireRole('admin'), (req, res) => {
  if (req.params.id === me(req).id) { res.status(400).json({ error: 'you cannot remove yourself' }); return }
  if (userRole(req.params.id, me(req).tenant_id) === 'admin' && adminCount(me(req).tenant_id) <= 1) {
    res.status(400).json({ error: 'cannot remove the last admin' }); return
  }
  const info = db.prepare('DELETE FROM users WHERE id = ? AND tenant_id = ?').run(req.params.id, me(req).tenant_id)
  audit(me(req).tenant_id, me(req).id, 'team.remove', req.params.id)
  res.json({ deleted: info.changes })
})

/* ---------------- designs ---------------- */

app.get('/api/designs', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT id, name, updated_at FROM designs WHERE tenant_id = ? ORDER BY updated_at DESC').all(me(req).tenant_id))
})

app.post('/api/designs', requireAuth, (req, res) => {
  const { name, spec, parent_id } = req.body ?? {}
  if (!name || !spec) { res.status(400).json({ error: 'name and spec required' }); return }
  const id = uid()
  db.prepare('INSERT INTO designs (id, tenant_id, owner_id, name, spec, parent_id) VALUES (?,?,?,?,?,?)')
    .run(id, me(req).tenant_id, me(req).id, name, JSON.stringify(spec), parent_id ?? null)
  audit(me(req).tenant_id, me(req).id, 'design.create', id)
  res.json({ id })
})

app.get('/api/designs/:id', requireAuth, (req, res) => {
  const r = db.prepare('SELECT * FROM designs WHERE id = ? AND tenant_id = ?').get(req.params.id, me(req).tenant_id) as { spec: string } | undefined
  if (!r) { res.status(404).json({ error: 'not found' }); return }
  res.json({ ...r, spec: JSON.parse(r.spec) })
})

app.delete('/api/designs/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM designs WHERE id = ? AND tenant_id = ?').run(req.params.id, me(req).tenant_id)
  res.json({ deleted: info.changes })
})

app.put('/api/designs/:id', requireAuth, (req, res) => {
  const { name, spec } = req.body ?? {}
  const info = db.prepare("UPDATE designs SET name = COALESCE(?, name), spec = COALESCE(?, spec), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
    .run(name ?? null, spec ? JSON.stringify(spec) : null, req.params.id, me(req).tenant_id)
  res.json({ updated: info.changes })
})

/* ---------------- cloud maker library (sculpts) ----------------
 * A shop's saved sculpts, tenant-scoped, so the library follows the maker across
 * devices. Tags are stored comma-joined. Everyone in the shop shares the library. */

app.get('/api/sculpts', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT id, name, tags, updated_at FROM sculpts WHERE tenant_id = ? ORDER BY updated_at DESC').all(me(req).tenant_id))
})

app.get('/api/sculpts/:id', requireAuth, (req, res) => {
  const r = db.prepare('SELECT id, name, tags, data, updated_at FROM sculpts WHERE id = ? AND tenant_id = ?').get(req.params.id, me(req).tenant_id) as { data: string } | undefined
  if (!r) { res.status(404).json({ error: 'not found' }); return }
  res.json({ ...r, data: JSON.parse(r.data) })
})

app.post('/api/sculpts', requireAuth, (req, res) => {
  const { name, tags, data } = req.body ?? {}
  if (!name || !data) { res.status(400).json({ error: 'name and data required' }); return }
  const id = uid()
  db.prepare('INSERT INTO sculpts (id, tenant_id, owner_id, name, tags, data) VALUES (?,?,?,?,?,?)')
    .run(id, me(req).tenant_id, me(req).id, String(name), Array.isArray(tags) ? tags.join(',') : (tags ?? null), JSON.stringify(data))
  audit(me(req).tenant_id, me(req).id, 'sculpt.save', id)
  res.json({ id })
})

app.delete('/api/sculpts/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM sculpts WHERE id = ? AND tenant_id = ?').run(req.params.id, me(req).tenant_id)
  res.json({ deleted: info.changes })
})

/* ---------------- customers (CRM) ---------------- */

app.get('/api/customers', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT id, name, email, phone, notes, created_at FROM customers WHERE tenant_id = ? ORDER BY name COLLATE NOCASE').all(me(req).tenant_id))
})

app.post('/api/customers', requireAuth, (req, res) => {
  const { name, email, phone, notes } = req.body ?? {}
  if (!name || !String(name).trim()) { res.status(400).json({ error: 'name required' }); return }
  const id = uid()
  db.prepare('INSERT INTO customers (id, tenant_id, name, email, phone, notes) VALUES (?,?,?,?,?,?)')
    .run(id, me(req).tenant_id, String(name).trim(), email ?? null, phone ?? null, notes ?? null)
  audit(me(req).tenant_id, me(req).id, 'customer.create', id)
  res.json({ id })
})

app.patch('/api/customers/:id', requireAuth, (req, res) => {
  const { name, email, phone, notes } = req.body ?? {}
  const info = db.prepare(
    'UPDATE customers SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), notes = COALESCE(?, notes) WHERE id = ? AND tenant_id = ?'
  ).run(name ? String(name).trim() : null, email ?? null, phone ?? null, notes ?? null, req.params.id, me(req).tenant_id)
  res.json({ updated: info.changes })
})

app.delete('/api/customers/:id', requireAuth, (req, res) => {
  // Detach from any orders first so the order history survives the customer.
  db.prepare('UPDATE orders SET customer_id = NULL WHERE customer_id = ? AND tenant_id = ?').run(req.params.id, me(req).tenant_id)
  const info = db.prepare('DELETE FROM customers WHERE id = ? AND tenant_id = ?').run(req.params.id, me(req).tenant_id)
  res.json({ deleted: info.changes })
})

/* ---------------- gallery (curated showcase) ---------------- */

// Everyone in the shop can view the active gallery; only admins curate it.
const requireAdmin = (req: Request, res: Response): boolean => {
  if (me(req).role !== 'admin') { res.status(403).json({ error: 'admin only' }); return false }
  return true
}

app.get('/api/gallery', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT id, title, subtitle, image, spec, created_at FROM gallery WHERE tenant_id = ? ORDER BY created_at DESC').all(me(req).tenant_id))
})

app.post('/api/gallery', requireAuth, (req, res) => {
  if (!requireAdmin(req, res)) return
  const { title, subtitle, image, spec } = req.body ?? {}
  if (!title || !String(title).trim()) { res.status(400).json({ error: 'title required' }); return }
  if (!image || !String(image).startsWith('data:image')) { res.status(400).json({ error: 'image required' }); return }
  const id = uid()
  db.prepare('INSERT INTO gallery (id, tenant_id, title, subtitle, image, spec, created_by) VALUES (?,?,?,?,?,?,?)')
    .run(id, me(req).tenant_id, String(title).trim(), subtitle ? String(subtitle).trim() : null, String(image), spec ? JSON.stringify(spec) : null, me(req).id)
  audit(me(req).tenant_id, me(req).id, 'gallery.add', id)
  res.json({ id })
})

app.delete('/api/gallery/:id', requireAuth, (req, res) => {
  if (!requireAdmin(req, res)) return
  const gid = String(req.params.id)
  const info = db.prepare('DELETE FROM gallery WHERE id = ? AND tenant_id = ?').run(gid, me(req).tenant_id)
  audit(me(req).tenant_id, me(req).id, 'gallery.delete', gid)
  res.json({ deleted: info.changes })
})

/* ---------------- quotes ---------------- */

app.post('/api/quotes', requireAuth, (req, res) => {
  const { design_id, total_cents, breakdown, expires_at } = req.body ?? {}
  const id = uid()
  const prev = db.prepare('SELECT MAX(version) v FROM quotes WHERE design_id = ?').get(design_id) as { v: number | null }
  const version = (prev?.v ?? 0) + 1
  db.prepare('INSERT INTO quotes (id, tenant_id, design_id, version, total_cents, breakdown, expires_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, me(req).tenant_id, design_id, version, total_cents, JSON.stringify(breakdown ?? {}), expires_at ?? null)
  res.json({ id, version })
})

/* ---------------- orders / pipeline ---------------- */

app.get('/api/orders', requireAuth, (req, res) => {
  // Join the design (name + whether it's a sculpt) and the customer so the order
  // list is directly useful without a second round trip. LEFT JOINs keep orders
  // whose design or customer was deleted. Both joins are tenant-scoped so a
  // crafted foreign id can't pull another shop's rows.
  res.json(db.prepare(`
    SELECT o.*, d.name AS design_name, c.name AS customer_name,
           CASE WHEN json_extract(d.spec, '$.kind') = 'sculpt' THEN 1 ELSE 0 END AS is_sculpt
    FROM orders o
    LEFT JOIN designs d ON d.id = o.design_id AND d.tenant_id = o.tenant_id
    LEFT JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
    WHERE o.tenant_id = ? ORDER BY o.created_at DESC
  `).all(me(req).tenant_id))
})

app.post('/api/orders', requireAuth, (req, res) => {
  const { design_id, quote_id, customer_id } = req.body ?? {}
  const id = uid()
  db.prepare('INSERT INTO orders (id, tenant_id, design_id, quote_id, customer_id) VALUES (?,?,?,?,?)')
    .run(id, me(req).tenant_id, design_id, quote_id ?? null, customer_id ?? null)
  res.json({ id, stage: 'designed' })
})

app.patch('/api/orders/:id/customer', requireAuth, (req, res) => {
  const { customer_id } = req.body ?? {}
  const info = db.prepare('UPDATE orders SET customer_id = ? WHERE id = ? AND tenant_id = ?')
    .run(customer_id ?? null, req.params.id, me(req).tenant_id)
  res.json({ updated: info.changes })
})

app.patch('/api/orders/:id/stage', requireAuth, (req, res) => {
  const { stage } = req.body ?? {}
  const approved = stage === 'approved'
  const info = db.prepare(`UPDATE orders SET stage = ?, approved_at = CASE WHEN ? THEN datetime('now') ELSE approved_at END WHERE id = ? AND tenant_id = ?`)
    .run(stage, approved ? 1 : 0, req.params.id, me(req).tenant_id)
  audit(me(req).tenant_id, me(req).id, 'order.stage', req.params.id, { stage })
  res.json({ updated: info.changes })
})

/* ---------------- subscription / access billing ---------------- */

// Which Stripe price + checkout mode each plan uses. Price ids come from env so
// the shop sets them in Render without a code change.
const PLAN_PRICE: Record<string, { mode: 'subscription' | 'payment'; env: string }> = {
  'studio-monthly': { mode: 'subscription', env: 'STRIPE_PRICE_MONTHLY' },
  'offline-lifetime': { mode: 'payment', env: 'STRIPE_PRICE_OFFLINE' },
}

// Comped accounts (owner/testing) that always pass the paywall without ever
// touching Stripe. Set the COMP_EMAILS env var on the server (comma-separated
// emails) — nothing to deploy from the client, and it can't be spoofed from
// there since this check runs server-side against the signed-in user's own
// looked-up email, never a value the client sends.
const compEmails = (process.env.COMP_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
const isCompedUser = (userId: string): boolean => {
  if (!compEmails.length) return false
  const u = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email?: string } | undefined
  return !!u?.email && compEmails.includes(u.email.toLowerCase())
}

// The signed-in shop's current billing state, shaped for the frontend gate.
app.get('/api/subscription', requireAuth, (req, res) => {
  if (isCompedUser(me(req).id)) { res.json({ status: 'active', planId: 'comp', offline: false }); return }
  const t = db.prepare(
    'SELECT subscription_status, subscription_plan, current_period_end, offline_purchase FROM tenants WHERE id = ?'
  ).get(me(req).tenant_id) as { subscription_status?: string; subscription_plan?: string; current_period_end?: number; offline_purchase?: number } | undefined
  res.json({
    status: t?.subscription_status ?? 'none',
    planId: t?.subscription_plan ?? undefined,
    currentPeriodEnd: t?.current_period_end ?? undefined,
    offline: !!t?.offline_purchase,
  })
})

// Start a Stripe Checkout for the chosen plan; returns the hosted-checkout URL.
app.post('/api/billing/checkout', requireAuth, async (req, res) => {
  try {
    const planId = String((req.body ?? {}).planId ?? '')
    const plan = PLAN_PRICE[planId]
    if (!plan) { res.status(400).json({ error: 'unknown plan' }); return }
    const priceId = process.env[plan.env] ?? ''
    const origin = process.env.CLIENT_ORIGIN && process.env.CLIENT_ORIGIN !== '*' ? process.env.CLIENT_ORIGIN : ''
    // Pass the signed-in user's own email so Stripe pre-fills checkout and —
    // more importantly — so the webhook can read it straight off the session
    // afterward to send the offline-download email to the right address.
    const buyer = db.prepare('SELECT email FROM users WHERE id = ?').get(me(req).id) as { email?: string } | undefined
    const session = await createCheckoutSession({
      mode: plan.mode,
      priceId,
      tenantId: me(req).tenant_id,
      planId,
      customerEmail: buyer?.email,
      successUrl: `${origin}/?billing=success`,
      cancelUrl: `${origin}/?billing=cancel`,
    })
    res.json({ url: session.url })
  } catch (e) {
    res.status(501).json({ error: (e as Error).message })
  }
})

// The desktop build itself lives in the repo at server/offline-dist/ (see the
// README there for how to (re)publish it) — this route just gates it behind
// the same billing state the paywall trusts, so the link only works for a
// shop that actually bought it (or the comped owner account, for testing).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Blue Flame → Mandrel rename (2026-08): prefer the new filename, but fall
// back to whatever Michael already published under the old name so existing
// offline builds keep working until he re-uploads under the new one.
const OFFLINE_ZIP_DIR = process.env.OFFLINE_ZIP_PATH
  ? path.dirname(process.env.OFFLINE_ZIP_PATH)
  : path.join(__dirname, '..', 'offline-dist')
const OFFLINE_ZIP_NEW = process.env.OFFLINE_ZIP_PATH ?? path.join(OFFLINE_ZIP_DIR, 'Mandrel-Offline.zip')
const OFFLINE_ZIP_LEGACY = path.join(OFFLINE_ZIP_DIR, 'BlueFlame-Offline.zip')
function resolveOfflineZip(): string {
  return fs.existsSync(OFFLINE_ZIP_NEW) ? OFFLINE_ZIP_NEW : OFFLINE_ZIP_LEGACY
}

app.get('/api/offline-download', requireAuth, (req, res) => {
  if (!isCompedUser(me(req).id)) {
    const t = db.prepare('SELECT offline_purchase FROM tenants WHERE id = ?').get(me(req).tenant_id) as { offline_purchase?: number } | undefined
    if (!t?.offline_purchase) { res.status(403).json({ error: 'no offline purchase on file for this shop' }); return }
  }
  const zip = resolveOfflineZip()
  if (!fs.existsSync(zip)) { res.status(503).json({ error: 'offline build not published yet — contact support' }); return }
  audit(me(req).tenant_id, me(req).id, 'offline.download')
  res.download(zip, 'Mandrel-Offline.zip')
})

/* ---------------- checkout (Stripe, optional) ---------------- */

app.post('/api/checkout', requireAuth, async (req, res) => {
  try {
    const { amount_cents, order_id, design_id } = req.body ?? {}
    // Bind the payment to a real order so the webhook can advance it. If none was
    // supplied, open one from the design so the shop has a record to track.
    let oid = order_id as string | undefined
    if ((!oid || oid === 'quote' || oid === 'adhoc') && design_id) {
      oid = uid()
      db.prepare('INSERT INTO orders (id, tenant_id, design_id, balance_cents) VALUES (?,?,?,?)')
        .run(oid, me(req).tenant_id, String(design_id), Number(amount_cents) || 0)
    }
    const pi = await createPaymentIntent(Number(amount_cents), { order_id: String(oid ?? 'adhoc'), tenant_id: me(req).tenant_id })
    res.json({ clientSecret: pi.client_secret, order_id: oid ?? null })
  } catch (e) {
    res.status(501).json({ error: (e as Error).message })
  }
})

const port = Number(process.env.PORT ?? 8787)
app.listen(port, () => console.log(`Mandrel API listening on http://localhost:${port}`))
