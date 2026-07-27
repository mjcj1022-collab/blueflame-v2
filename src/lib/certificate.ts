import type { SculptObject } from '../state/modeler'
import { alloyById, stoneById } from '../catalog'
import { sculptEstimate } from './sculpt'
import { mmForCarat } from './stoneSize'
import { skuFor } from './sku'
import { gToDwt } from './units'

/**
 * Certificate of authenticity. The keepsake document that goes with a handmade
 * piece — what it is, what it's made of, that it was made by hand, and by whom.
 * Not a valuation (that's the appraisal); a statement of authenticity the customer
 * keeps. Self-contained HTML, styled to print like a certificate.
 */

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

export function certificateHtml(brand: string, name: string, objects: SculptObject[], alloyId: string, dateStr = ''): string {
  const alloy = alloyById(alloyId)
  const est = sculptEstimate(objects, alloyId)
  const gems = objects.filter(o => o.kind === 'gem')
  const stoneRows = gems.map(g => {
    const st = stoneById(g.params?.stoneTypeId ?? 'dia')
    const ct = g.params?.carat ?? 0
    const mm = mmForCarat(g.params?.shapeId ?? 'rd', g.params?.stoneTypeId ?? 'dia', ct).width
    return `<tr><td>${esc(st.name)}${st.treatment ? ` · ${esc(st.treatment)}` : ''}</td><td>${ct.toFixed(2)} ct · ${mm.toFixed(2)} mm</td></tr>`
  }).join('')

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand)} — Certificate</title><style>
 :root{--ink:#1B2024;--muted:#6C737D;--line:#D8C9A6;--gold:#1F8A6B}
 body{margin:0;background:#EFECE4;color:var(--ink);font:15px/1.6 Georgia,'Times New Roman',serif}
 .cert{max-width:720px;margin:28px auto;background:#fff;border:2px solid var(--line);border-radius:6px;padding:38px 44px;box-shadow:0 2px 20px rgba(0,0,0,.06)}
 .frame{border:1px solid var(--line);padding:30px 34px}
 .brand{text-align:center;letter-spacing:.28em;text-transform:uppercase;font-size:14px;color:var(--muted)}
 h1{text-align:center;font-size:26px;margin:8px 0 2px;letter-spacing:.02em}
 .rule{width:70px;height:2px;background:var(--gold);margin:12px auto 20px}
 .lede{text-align:center;color:var(--muted);font-style:italic;margin:0 0 22px}
 table{width:100%;border-collapse:collapse;margin:6px 0}
 td{padding:7px 0;border-bottom:1px solid #Eee;vertical-align:top} td:first-child{color:var(--muted)}
 .sign{display:flex;justify-content:space-between;margin-top:34px;gap:24px}
 .sign div{flex:1;border-top:1px solid var(--ink);padding-top:6px;font-size:12px;color:var(--muted);text-align:center}
 @media print{body{background:#fff}.cert{border:none;margin:0;box-shadow:none}}
</style></head><body><div class="cert"><div class="frame">
 <div class="brand">${esc(brand)}</div>
 <h1>Certificate of Authenticity</h1>
 <div class="rule"></div>
 <p class="lede">This certifies that the piece described below was designed and handcrafted by ${esc(brand)}.</p>
 <table>
   <tr><td>Piece</td><td>${esc(name)}</td></tr>
   <tr><td>Style №</td><td>${esc(skuFor(objects, alloyId))}</td></tr>
   <tr><td>Metal</td><td>${esc(alloy.name)} · ${(alloy.fine * 100).toFixed(1)}% ${esc(alloy.symbol)} · ${alloy.hallmark}</td></tr>
   <tr><td>Weight</td><td>${est.castG.toFixed(2)} g (${gToDwt(est.castG).toFixed(2)} dwt)</td></tr>
   ${stoneRows}
 </table>
 <div class="sign">
   <div>Maker</div>
   <div>Date${dateStr ? ` — ${esc(dateStr)}` : ''}</div>
 </div>
</div></div></body></html>`
}
