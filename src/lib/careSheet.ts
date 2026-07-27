import type { SculptObject } from '../state/modeler'
import { alloyById, stoneById } from '../catalog'

/**
 * Consumer care sheet. The one-pager a maker hands over WITH the piece: how to
 * clean it, what to avoid, and any per-stone cautions — built from the same metal
 * and Mohs/care data the bench uses, so the advice is specific to what was made,
 * not a generic leaflet. Self-contained HTML; prints clean.
 */

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

export function careLines(objects: SculptObject[], alloyId: string): { general: string[]; stones: [string, string][] } {
  const alloy = alloyById(alloyId)
  const general: string[] = [
    `Metal: ${alloy.name}. Clean with warm water, mild soap and a soft brush; dry with a lint-free cloth.`,
  ]
  if (alloy.platable) general.push('White metal is rhodium-plated — plating wears with time and can be refreshed; avoid harsh chemicals and chlorine (pools, hot tubs).')
  general.push('Store separately so pieces don’t scratch each other. Remove for sport, cleaning and heavy work.')

  const seen = new Set<string>()
  const stones: [string, string][] = []
  let anyUltrasonicUnsafe = false
  for (const o of objects) {
    if (o.kind !== 'gem') continue
    const st = stoneById(o.params?.stoneTypeId ?? 'dia')
    if (seen.has(st.id)) continue
    seen.add(st.id)
    const note = st.care ?? (st.mohs >= 8 ? 'Hard and durable; a warm soapy soak keeps it bright.' : 'Softer stone — avoid knocks and abrasives; wipe with a soft damp cloth.')
    if (st.care && /ultrasonic/i.test(st.care)) anyUltrasonicUnsafe = true
    stones.push([`${st.name} (Mohs ${st.mohs})`, note])
  }
  if (anyUltrasonicUnsafe) general.push('Do NOT ultrasonic- or steam-clean this piece — one or more stones can be damaged. Hand clean only.')
  return { general, stones }
}

export function careSheetHtml(brand: string, name: string, objects: SculptObject[], alloyId: string): string {
  const { general, stones } = careLines(objects, alloyId)
  const gen = general.map(g => `<li>${esc(g)}</li>`).join('')
  const st = stones.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand)} — Care</title><style>
 :root{--ink:#1B2024;--muted:#6C737D;--line:#E6E8EC;--accent:#1F8A6B}
 body{margin:0;background:#F4F6F8;color:var(--ink);font:15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
 .sheet{max-width:680px;margin:28px auto;background:#fff;border:1px solid var(--line);border-radius:14px;padding:26px 30px}
 .brand{font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:13px}
 h1{font-size:22px;margin:14px 0 2px} .sub{color:var(--muted);font-size:13px;margin:0 0 16px}
 h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:20px 0 6px}
 ul{margin:0;padding-left:18px} li{margin:5px 0}
 table{width:100%;border-collapse:collapse} td{padding:6px 0;border-bottom:1px solid var(--line);vertical-align:top} td.k{color:var(--accent);white-space:nowrap;padding-right:14px;font-weight:600}
 @media print{body{background:#fff}.sheet{border:none;margin:0}}
</style></head><body><div class="sheet">
 <span class="brand">${esc(brand)}</span>
 <h1>Caring for your ${esc(name)}</h1>
 <p class="sub">Made by hand — a little care keeps it beautiful for a lifetime.</p>
 <h2>Everyday care</h2><ul>${gen}</ul>
 ${st ? `<h2>Your stones</h2><table>${st}</table>` : ''}
</div></body></html>`
}
