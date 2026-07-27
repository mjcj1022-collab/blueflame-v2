import { useState, useEffect } from 'react'
import { useDesign } from '../state/design'
import { useModeler, SCULPT_COLORS, type ShankProfile } from '../state/modeler'
import { useWorkspace } from '../state/workspace'
import { parseDesign } from '../lib/nlDesign'
import { NECKLACE_STYLES } from '../lib/necklaceChain'
import { BODY_STYLES } from '../lib/body'
import { MOTIFS } from '../lib/motif'
import { useSettings } from '../state/settings'
import { QuickConfigure, TemplateBrowser } from './QuickConfigure'
import { ALLOYS, SHAPES, STONES, SETTINGS, FINISHES, shapeById, stoneMm, alloyById, birthstoneMonth, stoneById, finishById, settingById, isGradeable, gradeMultiplier, gradeLabel, CUT_GRADES, COLOR_GRADES, CLARITY_GRADES, FLUOR_GRADES, CERT_LABS, type Alloy, type Grade } from '../catalog'
import { sizeToDiameter, sizeToCircumference, formatSize, fitAdvice, sizeConversions } from '../lib/sizing'
import { guardrails, computePrice } from '../lib/pricing'
import { engraveCapacity, ENGRAVE_FONTS } from '../lib/engrave'
import { MELEE_QUALITY, MELEE_STYLE } from '../catalog'
import { money } from '../lib/units'
import {
  type ProductCategory, type BraceletKind, type EarringBack, type BodyStyle,
  CATEGORY_LABEL, hasCenterStone, stoneOnPiece, NO_STONE
} from '../spec/types'

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
const CATEGORIES: ProductCategory[] = ['ring', 'pendant', 'earring', 'bracelet', 'necklace', 'body']

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="grp"><h3>{title}</h3>{children}</div>
}

function Slider({ id, label, value, min, max, step, display, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step: number
  display: string; onChange: (v: number) => void
}) {
  return (
    <>
      <div className="row"><label htmlFor={id}>{label}</label><span className="val">{display}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)} />
    </>
  )
}

function DescribeBar() {
  const spec = useDesign(s => s.spec)
  const load = useDesign(s => s.load)
  const [text, setText] = useState('')
  const [hint, setHint] = useState('')
  const apply = () => {
    if (!text.trim()) return
    const { spec: next, matched } = parseDesign(text, spec)
    if (!matched.length) { setHint('Didn’t catch that — try “1.5 ct oval halo in 18k rose gold”.'); setTimeout(() => setHint(''), 5000); return }
    load(next)
    setHint(`Applied: ${matched.join(' · ')}`)
    setText('')
    setTimeout(() => setHint(''), 6000)
  }
  return (
    <Group title="Describe a piece">
      <div className="lib-save">
        <input className="lib-name" placeholder="e.g. 1.5 ct oval halo in 18k rose gold" value={text}
          onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') apply() }} />
        <button className="primary" onClick={apply}>Apply</button>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </Group>
  )
}

function CategorySwitch() {
  const { spec, setCategory } = useDesign()
  const enabled = useSettings(s => s.enabledCategories)
  const cats = CATEGORIES.filter(c => enabled.includes(c))
  // If the active piece type gets switched off in Settings, jump to a kept one.
  useEffect(() => {
    if (!enabled.includes(spec.category) && cats[0]) setCategory(cats[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
  if (cats.length <= 1) return null   // only one piece type → no picker needed
  return (
    <Group title="Piece">
      <div className="opts">
        {cats.map(c => (
          <button key={c} className="opt" aria-pressed={spec.category === c} onClick={() => setCategory(c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
    </Group>
  )
}

const BAND_PROFILES: [string, string][] = [['round', 'Round'], ['flat', 'Flat'], ['dshape', 'D-shape'], ['knife', 'Knife-edge']]

function RingControls() {
  const { spec, setRing, setFit, setProfile } = useDesign()
  const advice = fitAdvice(spec.ring.size, spec.ring.width, spec.ring.fit)
  const conv = sizeConversions(spec.ring.size)
  const resize = settingById(spec.setting.typeId).resizeRange
  return (
    <>
      <Group title="Ring size">
        <Slider id="s-size" label="US size" value={spec.ring.size} min={3} max={13} step={0.25}
          display={formatSize(spec.ring.size)} onChange={v => setRing({ size: v })} />
        <p className="hint">
          Inside diameter <b>{sizeToDiameter(spec.ring.size).toFixed(2)}</b> mm ·
          circumference <b>{sizeToCircumference(spec.ring.size).toFixed(2)}</b> mm
        </p>
        <p className="hint">
          UK <b>{conv.uk}</b> · EU <b>{conv.eu.toFixed(1)}</b> · JP <b>{conv.jp}</b>
          <span style={{ opacity: 0.65 }}> · resizes {resize}</span>
        </p>
        {advice.level !== 'none' && (
          <div className={`flag ${advice.level === 'warn' ? '' : 'note'}`}>
            <b>{advice.title}</b>{advice.body}
            {advice.suggested !== undefined && (
              <button className="inline-act" onClick={() => setRing({ size: advice.suggested! })}>
                Apply size {formatSize(advice.suggested)}
              </button>
            )}
          </div>
        )}
      </Group>
      <Group title="Band">
        <Slider id="s-width" label="Width" value={spec.ring.width} min={1.5} max={9} step={0.1}
          display={`${spec.ring.width.toFixed(1)} mm`} onChange={v => setRing({ width: v })} />
        <div style={{ height: 16 }} />
        <Slider id="s-thick" label="Thickness" value={spec.ring.thickness} min={1.1} max={2.8} step={0.1}
          display={`${spec.ring.thickness.toFixed(1)} mm`} onChange={v => setRing({ thickness: v })} />
        <div className="opts c2" style={{ marginTop: 16 }}>
          <button className="opt" aria-pressed={spec.ring.fit === 'standard'} onClick={() => setFit('standard')}>
            Standard fit<small>Flat interior</small>
          </button>
          <button className="opt" aria-pressed={spec.ring.fit === 'comfort'} onClick={() => setFit('comfort')}>
            Comfort fit<small>Domed interior</small>
          </button>
        </div>
        <div className="subhead" style={{ marginTop: 16 }}>Band profile</div>
        <div className="opts c2">
          {BAND_PROFILES.map(([id, label]) => (
            <button key={id} className="opt" aria-pressed={(spec.ring.profile ?? 'round') === id} onClick={() => setProfile(id as never)}>{label}</button>
          ))}
        </div>
      </Group>
      <Group title="Custom sculpting">
        <button className="opt tpl" style={{ width: '100%' }} onClick={sendRingToSculpt}>
          Send ring → Sculpt<small>Open band + head + stone in the 3D modeler to free-draw or push vertices</small>
        </button>
      </Group>
    </>
  )
}

/** Push the current ring into the Sculpt workspace as an editable assembly:
 *  band alone if it's a plain ring, or band + prong head + centre stone,
 *  positioned so the stone sits at the top of the band. */
function sendRingToSculpt() {
  const spec = useDesign.getState().spec
  const R = sizeToDiameter(spec.ring.size) / 2 + spec.ring.thickness / 2   // band top height (mm)

  const band = {
    kind: 'shank' as const, size: 6, material: 'metal' as const, color: SCULPT_COLORS.metal,
    position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number],
    params: { ringSize: spec.ring.size, width: spec.ring.width, thickness: spec.ring.thickness, profile: (spec.ring.fit === 'comfort' ? 'comfort' : spec.ring.profile) as ShankProfile },
    name: 'Ring band'
  }

  const hasStone = spec.center.stoneTypeId !== NO_STONE
  if (hasStone) {
    const stoneW = stoneMm(shapeById(spec.center.shapeId), Math.max(spec.center.carat, 0.02)).width
    const prongs = Math.min(8, Math.max(3, parseInt(spec.setting.typeId.match(/\d+/)?.[0] ?? '4', 10) || 4))
    const headH = Math.min(8, Math.max(3, stoneW * 0.6))
    const head = {
      kind: 'head' as const, size: 6, material: 'metal' as const, color: SCULPT_COLORS.metal,
      position: [0, R + headH * 0.4, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number],
      params: { prongs, stoneW, height: headH }, name: 'Prong head'
    }
    const gem = {
      kind: 'gem' as const, size: 6, material: 'gem' as const, color: SCULPT_COLORS.gem,
      position: [0, R + headH * 0.7, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number],
      params: { shapeId: spec.center.shapeId, carat: spec.center.carat }, name: 'Centre stone'
    }
    useModeler.getState().addObjects([band, head, gem])
  } else {
    useModeler.getState().addObjects([band])
  }
  useWorkspace.getState().setMode('model')
}

function PendantControls() {
  const { spec, setPendant } = useDesign()
  const p = spec.pendant
  return (
    <Group title="Pendant & chain">
      <Slider id="p-bail" label="Bail opening" value={p.bailInner} min={2} max={8} step={0.5}
        display={`${p.bailInner.toFixed(1)} mm`} onChange={v => setPendant({ bailInner: v })} />
      <div style={{ height: 16 }} />
      <Slider id="p-gauge" label="Bail gauge" value={p.bailGauge} min={0.8} max={2.5} step={0.1}
        display={`${p.bailGauge.toFixed(1)} mm`} onChange={v => setPendant({ bailGauge: v })} />
      <div className="opts c2" style={{ marginTop: 16 }}>
        <button className="opt" aria-pressed={p.hasChain} onClick={() => setPendant({ hasChain: true })}>With chain</button>
        <button className="opt" aria-pressed={!p.hasChain} onClick={() => setPendant({ hasChain: false })}>Pendant only</button>
      </div>
      {p.hasChain && (
        <>
          <div style={{ height: 16 }} />
          <Slider id="p-len" label="Chain length" value={p.chainLength} min={14} max={30} step={2}
            display={`${p.chainLength}"`} onChange={v => setPendant({ chainLength: v })} />
        </>
      )}
    </Group>
  )
}

function EarringControls() {
  const { spec, setEarring } = useDesign()
  const e = spec.earring
  const backs: [EarringBack, string][] = [['friction', 'Friction'], ['screw', 'Screw-back'], ['lever', 'Leverback'], ['latch', 'Latch']]
  return (
    <Group title="Earrings">
      <div className="opts c2">
        <button className="opt" aria-pressed={e.pair} onClick={() => setEarring({ pair: true })}>Pair</button>
        <button className="opt" aria-pressed={!e.pair} onClick={() => setEarring({ pair: false })}>Single</button>
      </div>
      <div style={{ height: 16 }} />
      <Slider id="e-drop" label="Drop length" value={e.dropLength} min={0} max={25} step={1}
        display={e.dropLength === 0 ? 'Stud' : `${e.dropLength} mm`} onChange={v => setEarring({ dropLength: v })} />
      <div style={{ height: 16 }} />
      <Slider id="e-post" label="Post length" value={e.postLength} min={8} max={13} step={0.5}
        display={`${e.postLength.toFixed(1)} mm`} onChange={v => setEarring({ postLength: v })} />
      <div className="row" style={{ marginTop: 16 }}><label>Back</label></div>
      <div className="opts c2">
        {backs.map(([id, name]) => (
          <button key={id} className="opt" aria-pressed={e.back === id} onClick={() => setEarring({ back: id })}>{name}</button>
        ))}
      </div>
    </Group>
  )
}

function BraceletControls() {
  const { spec, setBracelet } = useDesign()
  const b = spec.bracelet
  const kinds: [BraceletKind, string][] = [['tennis', 'Tennis'], ['bangle', 'Bangle'], ['cuff', 'Cuff'], ['chain', 'Chain']]
  return (
    <Group title="Bracelet">
      <div className="opts c2">
        {kinds.map(([id, name]) => (
          <button key={id} className="opt" aria-pressed={b.kind === id} onClick={() => setBracelet({ kind: id })}>{name}</button>
        ))}
      </div>
      <div style={{ height: 16 }} />
      <Slider id="b-wrist" label="Wrist" value={b.wristCircumference} min={130} max={220} step={1}
        display={`${b.wristCircumference} mm · ${(b.wristCircumference / 25.4).toFixed(1)}"`} onChange={v => setBracelet({ wristCircumference: v })} />
      <div style={{ height: 16 }} />
      <Slider id="b-fit" label="Fit allowance" value={b.fitAllowance} min={5} max={25} step={1}
        display={`+${b.fitAllowance} mm`} onChange={v => setBracelet({ fitAllowance: v })} />
      {(b.kind === 'bangle' || b.kind === 'cuff') && (
        <>
          <div style={{ height: 16 }} />
          <Slider id="b-w" label="Width" value={b.width} min={2} max={12} step={0.5}
            display={`${b.width.toFixed(1)} mm`} onChange={v => setBracelet({ width: v })} />
          <div style={{ height: 16 }} />
          <Slider id="b-t" label="Thickness" value={b.thickness} min={1.2} max={4} step={0.1}
            display={`${b.thickness.toFixed(1)} mm`} onChange={v => setBracelet({ thickness: v })} />
        </>
      )}
      {b.kind === 'tennis' && (
        <>
          <div style={{ height: 16 }} />
          <Slider id="b-links" label="Stone count" value={b.linkCount} min={20} max={70} step={1}
            display={`${b.linkCount} stones`} onChange={v => setBracelet({ linkCount: v })} />
          <p className="hint">Carat slider below sets <b>total</b> weight; each stone is {(spec.center.carat / b.linkCount).toFixed(3)} ct.</p>
        </>
      )}
    </Group>
  )
}

function NecklaceControls() {
  const { spec, setNecklace, reveal } = useDesign()
  const n = spec.necklace
  const labels: [number, string][] = [[14, 'Choker'], [16, 'Choker'], [18, 'Princess'], [20, 'Matinee'], [24, 'Opera'], [30, 'Rope']]
  const label = labels.reduce((acc, [len, name]) => n.length >= len ? name : acc, 'Collar')
  return (
    <Group title="Necklace">
      <Slider id="n-len" label="Length" value={n.length} min={14} max={30} step={1}
        display={`${n.length}" · ${label}`} onChange={v => setNecklace({ length: v })} />
      <div style={{ height: 16 }} />
      <Slider id="n-gauge" label="Chain gauge" value={n.gauge} min={0.6} max={3} step={0.1}
        display={`${n.gauge.toFixed(1)} mm`} onChange={v => setNecklace({ gauge: v })} />
      <div className="row" style={{ marginTop: 16 }}><label htmlFor="n-style">Chain style</label></div>
      <select id="n-style" className="lib-name" style={{ width: '100%' }} value={n.chainStyle ?? 'cable'}
        onChange={e => setNecklace({ chainStyle: e.target.value as typeof n.chainStyle })}>
        {NECKLACE_STYLES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      <div className="opts c2" style={{ marginTop: 16 }}>
        <button className="opt" aria-pressed={!n.hasPendant} onClick={() => setNecklace({ hasPendant: false })}>Chain only</button>
        <button className="opt" aria-pressed={n.hasPendant} onClick={() => setNecklace({ hasPendant: true })}>With pendant</button>
      </div>
      <div className="row" style={{ marginTop: 16 }}><label htmlFor="n-motif">Motif</label></div>
      <select id="n-motif" className="lib-name" style={{ width: '100%' }} value={n.motif ?? 'none'}
        onChange={e => { const v = e.target.value as typeof n.motif; setNecklace({ motif: v }); if (v && v !== 'none') reveal('head') }}>
        <option value="none">None (plain chain / stone pendant)</option>
        {MOTIFS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </Group>
  )
}

/** Common wire gauges, shown alongside the mm value the way piercers spec them. */
const GAUGE_LABEL: [number, string][] = [[3.2, '8g'], [2.4, '10g'], [2.0, '12g'], [1.6, '14g'], [1.2, '16g'], [1.0, '18g'], [0.8, '20g']]
const gaugeLabel = (mm: number) => GAUGE_LABEL.reduce((best, cur) => Math.abs(mm - cur[0]) < Math.abs(mm - best[0]) ? cur : best)[1]

function BodyControls() {
  const { spec, setBody } = useDesign()
  const b = spec.body
  const isRing = b.style === 'cbr' || b.style === 'circular' || b.style === 'septum'
  const isPlug = b.style === 'plug'
  const sizeLabel = isRing ? 'Inner diameter' : isPlug ? 'Plug diameter' : 'Wearable length'
  const showBall = b.style !== 'plug' && b.style !== 'septum'
  return (
    <Group title="Body jewelry">
      <div className="row"><label htmlFor="b-style">Style</label></div>
      <select id="b-style" className="lib-name" style={{ width: '100%' }} value={b.style}
        onChange={e => setBody({ style: e.target.value as BodyStyle })}>
        {BODY_STYLES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      <div style={{ height: 16 }} />
      <Slider id="b-gauge" label="Gauge" value={b.gauge} min={0.8} max={3.2} step={0.1}
        display={`${b.gauge.toFixed(1)} mm · ${gaugeLabel(b.gauge)}`} onChange={v => setBody({ gauge: v })} />
      <div style={{ height: 16 }} />
      <Slider id="b-size" label={sizeLabel} value={b.size} min={3} max={25} step={0.5}
        display={`${b.size.toFixed(1)} mm`} onChange={v => setBody({ size: v })} />
      {showBall && (
        <>
          <div style={{ height: 16 }} />
          <Slider id="b-ball" label={b.style === 'cbr' ? 'Bead' : b.style === 'labret' ? 'Front / disc' : 'Ball'} value={b.ballSize} min={2} max={10} step={0.5}
            display={`${b.ballSize.toFixed(1)} mm`} onChange={v => setBody({ ballSize: v })} />
        </>
      )}
      <p className="hint">Threadless and internally-threaded ends both weigh out the same at this gauge; pick the finish under Metal.</p>
    </Group>
  )
}

const METAL_GROUPS: [string, (a: Alloy) => boolean][] = [
  ['Gold', a => a.symbol === 'Au'],
  ['Platinum group', a => a.symbol === 'Pt' || a.symbol === 'Pd'],
  ['Silver', a => a.symbol === 'Ag'],
  ['Contemporary', a => !a.precious]
]

function MetalGroup() {
  const { spec, setAlloy, setRhodium, setTwoTone, setHeadAlloy } = useDesign()
  const [nickelFree, setNickelFree] = useState(false)
  const active = alloyById(spec.metal.alloyId)
  const list = nickelFree ? ALLOYS.filter(a => a.nickelFree) : ALLOYS

  return (
    <Group title="Metal">
      <label className="filter-row">
        <input type="checkbox" checked={nickelFree} onChange={e => setNickelFree(e.target.checked)} />
        Nickel-free only
      </label>
      {METAL_GROUPS.map(([label, pred]) => {
        const items = list.filter(pred)
        if (!items.length) return null
        return (
          <div key={label} className="metal-sub">
            <p className="subhead">{label}</p>
            <div className="opts">
              {items.map(a => (
                <button key={a.id} className="opt" aria-pressed={spec.metal.alloyId === a.id} onClick={() => setAlloy(a.id)}>
                  <span className="sw" style={{ background: hex(a.color) }} />
                  {a.short}<small>{a.density} g/cm³</small>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {active.platable && (
        <label className="filter-row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={!!spec.metal.rhodium} onChange={e => setRhodium(e.target.checked)} />
          Rhodium plated<small>white finish, re-plate every 12–18 mo</small>
        </label>
      )}

      <label className="filter-row" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={!!spec.metal.twoTone} onChange={e => setTwoTone(e.target.checked)} />
        Two-tone<small>separate metal for the head</small>
      </label>
      {spec.metal.twoTone && (
        <>
          <div className="subhead">Head / prong metal</div>
          <div className="opts">
            {ALLOYS.filter(a => a.precious).map(a => (
              <button key={a.id} className="opt" aria-pressed={(spec.metal.headAlloyId ?? spec.metal.alloyId) === a.id} onClick={() => setHeadAlloy(a.id)}>
                <span className="sw" style={{ background: hex(a.color) }} />
                {a.short}
              </button>
            ))}
          </div>
        </>
      )}

      {!active.precious && active.note && <div className="flag note"><b>{active.name}</b>{active.note}</div>}
    </Group>
  )
}

function PersonalizationGroup() {
  const { spec, setFinish, setEngraving } = useDesign()
  const cap = engraveCapacity(spec)
  const used = spec.engraving.text.length
  const over = used > cap
  return (
    <Group title="Finish & engraving">
      <div className="opts c2">
        {FINISHES.map(f => (
          <button key={f.id} className="opt" aria-pressed={spec.finish === f.id} onClick={() => setFinish(f.id)}>{f.name}</button>
        ))}
      </div>
      <p className="hint">{finishById(spec.finish).note}</p>

      <div className="row" style={{ marginTop: 16 }}>
        <label htmlFor="eng">Engraving</label>
        <span className="val" style={over ? { color: 'var(--warn)' } : undefined}>{used}/{cap}</span>
      </div>
      <input id="eng" className="lib-name" style={{ width: '100%' }} value={spec.engraving.text}
        onChange={e => setEngraving({ text: e.target.value })} placeholder="Add a message…" />
      <div className="opts c2" style={{ marginTop: 10 }}>
        <button className="opt" aria-pressed={spec.engraving.placement === 'inside'} onClick={() => setEngraving({ placement: 'inside' })}>Inside</button>
        <button className="opt" aria-pressed={spec.engraving.placement === 'outside'} onClick={() => setEngraving({ placement: 'outside' })}>Outside</button>
      </div>
      <div className="opts" style={{ marginTop: 10 }}>
        {ENGRAVE_FONTS.map(f => (
          <button key={f} className="opt" aria-pressed={spec.engraving.font === f} onClick={() => setEngraving({ font: f })}>{f}</button>
        ))}
      </div>
      {spec.category === 'ring' && spec.engraving.text.trim() !== '' && (
        <>
          <div style={{ height: 14 }} />
          <Slider id="eng-pos" label="Position on band" value={spec.engraving.position ?? 0.75} min={0} max={1} step={0.01}
            display={`${Math.round((spec.engraving.position ?? 0.75) * 100)}%`} onChange={v => setEngraving({ position: v })} />
          <p className="hint">Slide to move the text around the band. It renders live on the model.</p>
        </>
      )}
      {over && <div className="flag"><b>Too long</b>{used - cap} character(s) over the {cap}-character limit for this {spec.engraving.placement} surface.</div>}
    </Group>
  )
}

function GradeRow({ label, grades, value, onPick }: { label: string; grades: Grade[]; value: string; onPick: (id: string) => void }) {
  return (
    <>
      <div className="subhead">{label}</div>
      <div className="opts grade-opts">
        {grades.map(g => (
          <button key={g.id} className="opt" aria-pressed={value === g.id} onClick={() => onPick(g.id)}>{g.label}</button>
        ))}
      </div>
    </>
  )
}

function GradingGroup() {
  const { spec, setGrading, setCert } = useDesign()
  const g = spec.center.grading
  const cert = spec.center.cert
  const mult = gradeMultiplier(g)
  return (
    <Group title="Diamond grading">
      <GradeRow label="Cut" grades={CUT_GRADES} value={g.cut} onPick={id => setGrading({ cut: id })} />
      <GradeRow label="Colour" grades={COLOR_GRADES} value={g.color} onPick={id => setGrading({ color: id })} />
      <GradeRow label="Clarity" grades={CLARITY_GRADES} value={g.clarity} onPick={id => setGrading({ clarity: id })} />
      <GradeRow label="Fluorescence" grades={FLUOR_GRADES} value={g.fluorescence} onPick={id => setGrading({ fluorescence: id })} />
      <p className="hint">{gradeLabel(g)} · stone price <b>×{mult.toFixed(2)}</b> vs the G/VS2/Excellent baseline</p>
      <div className="subhead" style={{ marginTop: 14 }}>Certificate</div>
      <div className="opts">
        {CERT_LABS.map(lab => (
          <button key={lab} className="opt" aria-pressed={cert.lab === lab} onClick={() => setCert({ lab })}>{lab === 'none' ? 'None' : lab}</button>
        ))}
      </div>
      {cert.lab !== 'none' && (
        <input className="lib-name" style={{ width: '100%', marginTop: 10 }} value={cert.number}
          onChange={e => setCert({ number: e.target.value })} placeholder={`${cert.lab} report number`} />
      )}
    </Group>
  )
}

function MeleeGroup() {
  const { spec, setMelee } = useDesign()
  const setting = settingById(spec.setting.typeId)
  if (!setting.melee) return null
  const m = spec.setting.melee ?? {}
  const count = m.count ?? setting.melee
  const caratEach = m.caratEach ?? setting.accentCt ?? 0.015
  const quality = m.quality ?? 'gh'
  const style = m.style ?? 'bright'
  const p = computePrice(spec)
  return (
    <Group title="Melee / pavé designer">
      <Slider id="m-count" label="Accent count" value={count} min={2} max={60} step={1} display={`${count}`} onChange={v => setMelee({ count: v })} />
      <div style={{ height: 14 }} />
      <Slider id="m-size" label="Accent size" value={caratEach} min={0.005} max={0.25} step={0.005} display={`${caratEach.toFixed(3)} ct`} onChange={v => setMelee({ caratEach: v })} />
      <div className="subhead" style={{ marginTop: 14 }}>Quality</div>
      <div className="opts">
        {MELEE_QUALITY.map(t => <button key={t.id} className="opt" aria-pressed={quality === t.id} onClick={() => setMelee({ quality: t.id })}>{t.label}</button>)}
      </div>
      <div className="subhead" style={{ marginTop: 12 }}>Setting style</div>
      <div className="opts c2">
        {MELEE_STYLE.map(t => <button key={t.id} className="opt" aria-pressed={style === t.id} onClick={() => setMelee({ style: t.id })}>{t.label}</button>)}
      </div>
      <p className="hint">{count} stones · <b>{(count * caratEach).toFixed(2)} ct</b> total · accents + setting <b>{money(p.accentCost)}</b></p>
    </Group>
  )
}

export function Controls() {
  const { spec, setShape, setStone, setCarat, setSetting, setSeat } = useDesign()
  const undo = useDesign(s => s.undo)
  const redo = useDesign(s => s.redo)
  const shape = shapeById(spec.center.shapeId)
  const mm = stoneMm(shape, spec.center.carat)
  const rails = guardrails(spec)

  // Undo / redo shortcuts for the Design workspace (Controls only mounts here).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const t = e.target as HTMLElement
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
      else if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const tennis = spec.category === 'bracelet' && spec.bracelet.kind === 'tennis'
  const necklacePendant = spec.category === 'necklace' && spec.necklace.hasPendant
  // Categories where a stone is relevant at all
  const stoneRelevant = hasCenterStone(spec.category) || tennis || necklacePendant
  // Whether a plain (unstoned) option is meaningful — a plain tennis is just a chain
  const plainAllowed = hasCenterStone(spec.category)
  const active = stoneOnPiece(spec)
  const caratLabel = tennis ? 'Total carat' : 'Center stone'

  return (
    <>
      <DescribeBar />
      <CategorySwitch />
      <Group title="Quick configure">
        <TemplateBrowser />
        <QuickConfigure />
      </Group>

      {spec.category === 'ring' && <RingControls />}
      {spec.category === 'pendant' && <PendantControls />}
      {spec.category === 'earring' && <EarringControls />}
      {spec.category === 'bracelet' && <BraceletControls />}
      {spec.category === 'necklace' && <NecklaceControls />}
      {spec.category === 'body' && <BodyControls />}

      <MetalGroup />

      {stoneRelevant && plainAllowed && (
        <Group title="Stone">
          <div className="opts c2">
            <button className="opt" aria-pressed={active} onClick={() => setStone(active ? spec.center.stoneTypeId : 'dia')}>
              Set a stone
            </button>
            <button className="opt" aria-pressed={!active} onClick={() => setStone(NO_STONE)}>
              No stone<small>Plain band</small>
            </button>
          </div>
        </Group>
      )}

      {stoneRelevant && active && (
        <>
          <Group title="Stone shape">
            <div className="opts">
              {SHAPES.map(s => (
                <button key={s.id} className="opt" aria-pressed={spec.center.shapeId === s.id} onClick={() => setShape(s.id)}>
                  <span className="shp">
                    <svg viewBox="0 0 24 24"><path d={s.icon} fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
                  </span>
                  {s.name}
                </button>
              ))}
            </div>
          </Group>

          <Group title="Stone type">
            <div className="opts c2">
              {STONES.map(s => (
                <button key={s.id} className="opt" aria-pressed={spec.center.stoneTypeId === s.id} onClick={() => setStone(s.id)}>
                  {s.name}<small>{s.variety}</small>
                </button>
              ))}
            </div>
            {(() => {
              const st = stoneById(spec.center.stoneTypeId)
              const bm = birthstoneMonth(st)
              return <p className="hint">Mohs <b>{st.mohs}</b>{st.treatment ? ` · ${st.treatment}` : ''}{bm ? ` · ${bm} birthstone` : ''}</p>
            })()}
          </Group>

          <Group title="Carat weight">
            <Slider id="s-ct" label={caratLabel} value={spec.center.carat} min={0.25} max={5} step={0.05}
              display={`${spec.center.carat.toFixed(2)} ct`} onChange={setCarat} />
            <p className="hint">
              {tennis
                ? <>Each of {spec.bracelet.linkCount} stones ≈ <b>{(spec.center.carat / spec.bracelet.linkCount).toFixed(3)}</b> ct</>
                : <>Measures <b>{mm.length.toFixed(2)} × {mm.width.toFixed(2)}</b> mm · millimetre size is shape-dependent</>}
            </p>
          </Group>

          {isGradeable(spec.center.stoneTypeId) && <GradingGroup />}

          <Group title="Setting">
            <div className="opts c2">
              {SETTINGS.map(s => (
                <button key={s.id} className="opt" aria-pressed={spec.setting.typeId === s.id} onClick={() => setSetting(s.id)}>
                  {s.name}<small>{s.variety}</small>
                </button>
              ))}
            </div>
            {rails.map((g, i) => (
              <div key={i} className={`flag ${g.level === 'ok' ? 'ok' : g.level === 'note' ? 'note' : ''}`}>
                <b>{g.title}</b>{g.body}
              </div>
            ))}
            <div style={{ height: 14 }} />
            <Slider id="c-seat" label="Stone height in mount" value={spec.center.seat ?? 0} min={-2} max={3} step={0.1}
              display={`${(spec.center.seat ?? 0) >= 0 ? '+' : ''}${(spec.center.seat ?? 0).toFixed(1)} mm`} onChange={setSeat} />
            <p className="hint">Raise the stone to sit higher and catch more light, or set it deeper into the mount for a protected, low-profile look.</p>
          </Group>

          <MeleeGroup />
        </>
      )}

      <PersonalizationGroup />
    </>
  )
}
