/**
 * Client presentation sheet — a self-contained HTML one-pager a maker hands to a
 * customer: the render, the specification, and the price. Everything inline so it
 * opens anywhere and prints clean. Content comes from the same estimate and
 * measurements the bench sees, so the sheet never disagrees with the quote.
 */

export interface ClientSheetInput {
  brand: string
  name: string
  imageDataUrl?: string
  specs: [string, string][]     // label, value
  priceLines: [string, string][] // label, amount
  total: string
  validDays?: number
  today?: string
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

export function clientSheetHtml(input: ClientSheetInput): string {
  const { brand, name, imageDataUrl, specs, priceLines, total, validDays = 14, today = '' } = input
  const specRows = specs.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('')
  const priceRows = priceLines.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v num">${esc(v)}</td></tr>`).join('')
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brand)} — ${esc(name)}</title>
<style>
  :root{--ink:#1B2024;--muted:#6C737D;--line:#E6E8EC;--accent:#1F8A6B;--paper:#fff}
  *{box-sizing:border-box}
  body{margin:0;background:#F4F6F8;color:var(--ink);font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  .sheet{max-width:760px;margin:28px auto;background:var(--paper);border:1px solid var(--line);border-radius:14px;overflow:hidden}
  header{display:flex;align-items:baseline;justify-content:space-between;padding:22px 28px;border-bottom:1px solid var(--line)}
  header .brand{font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:14px}
  header .date{color:var(--muted);font-size:12px}
  .hero{background:#0E1113;display:flex;align-items:center;justify-content:center;min-height:220px}
  .hero img{max-width:100%;max-height:420px;display:block}
  .hero.empty{color:#67707a;font-size:13px;min-height:120px}
  h1{font-size:22px;margin:22px 28px 4px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;padding:8px 28px 22px}
  h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}
  table{width:100%;border-collapse:collapse}
  td{padding:5px 0;border-bottom:1px solid var(--line);vertical-align:top}
  td.k{color:var(--muted);padding-right:12px;white-space:nowrap}
  td.v{text-align:right;font-variant-numeric:tabular-nums}
  .total{display:flex;justify-content:space-between;align-items:baseline;margin:6px 28px 0;padding:12px 0;border-top:2px solid var(--ink);font-weight:700}
  .total .amt{font-size:20px}
  footer{padding:16px 28px 26px;color:var(--muted);font-size:12px}
  @media print{body{background:#fff}.sheet{border:none;margin:0}}
  @media(max-width:640px){.cols{grid-template-columns:1fr}}
</style></head>
<body><div class="sheet">
  <header><span class="brand">${esc(brand)}</span><span class="date">${esc(today)}</span></header>
  ${imageDataUrl ? `<div class="hero"><img src="${imageDataUrl}" alt="${esc(name)}"></div>` : `<div class="hero empty">Render preview</div>`}
  <h1>${esc(name)}</h1>
  <div class="cols">
    <div><h2>Specification</h2><table>${specRows}</table></div>
    <div><h2>Price</h2><table>${priceRows}</table></div>
  </div>
  <div class="total"><span>Total</span><span class="amt">${esc(total)}</span></div>
  <footer>Made to order from a custom model. This price holds for ${validDays} days — precious metal is quoted at current market and moves daily. Final weight may vary slightly after casting and finishing.</footer>
</div></body></html>`
}
