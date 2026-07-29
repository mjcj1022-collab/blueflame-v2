import { useState } from 'react'
import { useModeler } from '../state/modeler'
import { alloyById } from '../catalog'
import { metalVolumeReport } from '../lib/sculpt'
import { PRINTERS, printEstimateFor } from '../lib/printerProfiles'
import { MARKETS, hallmarkCompliance, type Market } from '../lib/hallmarkCompliance'
import { paveRun } from '../lib/paveLayout'
import { chainFitReport, braceletFit, type BraceletFitKind } from '../lib/chainFit'

/**
 * Bench & production planners — a compact set of the shop-floor calculators:
 * which printer, what marks the metal legally needs, how a pavé run lays out,
 * and how a chain sizes and claspss. Reads the live bench (objects + alloy) and
 * takes a couple of inputs each. Self-contained so the main panel stays lean.
 */
export function BenchPlanners() {
  const objects = useModeler(s => s.objects)
  const alloyId = useModeler(s => s.alloyId)
  const alloy = alloyById(alloyId)
  const grams = (metalVolumeReport(objects).mm3 / 1000) * alloy.density

  const [printer, setPrinter] = useState('lcd-mono')
  const [market, setMarket] = useState<Market>('US')
  const [stoneMm, setStoneMm] = useState(1.3)
  const [runMm, setRunMm] = useState(20)
  const [chainIn, setChainIn] = useState(18)
  const [wristIn, setWristIn] = useState(6.5)
  const [fit, setFit] = useState<BraceletFitKind>('comfort')

  const hasMetal = objects.some(o => o.material === 'metal')
  const print = hasMetal ? printEstimateFor(objects, printer) : null
  const hm = hallmarkCompliance(alloyId, market)
  const pave = paveRun(stoneMm, runMm)
  const chain = chainFitReport(chainIn, grams)
  const wrist = braceletFit(wristIn, fit)

  return (
    <div className="panel-block bench-planners">
      <h4 style={{ margin: 0 }}>Bench &amp; production planners</h4>

      {/* Printer */}
      <div className="bp-card">
        <div className="bp-head">
          <span>Print on</span>
          <select value={printer} onChange={e => setPrinter(e.target.value)}>
            {PRINTERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {print ? (
          <table className="stone-sched"><tbody>
            <tr><td>Time</td><td>{print.hours >= 1 ? `${print.hours.toFixed(1)} h` : `${print.minutes.toFixed(0)} min`} · {print.layers.toLocaleString()} layers</td></tr>
            <tr><td>Material</td><td>{print.totalMl.toFixed(2)} mL {print.profile.materialName} · ${print.materialCost.toFixed(2)}</td></tr>
            <tr><td>Castable</td><td>{print.castable ? 'Yes — burns out clean' : 'No — prototype/fit only'}</td></tr>
          </tbody></table>
        ) : <p className="disc">Add metal to the bench to estimate a print.</p>}
        {print?.profile.note && <p className="disc">{print.profile.note}</p>}
      </div>

      {/* Hallmark compliance */}
      <div className="bp-card">
        <div className="bp-head">
          <span>Hallmark for</span>
          <select value={market} onChange={e => setMarket(e.target.value as Market)}>
            {MARKETS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        {hm.requiredMarks.length ? (
          <>
            <p className="disc" style={{ marginTop: 4 }}>
              {alloy.name} · {hm.finenessPpt}‰ ·{' '}
              {hm.compulsoryAssay ? 'compulsory assay hallmark' : 'self-certified'}
              {hm.makersMarkRequired ? " · maker's mark required" : ''}
            </p>
            <ul className="bp-marks">{hm.requiredMarks.map((m, i) => <li key={i}>{m}</li>)}</ul>
            {hm.callable && !hm.callable.ok && (
              <p className="disc bp-warn">⚠ Below {hm.callable.threshold}‰ — can't be sold as "{hm.callable.word}" here.</p>
            )}
          </>
        ) : (
          <p className="disc">{hm.notes[0] ?? 'No precious-metal marks apply.'}</p>
        )}
        <p className="disc">Guidance, not legal advice — confirm with your assay office. Ref: {hm.authority}.</p>
      </div>

      {/* Pavé run */}
      <div className="bp-card">
        <div className="bp-head"><span>Pavé run</span>
          <label className="bp-in">stone <input type="number" step="0.1" min="0.5" value={stoneMm} onChange={e => setStoneMm(+e.target.value || 0)} /> mm</label>
          <label className="bp-in">length <input type="number" step="1" min="1" value={runMm} onChange={e => setRunMm(+e.target.value || 0)} /> mm</label>
        </div>
        <table className="stone-sched"><tbody>
          <tr><td>Fits</td><td>{pave.count} stones · {pave.pitchMm.toFixed(2)} mm pitch</td></tr>
          <tr><td>Wall / seat</td><td className={pave.wallOk ? '' : 'bp-warn'}>{pave.wallMm.toFixed(2)} mm {pave.wallOk ? '✓' : '⚠ too thin'}</td></tr>
          <tr><td>Tools</td><td>{pave.burMm} mm bur · {pave.drillMm} mm drill · {pave.beads} beads</td></tr>
        </tbody></table>
      </div>

      {/* Chain fit */}
      <div className="bp-card">
        <div className="bp-head"><span>Necklace</span>
          <label className="bp-in"><input type="number" step="1" min="10" value={chainIn} onChange={e => setChainIn(+e.target.value || 0)} /> in</label>
        </div>
        <table className="stone-sched"><tbody>
          <tr><td>Sits</td><td>{chain.nearest.name} — {chain.nearest.sits}{chain.exactStandard ? '' : ' (nearest standard)'}</td></tr>
          <tr><td>Clasp</td><td>{chain.clasp}{grams > 0 ? ` · ${grams.toFixed(1)} g` : ''}</td></tr>
        </tbody></table>
        <div className="bp-head" style={{ marginTop: 6 }}><span>Bracelet</span>
          <label className="bp-in">wrist <input type="number" step="0.25" min="4" value={wristIn} onChange={e => setWristIn(+e.target.value || 0)} /> in</label>
          <select value={fit} onChange={e => setFit(e.target.value as BraceletFitKind)}>
            <option value="snug">Snug</option><option value="comfort">Comfort</option><option value="loose">Loose</option>
          </select>
        </div>
        <p className="disc">Finished length: <b>{wrist.lengthIn}"</b> (wrist + {wrist.allowanceIn}" {fit}).</p>
      </div>
    </div>
  )
}
