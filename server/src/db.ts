import { DatabaseSync } from 'node:sqlite'

// Embedded SQLite — no external database to provision. The file lives beside
// the server. For production scale, swap to Postgres (schema.sql mirrors this).
export const db = new DatabaseSync(process.env.DB_FILE ?? 'blueflame.db')

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
]) {
  try { db.exec(`ALTER TABLE tenants ADD COLUMN ${col}`) } catch { /* column already exists */ }
}

export const uid = (): string => globalThis.crypto.randomUUID()

export function audit(tenantId: string, actorId: string | null, action: string, target?: string, detail?: unknown): void {
  db.prepare('INSERT INTO audit_log (tenant_id, actor_id, action, target, detail) VALUES (?,?,?,?,?)')
    .run(tenantId, actorId, action, target ?? null, detail ? JSON.stringify(detail) : null)
}
