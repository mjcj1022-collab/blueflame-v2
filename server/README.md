# Mandrel — backend

Commerce, accounts, orders and the multi-tenant API. **This runs today** on
embedded SQLite with real password auth — no external database to provision.
Stripe (payments) and Postgres (scale) are optional upgrades.

## Run it locally (works now)

```bash
cd server
npm install
npm run seed     # creates the "Mandrel" shop + users mike / liliya
npm run start    # http://localhost:8787/api/health
```

Data lives in `server/mandrel.db` (SQLite file, gitignored; auto-migrated
from the old `blueflame.db` if that file still exists). That's it — no
database server, no accounts. Verified end to end: register/login (scrypt +
JWT), save/list designs, quotes, orders with an approval timestamp, and
tenant-scoped, auth-gated access.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/health` | liveness |
| POST | `/api/auth/register` | create a shop (tenant) + admin user → token |
| POST | `/api/auth/login` | email + password → JWT |
| GET  | `/api/me` | current user + tenant |
| GET/POST/PUT | `/api/designs[/:id]` | save / list / load / update designs (DesignSpec JSON) |
| POST | `/api/quotes` | versioned quote with expiry |
| GET/POST | `/api/orders` | list / open orders |
| PATCH| `/api/orders/:id/stage` | advance pipeline (records approval time) |
| POST | `/api/checkout` | Stripe payment intent (needs a key — see below) |

## Wire the client to it

The client ships a helper at `src/lib/api.ts`. Set the API base at build time:

```bash
# in the client (repo root)
VITE_API_URL=http://localhost:8787 npm run dev
```

The DesignSpec already serializes cleanly (it's what `share.ts` encodes), so the
client posts it as-is. Swap the localStorage library/orders for these endpoints
when you're ready.

## Going public (for the live site)

The deployed client on GitHub Pages can't reach `localhost`. To make the **live**
site transactional:

1. **Host this server** — Render, Railway or Fly.io all have a free tier. Point
   it at a persistent disk (for the SQLite file) or a managed Postgres.
2. Rebuild the client with `VITE_API_URL=https://your-api.example.com`.
3. **Payments:** create a Stripe account, `npm i stripe`, set `STRIPE_SECRET_KEY`
   (test key first). `/api/checkout` then returns a real client secret.

Claude does not handle your keys — you set them in `.env` yourself.

## Notes

- Passwords: scrypt via `node:crypto` (no native deps). JWT via `JWT_SECRET`.
- SQLite via `node:sqlite` (built into Node 22+). For scale, port to Postgres —
  the SQL is standard.
- Multi-tenant: every row is scoped to a `tenant`; roles (client / associate /
  cad / production / admin) gate access via `requireRole(...)`.
