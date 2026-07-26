import { useState } from 'react'
import { useDesign } from '../state/design'
import { computePrice, stoneUnits } from '../lib/pricing'
import { appraisal } from '../lib/appraisal'
import { textToPdf, bodyAfterTitle } from '../lib/pdf'
import { alloyById, shapeById, stoneById, settingById, stoneMm, finishById, isGradeable, gradeLabel } from '../catalog'
import { sizeToDiameter, formatSize } from '../lib/sizing'
import { money, gToDwt } from '../lib/units'
import { CATEGORY_LABEL, type DesignSpec } from '../spec/types'
import { Checkout, checkoutConfigured } from './Checkout'
import { LIVE_SPOT, SYMBOL_TO_SPOT } from '../lib/spot'
import { BODY_STYLES } from '../lib/body'

function geometryLines(spec: DesignSpec): string[] {
  const alloy = alloyById(spec.metal.alloyId)
  switch (spec.category) {
    case 'ring':
      return [
        'RING',
        `  Inside diameter   ${sizeToDiameter(spec.ring.size).toFixed(2)} mm  (US ${formatSize(spec.ring.size)})`,
        `  Band              ${spec.ring.width.toFixed(1)} x ${spec.ring.thickness.toFixed(1)} mm, ${spec.ring.fit} fit`,
        `  Hallmark          ${alloy.hallmark}`,
        `  Resizable         ${settingById(spec.setting.typeId).resizeRange}`
      ]
    case 'pendant':
      return [
        'PENDANT',
        `  Bail              ${spec.pendant.bailInner.toFixed(1)} mm opening, ${spec.pendant.bailGauge.toFixed(1)} mm gauge`,
        `  Chain             ${spec.pendant.hasChain ? `${spec.pendant.chainLength}" at ${spec.pendant.chainGauge.toFixed(1)} mm` : 'None (pendant only)'}`,
        `  Hallmark          ${alloy.hallmark}`
      ]
    case 'earring':
      return [
        'EARRINGS',
        `  Configuration     ${spec.earring.pair ? 'Matched pair' : 'Single'}`,
        `  Style             ${spec.earring.dropLength > 0 ? `Drop, ${spec.earring.dropLength} mm` : 'Stud'}`,
        `  Post              ${spec.earring.postLength.toFixed(1)} mm, ${spec.earring.postGauge.toFixed(1)} mm gauge, ${spec.earring.back} back`,
        `  Hallmark          ${alloy.hallmark}`
      ]
    case 'bracelet':
      return [
        'BRACELET',
        `  Type              ${spec.bracelet.kind}`,
        `  Worn length       ${(spec.bracelet.wristCircumference + spec.bracelet.fitAllowance)} mm  (${((spec.bracelet.wristCircumference + spec.bracelet.fitAllowance) / 25.4).toFixed(2)}")`,
        spec.bracelet.kind === 'tennis' ? `  Stones            ${spec.bracelet.linkCount}` : `  Section           ${spec.bracelet.width.toFixed(1)} x ${spec.bracelet.thickness.toFixed(1)} mm`,
        `  Hallmark          ${alloy.hallmark}`
      ]
    case 'necklace':
      return [
        'NECKLACE',
        `  Length            ${spec.necklace.length}"`,
        `  Chain gauge       ${spec.necklace.gauge.toFixed(1)} mm`,
        `  Pendant           ${spec.necklace.hasPendant ? 'Yes' : 'None'}`,
        `  Hallmark          ${alloy.hallmark}`
      ]
    case 'body': {
      const styleName = BODY_STYLES.find(([id]) => id === spec.body.style)?.[1] ?? spec.body.style
      const ring = spec.body.style === 'cbr' || spec.body.style === 'circular' || spec.body.style === 'septum'
      return [
        'BODY JEWELRY',
        `  Style             ${styleName}`,
        `  Gauge             ${spec.body.gauge.toFixed(1)} mm`,
        `  ${ring ? 'Inner diameter   ' : spec.body.style === 'plug' ? 'Plug diameter    ' : 'Wearable length  '} ${spec.body.size.toFixed(1)} mm`,
        `  Ends              ${spec.body.ballSize.toFixed(1)} mm`,
        `  Hallmark          ${alloy.hallmark}`
      ]
    }
  }
}

function stoneLines(spec: DesignSpec): string[] {
  const { count, caratEach } = stoneUnits(spec)
  if (count === 0) return []
  const shape = shapeById(spec.center.shapeId)
  const stone = stoneById(spec.center.stoneTypeId)
  const setting = settingById(spec.setting.typeId)
  const mm = stoneMm(shape, caratEach)
  return [
    '',
    'STONE',
    `  ${count > 1 ? `${count} x ` : 'Center            '}${caratEach.toFixed(2)} ct ${shape.name}, ${mm.length.toFixed(2)} x ${mm.width.toFixed(2)} mm`,
    `  Material          ${stone.name} - ${stone.variety}, Mohs ${stone.mohs}`,
    ...(isGradeable(spec.center.stoneTypeId) ? [
      `  Grade             ${gradeLabel(spec.center.grading)}, ${spec.center.grading.fluorescence} fluor.`,
      spec.center.cert.lab !== 'none' ? `  Certificate       ${spec.center.cert.lab} ${spec.center.cert.number || '(number pending)'}` : ''
    ] : []),
    `  Treatment         ${stone.treatment ?? 'None disclosed'}`,
    `  Setting           ${setting.name} (${setting.variety})`
  ].filter(Boolean)
}

function techSheet(spec: DesignSpec, brand = 'Blue Flame') {
  const p = computePrice(spec)
  const m = p.metal
  const alloy = alloyById(spec.metal.alloyId)
  const stone = stoneById(spec.center.stoneTypeId)
  const { count } = stoneUnits(spec)

  return [
    `${brand.toUpperCase()} — TECH SHEET  (${CATEGORY_LABEL[spec.category]})`,
    '',
    ...geometryLines(spec),
    '',
    'METAL',
    `  Alloy             ${alloy.name}, density ${alloy.density} g/cm3, ${(alloy.fine * 100).toFixed(1)}% ${alloy.symbol}`,
    spec.metal.twoTone && spec.metal.headAlloyId ? `  Head alloy        ${alloyById(spec.metal.headAlloyId).name} (two-tone, cast separately)` : '',
    `  Model volume      ${Math.round(m.volume).toLocaleString()} mm3`,
    `  Cast weight       ${m.cast.toFixed(2)} g   (${gToDwt(m.cast).toFixed(2)} dwt)`,
    `  Finished weight   ${m.finished.toFixed(2)} g   (${gToDwt(m.finished).toFixed(2)} dwt)`,
    `  Finishing loss    ${m.lossGrams.toFixed(2)} g at ${(m.finishingLoss * 100).toFixed(1)}%`,
    `  Fine ${alloy.symbol} content    ${m.fineGrams.toFixed(2)} g   (${m.fineOzt.toFixed(4)} ozt)`,
    `  Sprue + button    ${(m.sprue + m.button).toFixed(2)} g`,
    `  METAL TO POUR     ${m.pour.toFixed(2)} g   (${gToDwt(m.pour).toFixed(2)} dwt)`,
    `  Pattern weight    ${m.patternWax.toFixed(2)} g wax  /  ${m.patternResin.toFixed(2)} g castable resin`,
    ...stoneLines(spec),
    '',
    'FINISH & PERSONALIZATION',
    `  Finish            ${finishById(spec.finish).name}`,
    `  Engraving         ${spec.engraving.text.trim() ? `“${spec.engraving.text.trim()}” (${spec.engraving.placement}, ${spec.engraving.font})` : 'None'}`,
    spec.metal.rhodium && p.metal.alloy.platable ? '  Plating           Rhodium' : '',
    '',
    'PRICE',
    `  Net metal         ${money(p.metalCost)}`,
    ...(count > 0 ? [
      `  Stones            ${money(p.stoneCost)}`,
      `  Setting labor     ${money(p.settingFee)}`
    ] : []),
    ...(p.accentCount > 0 ? [`  Accent (${p.accentCount})      ${money(p.accentCost)}`] : []),
    ...(p.platingFee > 0 ? [`  Rhodium plating   ${money(p.platingFee)}`] : []),
    ...(p.finishExtra > 0 ? [`  Surface finish    ${money(p.finishExtra)}`] : []),
    ...(p.engraveFee > 0 ? [`  Engraving         ${money(p.engraveFee)}`] : []),
    `  Cast and finish   ${money(p.finishFee)}`,
    `  ESTIMATE          ${money(p.total)}`,
    '',
    'DISCLOSURE',
    count > 0
      ? `  ${stone.labGrown ? 'LABORATORY-GROWN. Must be disclosed on all documents and advertising.' : 'Natural origin. Treatments as noted above.'}`
      : '  No center stone.',
    count > 0 && stone.care ? `  Care: ${stone.care}` : ''
  ].filter(Boolean).join('\n')
}

export function QuotePanel() {
  const spec = useDesign(s => s.spec)
  const market = useDesign(s => s.market)
  const setMarket = useDesign(s => s.setMarket)
  const shop = useDesign(s => s.shop)
  const setShop = useDesign(s => s.setShop)
  const [costOpen, setCostOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const p = computePrice(spec)
  const alloy = alloyById(spec.metal.alloyId)
  const hasStones = p.stoneCount > 0
  const showCost = !shop.hideCost

  const slug = shop.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const download = () => {
    textToPdf(shop.name, `Technical Specification — ${CATEGORY_LABEL[spec.category]}`,
      bodyAfterTitle(techSheet(spec, shop.name)), `${slug}-techsheet-${spec.category}.pdf`)
  }

  const copySpec = async () => {
    await navigator.clipboard.writeText(JSON.stringify(spec, null, 2))
  }

  const downloadAppraisal = () => {
    textToPdf(shop.name, 'Insurance Appraisal',
      bodyAfterTitle(appraisal(spec, shop.name)), `${slug}-appraisal-${spec.category}.pdf`)
  }

  return (
    <div className="panel-block quote">
      {showCost ? (
        <>
          <div className="qline"><span>Net metal — {alloy.name}</span><span>{money(p.metalCost)}</span></div>
          {(() => {
            const sym = SYMBOL_TO_SPOT[alloy.symbol]
            const live = sym ? LIVE_SPOT.prices[sym] : undefined
            if (!live || LIVE_SPOT.source === 'static') return null
            const day = LIVE_SPOT.at ? new Date(LIVE_SPOT.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
            return <div className="qspot">● live {sym.slice(1)} spot {money(live)}/ozt · {day}</div>
          })()}
          {hasStones && <div className="qline"><span>{p.stoneCount > 1 ? `${p.stoneCount} stones` : 'Center stone'}</span><span>{money(p.stoneCost)}</span></div>}
          {p.accentCount > 0 && <div className="qline"><span>{p.accentCount} accent stones + setting</span><span>{money(p.accentCost)}</span></div>}
          {hasStones && <div className="qline"><span>Setting labor</span><span>{money(p.settingFee)}</span></div>}
          {p.platingFee > 0 && <div className="qline"><span>Rhodium plating</span><span>{money(p.platingFee)}</span></div>}
          {p.finishExtra > 0 && <div className="qline"><span>Surface finish</span><span>{money(p.finishExtra)}</span></div>}
          {p.engraveFee > 0 && <div className="qline"><span>Engraving</span><span>{money(p.engraveFee)}</span></div>}
          <div className="qline"><span>Cast, finish, polish</span><span>{money(p.finishFee)}</span></div>
          <div className="qtotal">
            <span className="lbl">Estimate</span>
            <span className="amt">{money(p.total)}</span>
          </div>
        </>
      ) : (
        <div className="qtotal"><span className="lbl">Cost basis hidden</span><span className="amt" style={{ fontSize: 15, color: 'var(--karat-lt)' }}>Associate mode</span></div>
      )}
      <div className="qact">
        <button className="primary" onClick={download}>Tech sheet</button>
        <button className="ghost" onClick={downloadAppraisal}>Appraisal</button>
        <button className="ghost" onClick={copySpec}>Copy spec</button>
      </div>

      {checkoutConfigured() && (
        <button className="co-open" onClick={() => setPayOpen(true)}>
          Take payment · {money(p.total)}
        </button>
      )}
      {payOpen && (
        <Checkout
          amountCents={Math.round(p.total * 100)}
          label={`${CATEGORY_LABEL[spec.category]} — ${shop.name}`}
          onClose={() => setPayOpen(false)}
        />
      )}

      <h4 style={{ marginTop: 18 }}>Shop</h4>
      <input className="lib-name" style={{ width: '100%' }} value={shop.name}
        onChange={e => setShop({ name: e.target.value })} onBlur={e => { if (!e.target.value.trim()) setShop({ name: 'Blue Flame' }) }} placeholder="Shop name (white-label)" />
      <label className="filter-row" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={shop.hideCost} onChange={e => setShop({ hideCost: e.target.checked })} />
        Sales-associate mode<small>hide cost basis</small>
      </label>

      {showCost && (<>
      <h4 style={{ marginTop: 14, cursor: 'pointer' }} onClick={() => setCostOpen(o => !o)}>
        Cost settings<button className="unit">{costOpen ? 'hide' : 'edit'}</button>
      </h4>
      {costOpen && (
        <div className="cost-grid">
          <label>Metal spot ×<input type="number" step={0.05} value={market.spotFactor} onChange={e => setMarket({ spotFactor: Math.max(0, +e.target.value) })} /></label>
          <label>Margin ×<input type="number" step={0.05} value={market.margin} onChange={e => setMarket({ margin: Math.max(1, +e.target.value) })} /></label>
          <label>Finish base $<input type="number" step={5} value={market.finishFee} onChange={e => setMarket({ finishFee: Math.max(0, +e.target.value) })} /></label>
          <label>Finish $/g<input type="number" step={0.5} value={market.finishPerGram} onChange={e => setMarket({ finishPerGram: Math.max(0, +e.target.value) })} /></label>
          <label>Setting base $<input type="number" step={5} value={market.settingBase} onChange={e => setMarket({ settingBase: Math.max(0, +e.target.value) })} /></label>
          <label>Melee labor $<input type="number" step={1} value={market.meleeLabor} onChange={e => setMarket({ meleeLabor: Math.max(0, +e.target.value) })} /></label>
        </div>
      )}
      <p className="disc">
        Spot values are illustrative. Set <b>Metal spot ×</b> from your live feed and tune
        margin and labor to your shop before quoting a client.
      </p>
      </>)}
    </div>
  )
}
