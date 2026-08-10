# Mandrel

Fine-jewelry design studio — a parametric configurator **and** a free-form 3D
sculptor, sharing one weight/cost engine, with an optional multi-tenant backend
for accounts, cloud sync, orders and payments.

Live 3D across five product categories with real sizing math and casting weights,
a per-alloy metal engine, an alloy-compounding Metal Lab, a free-form CSG modeler
with vertex sculpting, a production layer that exports print-ready STL and tech
sheets, and a first-run tour.

---

## Two workspaces

### Design — the parametric configurator
Pick a category and template, then tune size, metal, stone, setting, finish and
engraving. The 3D preview, finished weight and price update live. Nothing is
stored as a mesh — geometry, weight and cost are **derived** from one
`DesignSpec`, so changing any input reflows everything.

- **Five categories** — ring, pendant, earrings, bracelet, necklace.
- **22 templates** — solitaire variants, halo / double-halo / three-stone / pavé /
  channel / **eternity**, wedding & men's bands, studs, drops, tennis, bangle,
  cuff, chain, pendant necklace. All parametric.
- **26 stone types · 16 shapes · 25 metals · 12 settings**, with 4C stone grading
  (cut/color/clarity/carat) driving price and the live stone material.
- **Two-tone metals**, per-component alloys, metal-form (grain/sheet/wire/scrap)
  smelting weights, 7 finishes, engraving rendered on the model with a position
  slider.
- **Eternity bands** — stones set continuously around the band, no centre stone.
- **Attributes overlay** — a table on the left of the stage; remove or restore any
  rendered feature (it drops from render, weight and cost).
- **Wearability & compliance guardrails** — Mohs, prong-count, top-heavy shank,
  nickel disclosure, non-resizable warnings.

### Sculpt — the free-form 3D modeler
Jewelry parts (shank, prong head, gem, bezel) and primitives, moved with a gizmo
and combined with union / subtract / intersect (three-bvh-csg).

- **Free draw** — sketch a profile and **Revolve** it 360° or **Extrude** it into
  a solid.
- **Vertex sculpting** — "Make editable" bakes any part to a mesh; click a point
  and drag it with proportional falloff, **Mirror-X symmetry**, **Smooth**
  (grid-accelerated) and **Subdivide**.
- **Send ring → Sculpt** — push a whole configured ring (band + head + stone) in
  as an editable assembly.
- **Fuse metal** — boolean-union every metal part into one watertight solid.
- **Live estimate** — same engine as Design: metal + stones + setting + finish ×
  margin, plus **printability warnings** for thin sections.
- **Export** — print-ready STL and a bill-of-materials **tech sheet** PDF.

## The Metal Lab

Compound an alloy from pure metals and watch karat, fineness, **density** (exact,
inverse rule of mixtures), melt point, resulting **colour** and hallmark resolve
live, with disclosure notes. "Use in design" makes it the active metal.

## The four weights

"How much gold does this take" has four correct answers, and shops lose money
conflating them.

| Number | What it is | Who needs it |
|---|---|---|
| **Cast weight** | What comes out of the flask | The caster |
| **Finished weight** | After 7–13% disappears into filing and polishing | The client, the appraisal |
| **Metal to pour** | Piece + sprue + button + melt loss, ~1.7–2.0× cast | Purchasing |
| **Fine metal content** | Actual grams of Au/Ag/Pt inside the alloy | Spot pricing, refining |

Every design is costed **across all alloys at once** — same geometry, different
densities. Grams and pennyweight both supported.

## Save, sync, share

- **Autosave** — both workspaces persist to the browser and restore on refresh.
- **Libraries** — named saved designs (with fork + version history), named saved
  sculpts, and **projects** that bundle a design + sculpt together.
- **Undo / redo** — on both tabs, buttons + Ctrl/⌘+Z.
- **Share links** — a whole design encodes into a `?d=` URL that opens with no
  login.
- **Cloud** — when the backend is on, designs sync to your shop across devices.

## Backend (optional)

`server/` is a self-contained API — **Node's built-in SQLite**, scrypt password
hashing, JWT auth, multi-tenant schema, and optional **Stripe** checkout. It runs
locally with zero external services and deploys to Render via `render.yaml`. The
client is standalone until you set `VITE_API_URL`; login, cloud library and the
checkout screen then light up. See [`docs/deploy-backend.md`](docs/deploy-backend.md).

Seeded users: `mike` / `mike123` (admin) and `liliya` / `liliya123` (associate).

## Two things that are easy to get wrong

1. **A torus under-weighs a band by ~21%** (π/4 — an ellipse vs a near-rectangular
   section). The shank is modelled as cross-section area × centreline
   circumference. See `src/lib/volume.ts`.
2. **Castable resin is ~21% denser than injection wax.** Using the old wax
   multiplier on printed patterns under-orders metal every job. See
   `PATTERN_DENSITY` in `src/lib/metal.ts`.

---

## Stack

React 18 · TypeScript · Vite · React Three Fiber · three-bvh-csg · zustand ·
jsPDF · Vitest. Backend: Node (`node:sqlite`, `node:crypto`) · Express · JWT ·
optional Stripe.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 137 tests
npm run build

# optional backend
cd server && npm install && npm run seed && npm run start   # :8787
# then, from the repo root:
VITE_API_URL=http://localhost:8787 npm run dev
```

## Structure

```
src/
├── spec/types.ts        DesignSpec — the single source of truth (all categories)
├── catalog/             alloys, elements, shapes, stones, settings, finishes,
│                        grading, melee, forms, templates. Every row carries math.
├── lib/
│   ├── sizing · volume · metal · pricing   parametric sizing, four weights, cost
│   ├── sculpt · sculptDoc                   CSG, free-draw, vertex ops, estimate, tech sheet
│   ├── alloygen · bom · manufacture         Metal Lab, BOM, DFM checks
│   ├── library · autosave · share           save / fork / version, autosave, URL codec
│   └── api                                  optional backend client
├── viewer/              R3F scene, per-category geometry, modeler, vertex editor, STL
├── ui/                  controls, panels, Metal Lab, sketch pad, tour, overlays
├── state/               design · modeler · workspace · auth (zustand)
└── test/                golden fixtures + engine tests
server/                  Express + SQLite + JWT + optional Stripe (see server/README.md)
```

## Before this touches a client

Illustrative numbers to replace with live/supplier data: `Alloy.spot` /
`Alloy.perGram`, `StoneType.rate`, and the shop margin / fees (Design tab → cost
settings). Densities, mm factors and DFM thresholds should be verified by a
working jeweler.

## Docs

- [`docs/deploy-backend.md`](docs/deploy-backend.md) — Render + Stripe setup
- [`docs/metal-weight.md`](docs/metal-weight.md) — every formula, with tables
- [`docs/build-plan.md`](docs/build-plan.md) — phase map and architecture
- [`docs/feature-spec.md`](docs/feature-spec.md) — full feature specification
