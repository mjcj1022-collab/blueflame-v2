import { DatabaseSync } from 'node:sqlite'
import { existsSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Embedded SQLite — no external database to provision. The file lives beside
// the server. For production scale, swap to Postgres (schema.sql mirrors this).
const DB_FILE = process.env.DB_FILE ?? 'mandrel.db'

// Blue Flame → Mandrel rename (2026-08): an existing deployment may still have
// its data under the old 'blueflame.db' filename. If nothing exists yet under
// the new name, rename the old file (and its WAL/SHM siblings) in place so no
// production data is lost — this only runs once, the first time it applies.
try {
  if (!existsSync(DB_FILE)) {
    const legacy = DB_FILE.includes('mandrel.db')
      ? DB_FILE.replace('mandrel.db', 'blueflame.db')
      : join(dirname(DB_FILE), 'blueflame.db')
    if (existsSync(legacy)) {
      renameSync(legacy, DB_FILE)
      for (const suffix of ['-wal', '-shm']) {
        if (existsSync(legacy + suffix)) renameSync(legacy + suffix, DB_FILE + suffix)
      }
    }
  }
} catch { /* best-effort — worst case a fresh db is created under the new name */ }

export const db = new DatabaseSync(DB_FILE)

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS tenants (
    id text PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    markup real NOT NULL DEFAULT 1.35,
    created_at text NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL DEFAULT 'associate',
    created_at text NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tenant_id, email)
  );

  CREATE TABLE IF NOT EXISTS designs (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    owner_id text,
    name text NOT NULL,
    spec text NOT NULL,
    parent_id text,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    design_id text NOT NULL,
    version integer NOT NULL DEFAULT 1,
    total_cents integer NOT NULL,
    breakdown text NOT NULL,
    expires_at text,
    created_at text NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    design_id text NOT NULL,
    quote_id text,
    stage text NOT NULL DEFAULT 'designed',
    approved_at text,
    stripe_payment_intent text,
    deposit_cents integer,
    balance_cents integer,
    created_at text NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id integer PRIMARY KEY AUTOINCREMENT,
    tenant_id text NOT NULL,
    actor_id text,
    action text NOT NULL,
    target text,
    detail text,
    created_at text NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    notes text,
    created_at text NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers (tenant_id);

  CREATE TABLE IF NOT EXISTS gallery (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    title text NOT NULL,
    subtitle text,
    image text NOT NULL,
    spec text,
    created_by text,
    created_at text NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_gallery_tenant ON gallery (tenant_id);

  -- Cloud maker library: sculpts (with tags) synced across a shop's devices.
  CREATE TABLE IF NOT EXISTS sculpts (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    owner_id text,
    name text NOT NULL,
    tags text,
    data text NOT NULL,
    updated_at text NOT NULL DEFAULT (datetime('now')),
    created_at text NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sculpts_tenant ON sculpts (tenant_id);

  -- Affiliate program: one shop (tenant) hands out ?ref=CODE links so other
  -- shops sign up through them. 'rate' is a fraction (0.2 = 20%) of whatever
  -- the referred shop pays Mandrel. Credits are logged individually so
  -- earned/pending totals and a conversion count can be computed on read.
  CREATE TABLE IF NOT EXISTS affiliates (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    code text UNIQUE NOT NULL,
    name text,
    email text,
    rate real NOT NULL DEFAULT 0.2,
    active integer NOT NULL DEFAULT 1,
    created_at text NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_affiliates_tenant ON affiliates (tenant_id);

  CREATE TABLE IF NOT EXISTS affiliate_credits (
    id text PRIMARY KEY,
    affiliate_id text NOT NULL,
    tenant_id text NOT NULL,
    event text NOT NULL,
    amount_cents integer NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at text NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_affiliate_credits_affiliate ON affiliate_credits (affiliate_id);
`)

// Link orders to a customer. Additive on an existing database (the column may
// already be present), so the ALTER is guarded.
try { db.exec('ALTER TABLE orders ADD COLUMN customer_id text') } catch { /* column already exists */ }

// Billing: a shop's subscription / one-time-purchase state lives on the tenant.
// Additive + guarded so it applies cleanly to an existing database.
for (const col of [
  "subscription_status text NOT NULL DEFAULT 'none'",  // none|active|trialing|past_due|canceled
  'subscription_plan text',
  'current_period_end integer',                        // epoch ms the paid period runs through
  'stripe_customer_id text',
  'stripe_subscription_id text',
  'offline_purchase integer NOT NULL DEFAULT 0',       // 1 = bought the offline build outright
  'offline_purchase_email text',                       // where the download email was sent
  'referred_by_affiliate_id text',                     // set at signup from ?ref=CODE, if any
]) {
  try { db.exec(`ALTER TABLE tenants ADD COLUMN ${col}`) } catch { /* column already exists */ }
}

export const uid = (): string => globalThis.crypto.randomUUID()

export function audit(tenantId: string, actorId: string | null, action: string, target?: string, detail?: unknown): void {
  db.prepare('INSERT INTO audit_log (tenant_id, actor_id, action, target, detail) VALUES (?,?,?,?,?)')
    .run(tenantId, actorId, action, target ?? null, detail ? JSON.stringify(detail) : null)
}
