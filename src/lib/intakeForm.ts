/**
 * Custom-job intake form. The questionnaire a maker gives a customer at the start
 * of a commission — occasion, budget, finger size, metal and stone preferences,
 * inspiration and deadline. Captures the brief up front so nothing's missed. A
 * printable, self-contained HTML form; the shop fills or hands it over.
 */

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

const FIELDS: [string, string][] = [
  ['Name', 'text'], ['Phone / email', 'text'], ['Occasion', 'text'],
  ['Piece type', 'ring / pendant / earrings / bracelet / necklace'],
  ['For whom (and finger/wrist size)', 'text'],
  ['Budget range', 'text'],
  ['Metal preference', 'yellow / white / rose gold · platinum · silver'],
  ['Centre stone', 'diamond / sapphire / other — shape & size'],
  ['Accent stones', 'yes / no — details'],
  ['Engraving', 'text / date / none'],
  ['Inspiration / must-haves', 'text'],
  ['Deadline', 'date'],
]

export function intakeFormHtml(brand: string): string {
  const rows = FIELDS.map(([label, hint]) => `
   <div class="field">
     <label>${esc(label)}</label>
     <div class="line"></div>
     <small>${esc(hint)}</small>
   </div>`).join('')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand)} — Custom Intake</title><style>
 :root{--ink:#1B2024;--muted:#6C737D;--line:#C9CDD3;--accent:#1F8A6B}
 body{margin:0;background:#F4F6F8;color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
 .sheet{max-width:720px;margin:26px auto;background:#fff;border:1px solid #E6E8EC;border-radius:14px;padding:28px 32px}
 .brand{font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:13px}
 h1{font-size:22px;margin:10px 0 2px} .sub{color:var(--muted);margin:0 0 18px}
 .field{margin:16px 0} label{font-size:12px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}
 .line{height:24px;border-bottom:1px solid var(--line);margin-top:6px}
 small{color:var(--muted)}
 @media print{body{background:#fff}.sheet{border:none;margin:0}}
</style></head><body><div class="sheet">
 <span class="brand">${esc(brand)}</span>
 <h1>Custom Piece — Intake</h1>
 <p class="sub">Tell us about the piece you have in mind and we'll design it with you.</p>
 ${rows}
</div></body></html>`
}
