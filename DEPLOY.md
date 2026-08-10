# Going live

The **front end is already live** on GitHub Pages and runs standalone (soft
login, local saves). To make it *transactional* — real accounts, saved designs,
orders, and (optionally) card payments — deploy the backend and point the site
at it.

You do the account/secret steps yourself; nothing here asks anyone else to
enter your keys.

---

## 1 · Deploy the backend on Render (free)

1. Go to **render.com** → **New → Blueprint**.
2. Connect this GitHub repo. Render reads [`render.yaml`](render.yaml) and creates
   a service called **mandrel-api** on the free plan.
3. Click **Apply** and wait for the first deploy (~2–3 min).
4. Copy the service URL, e.g. `https://mandrel-api.onrender.com`.
5. Verify it: open **`<that URL>/api/health`** — you should see
   `{"ok":true,"service":"mandrel",...}`.

`JWT_SECRET` is generated for you. `CLIENT_ORIGIN` is preset to the GitHub Pages
origin. Node is pinned to 24 (needed for the built-in SQLite).

> Free-tier notes: the service sleeps after ~15 min idle (first request wakes it,
> ~30 s cold start), and the SQLite file resets on each redeploy — the demo users
> re-seed automatically, but saved orders won't persist. To keep data, follow the
> "Persistent data" comment at the bottom of `render.yaml` (needs a paid plan).

## 2 · Point the live site at the backend

1. GitHub repo → **Settings → Secrets and variables → Actions → Variables**.
2. **New repository variable**: `VITE_API_URL` = your Render URL from step 1.4.
3. Re-deploy the site: **Actions → "Deploy to GitHub Pages" → Run workflow**
   (or just push any commit).

The live site now uses real backend auth. Log in with **mike / mike123** (admin)
or **liliya / liliya123** (associate).

## 3 · (Optional) Turn on Stripe card payments

Do this only when you want real checkout. Use **test** keys first.

1. **Stripe → Developers → API keys**: copy the **Publishable** (`pk_…`) and
   **Secret** (`sk_…`) keys.
2. **Render → mandrel-api → Environment**: set `STRIPE_SECRET_KEY` = `sk_…`
   → Save (it redeploys).
3. **GitHub → Actions Variables**: add `VITE_STRIPE_PK` = `pk_…` → re-run the
   deploy workflow. The checkout screen now appears.
4. **Webhook** (marks orders paid): **Stripe → Developers → Webhooks → Add
   endpoint** → URL `https://<your-render-url>/api/webhook`, event
   `payment_intent.succeeded`. Copy its **signing secret** (`whsec_…`) and set
   `STRIPE_WEBHOOK_SECRET` in Render → Environment → Save.

---

## Redeploying (push from PowerShell)

The front end redeploys on every push to `main`. The API does **not**, because it
was connected by public URL rather than through Render's GitHub App. Pick one:

**A · Auto-deploy, no secrets (simplest).** Grant Render's GitHub App access to
this repo: Render → *mandrel-api* → Settings → Repository → connect it (or
GitHub → Settings → Applications → Render → grant `mandrel`). After that
`git push` deploys **both** halves and nothing else is needed.

```powershell
git push          # front end + API both redeploy
```

**B · Deploy hook (scriptable, one secret you create).** Render →
*mandrel-api* → Settings → **Deploy Hook** → copy the URL. Then either:

*Fire it straight from PowerShell:*
```powershell
Invoke-RestMethod -Method Post $env:RENDER_DEPLOY_HOOK
```

*Or wire it into CI so a push does it* — add the URL as repo secret
`RENDER_DEPLOY_HOOK` (Settings → Secrets and variables → Actions → **Secrets**).
The `api` job in [deploy.yml](.github/workflows/deploy.yml) picks it up
automatically; with no secret set it just skips.

> The hook URL is a credential — keep it in a secret/env var, never in the repo.

**Check what's live at any time:**
```powershell
Invoke-RestMethod https://mandrel-api.onrender.com/api/health
```

---

## What talks to what

| Piece | Where it lives | Config it needs |
|---|---|---|
| Front end | GitHub Pages (auto-deploys on push to `main`) | `VITE_API_URL`, `VITE_STRIPE_PK` (repo Variables) |
| API | Render (`render.yaml`) | `JWT_SECRET` (auto), `CLIENT_ORIGIN`, `STRIPE_*` (optional) |
| Database | SQLite file on the API host | `DB_FILE` (free = ephemeral; paid disk = persistent) |

Health check any time: `GET /api/health`. Local dev: `cd server && npm install &&
npm run seed && npm run dev` (needs Node ≥ 23.4).

<!-- deploy pipeline verified: front end via Pages, API via Render auto-deploy on push -->

<!-- auto-deploy test 2 -->
