import type { MultiView } from './capture'

/**
 * Multi-view sheet. The three technical views (front / side / top) laid out on one
 * self-contained HTML page with the piece's key dimensions — the reference a maker
 * pins up or sends alongside the CAD. Complements the single-hero client sheet.
 */

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

export interface MultiViewInput {
  brand: string
  name: string
  dims: [number, number, number]   // overall W×H×D mm
  ringSize?: number
}

export function multiViewHtml(views: MultiView, input: MultiViewInput): string {
  const { brand, name, dims, ringSize } = input
  const tile = (label: string, src: string) =>
    `<figure><img src="${src}" alt="${esc(label)}"><figcaption>${esc(label)}</figcaption></figure>`
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand)} — ${esc(name)} views</title><style>
 :root{--ink:#1B2024;--muted:#6C737D;--line:#E6E8EC}
 body{margin:0;background:#F4F6F8;color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
 .sheet{max-width:900px;margin:26px auto;background:#fff;border:1px solid var(--line);border-radius:14px;padding:24px 28px}
 header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:16px}
 .brand{font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:13px}
 .dims{color:var(--muted);font-size:13px}
 .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
 figure{margin:0} img{width:100%;background:#0E1113;border-radius:10px;display:block;aspect-ratio:1/1;object-fit:contain}
 figcaption{text-align:center;color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-top:6px}
 @media print{body{background:#fff}.sheet{border:none;margin:0}}
 @media(max-width:680px){.grid{grid-template-columns:1fr}}
</style></head><body><div class="sheet">
 <header><span class="brand">${esc(brand)}</span><span class="dims">${dims[0].toFixed(1)} × ${dims[1].toFixed(1)} × ${dims[2].toFixed(1)} mm${ringSize != null ? ` · US ${ringSize}` : ''}</span></header>
 <h1 style="font-size:20px;margin:0 0 14px">${esc(name)}</h1>
 <div class="grid">${tile('Front', views.front)}${tile('Side', views.side)}${tile('Top', views.top)}</div>
</div></body></html>`
}
