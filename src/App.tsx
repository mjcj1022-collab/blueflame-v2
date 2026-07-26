import { useState, useEffect } from 'react'
import { Scene } from './viewer/Scene'
import { ModelerScene } from './viewer/ModelerScene'
import { ColorScene } from './viewer/ColorScene'
import { ColorPanel } from './ui/ColorPanel'
import { GalleryModal } from './ui/GalleryModal'
import { AIStudioPanel } from './ui/AIStudioPanel'
import { Controls } from './ui/Controls'
import { MetalPanel } from './ui/MetalPanel'
import { MetalOptionsPanel } from './ui/MetalOptionsPanel'
import { StoneSourcePanel } from './ui/StoneSourcePanel'
import { QuotePanel } from './ui/QuotePanel'
import { ProductionPanel } from './ui/ProductionPanel'
import { VariantsPanel } from './ui/VariantsPanel'
import { OrderPanel } from './ui/OrderPanel'
import { CustomersPanel } from './ui/CustomersPanel'
import { LibraryPanel } from './ui/LibraryPanel'
import { ProjectsPanel } from './ui/ProjectsPanel'
import { ModelerPanel } from './ui/ModelerPanel'
import { MetalGenerator } from './ui/MetalGenerator'
import { Tour } from './ui/Tour'
import { BackendStatus } from './ui/BackendStatus'
import { useDesign } from './state/design'
import { useModeler } from './state/modeler'
import { useAuth } from './state/auth'
import { useWorkspace } from './state/workspace'
import { autosave } from './lib/autosave'
import { computeMetal } from './lib/metal'
import { computePrice } from './lib/pricing'
import { money } from './lib/units'
import { CATEGORY_LABEL } from './spec/types'
import { shareUrl, specFromUrl } from './lib/share'
import { fetchAndApplySpot } from './lib/spot'

type Mode = 'design' | 'model' | 'color' | 'ai'

function Masthead({ mode, setMode, onLab, onTour, onGallery }: { mode: Mode; setMode: (m: Mode) => void; onLab: () => void; onTour: () => void; onGallery: () => void }) {
  const spec = useDesign(s => s.spec)
  const reset = useDesign(s => s.reset)
  const shop = useDesign(s => s.shop)
  const undo = useDesign(s => s.undo)
  const redo = useDesign(s => s.redo)
  const canUndo = useDesign(s => s.past.length > 0)
  const canRedo = useDesign(s => s.future.length > 0)
  const authUser = useAuth(s => s.user)
  const logout = useAuth(s => s.logout)
  const [shared, setShared] = useState(false)
  const m = computeMetal(spec)
  const p = computePrice(spec)
  const share = async () => {
    try { await navigator.clipboard.writeText(shareUrl(spec)); setShared(true); setTimeout(() => setShared(false), 2000) } catch { /* clipboard blocked */ }
  }
  return (
    <header className="mast">
      <div className="mast-in">
        <span className="logo">{shop.name === 'Blue Flame' ? <>BLUE&nbsp;<em>FLAME</em></> : shop.name}</span>
        <div className="mode-tabs">
          <button aria-pressed={mode === 'design'} onClick={() => setMode('design')}>Design</button>
          <button className="tab-ai" aria-pressed={mode === 'ai'} onClick={() => setMode('ai')}>AI&nbsp;✦</button>
          <button aria-pressed={mode === 'color'} onClick={() => setMode('color')}>Color</button>
          <button aria-pressed={mode === 'model'} onClick={() => setMode('model')}>Sculpt</button>
        </div>
        {mode === 'design' ? (
          <>
            <span className="tag">{CATEGORY_LABEL[spec.category]}</span>
            <span className="mast-fig">{m.finished.toFixed(2)} g finished</span>
            <span className="mast-fig">{m.pour.toFixed(2)} g to pour</span>
            {!shop.hideCost && <span className="mast-fig strong">{money(p.total)}</span>}
            <button className="mast-lab" onClick={share}>{shared ? 'Link copied' : 'Share'}</button>
          </>
        ) : mode === 'color' ? (
          <span className="tag">{CATEGORY_LABEL[spec.category]} · custom color studio</span>
        ) : mode === 'ai' ? (
          <span className="tag">AI design studio · describe it, watch it build</span>
        ) : (
          <span className="tag">Free-form CSG modeler</span>
        )}
        <button className="mast-lab" onClick={onGallery} title="Open the gallery">Gallery</button>
        <button className="mast-lab" onClick={onLab}>Metal Lab</button>
        <button className="mast-lab" onClick={onTour} title="Show the tour" aria-label="Show the tour">?</button>
        {mode === 'design' && (
          <>
            <button className="mast-reset" disabled={!canUndo} onClick={undo} title="Undo (Ctrl/⌘+Z)">↶</button>
            <button className="mast-reset" disabled={!canRedo} onClick={redo} title="Redo (Ctrl/⌘+Shift+Z)">↷</button>
            <button className="mast-reset" onClick={reset}>Reset</button>
          </>
        )}
        <BackendStatus />
        <span className="mast-user">{authUser}<button className="mast-signout" onClick={logout}>sign out</button></span>
      </div>
    </header>
  )
}

const TOUR_KEY = 'blue-flame.tour.v1'

export default function App() {
  const [labOpen, setLabOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(true)   // the first window on launch
  const [tourOpen, setTourOpen] = useState(() => { try { return !localStorage.getItem(TOUR_KEY) } catch { return false } })
  const mode = useWorkspace(s => s.mode)
  const setMode = useWorkspace(s => s.setMode)
  const load = useDesign(s => s.load)
  const closeTour = () => { try { localStorage.setItem(TOUR_KEY, '1') } catch { /* private mode */ } setTourOpen(false) }

  // Restore on load: a shared ?d= link wins; otherwise the autosaved design and
  // sculpt come back exactly as they were left. History starts clean.
  useEffect(() => {
    const shared = specFromUrl()
    if (shared) load(shared)
    else { const saved = autosave.readDesign(); if (saved) load(saved) }
    useDesign.setState({ past: [], future: [] })
    const savedSculpt = autosave.readSculpt()
    if (savedSculpt && savedSculpt.length) useModeler.setState({ objects: savedSculpt, past: [], future: [], selectedId: null })
    // Pull today's live metal spot (if a backend + metals key are set) and apply
    // it over the catalog spots, then nudge a re-render so quotes reflect it.
    void fetchAndApplySpot().then(m => { if (Object.keys(m.prices).length) useDesign.setState(st => ({ spec: { ...st.spec } })) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autosave both workspaces (debounced) on every change.
  useEffect(() => {
    const unsubD = useDesign.subscribe((st, prev) => { if (st.spec !== prev.spec) autosave.writeDesign(st.spec) })
    const unsubS = useModeler.subscribe((st, prev) => { if (st.objects !== prev.objects) autosave.writeSculpt(st.objects) })
    return () => { unsubD(); unsubS() }
  }, [])

  return (
    <>
      <Masthead mode={mode} setMode={setMode} onLab={() => setLabOpen(true)} onTour={() => setTourOpen(true)} onGallery={() => setGalleryOpen(true)} />
      <div className="app">
        {mode === 'design' ? (
          <>
            <Scene suggest />
            <aside className="panel">
              <div className="panel-scroll">
                <Controls />
                <StoneSourcePanel />
                <VariantsPanel />
                <MetalPanel />
                <MetalOptionsPanel />
                <ProductionPanel />
                <OrderPanel />
                <CustomersPanel />
                <LibraryPanel />
                <ProjectsPanel />
              </div>
              <QuotePanel />
            </aside>
          </>
        ) : mode === 'color' ? (
          <>
            <ColorScene />
            <aside className="panel">
              <div className="panel-scroll">
                <ColorPanel />
              </div>
            </aside>
          </>
        ) : mode === 'ai' ? (
          <>
            <Scene />
            <aside className="panel ai-aside">
              <AIStudioPanel />
            </aside>
          </>
        ) : (
          <>
            <ModelerScene />
            <aside className="panel">
              <div className="panel-scroll">
                <ModelerPanel />
              </div>
            </aside>
          </>
        )}
      </div>
      <MetalGenerator open={labOpen} onClose={() => setLabOpen(false)} />
      {galleryOpen && <GalleryModal onClose={() => setGalleryOpen(false)} />}
      {tourOpen && !galleryOpen && <Tour onClose={closeTour} />}
    </>
  )
}
