import { useState } from 'react'
import { useDesign } from '../state/design'
import { computeBom } from '../lib/bom'
import { manufacturabilityChecks, checkSummary } from '../lib/manufacture'
import { downloadStl } from '../viewer/exportStl'
import { heroImage } from '../viewer/capture'
import { downloadTechPack } from '../lib/techpack'
import { money } from '../lib/units'

export function ProductionPanel() {
  const spec = useDesign(s => s.spec)
  const shop = useDesign(s => s.shop)
  const bom = computeBom(spec)
  const checks = manufacturabilityChecks(spec)
  const sum = checkSummary(checks)
  const [stlMsg, setStlMsg] = useState('')

  const exportStl = () => {
    const ok = downloadStl(spec, `mandrel-${spec.category}-${Date.now()}.stl`)
    setStlMsg(ok ? 'STL downloaded — metal only, true millimetres.' : 'Viewer not ready — rotate the model once and retry.')
    setTimeout(() => setStlMsg(''), 4000)
  }

  const techPack = () => {
    downloadTechPack(spec, shop.name, heroImage(1.5))
    setStlMsg('Tech pack PDF downloaded — spec, castability, BOM, and a render.')
    setTimeout(() => setStlMsg(''), 4000)
  }

  return (
    <div className="panel-block production">
      <h4>Manufacturability
        <span className="mfg-sum">
          {sum.fail > 0 && <b className="bad">{sum.fail} fail</b>}
          {sum.warn > 0 && <b className="warn">{sum.warn} warn</b>}
          <b className="ok">{sum.pass} pass</b>
        </span>
      </h4>
      {checks.length === 0 && <p className="disc">No structural checks apply to this piece yet.</p>}
      {checks.map(c => (
        <div key={c.id} className={`chk ${c.level}`}>
          <b>{c.title}</b>{c.detail}
        </div>
      ))}

      <h4 style={{ marginTop: 22 }}>Bill of materials</h4>
      <div className="bom">
        {bom.lines.map((l, i) => (
          <div key={i} className={`bom-line ${l.kind}`}>
            <div className="bom-main">
              <span className="bom-item">{l.item}</span>
              <span className="bom-detail">{l.detail}</span>
            </div>
            <div className="bom-num">
              <span className="bom-qty">{l.qty}</span>
              <span className="bom-cost">{l.cost > 0 ? money(l.cost) : '—'}</span>
            </div>
          </div>
        ))}
        <div className="bom-tot">
          <span>{bom.metalGrams.toFixed(2)} g metal · {bom.totalCarat > 0 ? `${bom.totalCarat.toFixed(2)} ct · ` : ''}pour {bom.pourGrams.toFixed(2)} g</span>
          <span>{money(bom.total)}</span>
        </div>
      </div>

      <div className="qact" style={{ marginTop: 16, gap: 8 }}>
        <button className="primary" onClick={exportStl}>Export STL</button>
        <button className="opt" onClick={techPack}>Tech pack (PDF)</button>
      </div>
      {stlMsg && <p className="disc">{stlMsg}</p>}
      <p className="disc">
        STL is print-ready geometry for wax/resin casting. Checks are heuristic —
        confirm wall and prong minimums with your caster.
      </p>
    </div>
  )
}
