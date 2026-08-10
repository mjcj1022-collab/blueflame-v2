# Deploy the Mandrel backend (Render) and connect the live site

The app runs standalone today. This turns on the **backend** so the live site
gets real accounts, cloud-synced designs, orders and (optionally) payments.
~15 minutes. You do the account steps — Claude never handles your keys.

---

## 1. Push the code (already done)

The backend lives in `server/`; the `render.yaml` blueprint sits at the repo
root (where Render's Blueprint feature looks for it).

## 2. Create the service on Render

1. Sign in at **https://render.com** (free tier is fine).
2. **New → Blueprint** → connect the `mandrel` GitHub repo → Render reads
   `render.yaml` (repo root) and proposes the **mandrel-api** web service.
3. Click **Apply**. Render runs `npm install`, seeds the shop + `mike`/`liliya`,
   and starts the API. `JWT_SECRET` is generated for you; a 1 GB disk keeps the
   SQLite file across restarts.
4. When it's live, copy the URL, e.g. `https://mandrel-api.onrender.com`.
   Check `…/api/health` returns `{ ok: true }`.

> Free web services sleep after ~15 min idle and cold-start in a few seconds —
> fine for a shop tool. Drop the `disk:` block for a pure-ephemeral test
> instance, or swap to Render Postgres later for scale.

## 3. Point the live site at it

1. GitHub → the repo → **Settings → Secrets and variables → Actions →
   Variables → New repository variable**.
2. Name **`VITE_API_URL`**, value your Render URL (no trailing slash):
   `https://mandrel-api.onrender.com`
3. Re-run the deploy: **Actions → Deploy to GitHub Pages → Run workflow** (or
   just push any commit). The client rebuilds pointed at the backend.

Now the live login authenticates against the server and the library
cloud-syncs. Leaving `VITE_API_URL` unset keeps the app standalone.

## 4. (Optional) Payments with Stripe

The checkout screen **is built**. A **Take payment** button appears in the Quote
panel — but only once *both* keys below are set. Until then the app is quote-only
and the button stays hidden (the client never sees a secret key).

**Server (secret key):**
1. Create a **Stripe** account → Developers → API keys → copy the **test**
   secret key (`sk_test_…`).
2. In Render → mandrel-api → **Environment**, add `STRIPE_SECRET_KEY`.
3. In `server/`, add the dep once: `npm i stripe` and commit.
   `/api/checkout` now mints a real PaymentIntent client secret.

**Client (publishable key):**
4. From the same Stripe keys page copy the **publishable** key (`pk_test_…`).
5. GitHub → repo → **Settings → Secrets and variables → Actions → Variables →
   New repository variable**: name `VITE_STRIPE_PK`, value `pk_test_…`.
6. Re-run the deploy (Actions → Run workflow, or push any commit). The build now
   loads Stripe.js and renders the card form.

Test card: `4242 4242 4242 4242`, any future expiry, any CVC. Switch both keys
to `sk_live_…` / `pk_live_…` when you're ready to take real money.

**Webhook (auto-advance orders on payment):**
The API exposes `POST /api/webhook`. When a payment settles, Stripe calls it and
the server advances the linked order to **Approved** and records the payment.
7. Stripe → **Developers → Webhooks → Add endpoint**. URL:
   `https://mandrel-api.onrender.com/api/webhook`. Events: **`payment_intent.succeeded`**.
8. Copy the endpoint's **Signing secret** (`whsec_…`).
9. Render → mandrel-api → **Environment**, add `STRIPE_WEBHOOK_SECRET`.

Now a completed checkout (the client "Take payment") opens/settles an order and
moves it to Approved automatically — the order pipeline advances itself. The
endpoint verifies Stripe's signature against the raw body and is idempotent, so
duplicate deliveries are safe. Test locally with `stripe listen --forward-to
localhost:8787/api/webhook` and `stripe trigger payment_intent.succeeded`.

## Test users

`mike` / `mike123` (admin) and `liliya` / `liliya123` (associate) — seeded on
first boot. Change or add users via `/api/auth/register`, or edit
`server/src/seed.ts`.

## Local run (no hosting)

```bash
cd server && npm install && npm run seed && npm run start   # :8787
# then, from the repo root:
VITE_API_URL=http://localhost:8787 npm run dev              # :5173
```
