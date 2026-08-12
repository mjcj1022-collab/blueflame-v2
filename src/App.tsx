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
import { ProductionPanel } from './ui/ProductionPanel'
import { VariantsPanel } from './ui/VariantsPanel'
import { CustomersPanel } from './ui/CustomersPanel'
import { TeamPanel } from './ui/TeamPanel'
import { AffiliatesPanel } from './ui/AffiliatesPanel'
import { LibraryPanel } from './ui/LibraryPanel'
import { ProjectsPanel } from './ui/ProjectsPanel'
import { ModelerPanel } from './ui/ModelerPanel'
import { MetalGenerator } from './ui/MetalGenerator'
import { Tour } from './ui/Tour'
import { SettingsModal } from './ui/SettingsModal'
import { HotkeysModal } from './ui/HotkeysModal'
import { SuggestToast } from './ui/SuggestToast'
import { BackendStatus } from './ui/BackendStatus'
import { useDesign } from './state/design'
import { useModeler } from './state/modeler'
import { useAuth } from './state/auth'
import { PAYWALL_ENABLED, accessFromSubscription } from './lib/plans'
import { apiConfigured } from './lib/api'
import { Pricing } from './ui/Pricing'
import { useWorkspace } from './state/workspace'
import { useSettings } from './state/settings'
import { autosave, projects } from './lib/autosave'
import { computeMetal } from './lib/metal'
import { CATEGORY_LABEL } from './spec/types'
import { shareUrl, specFromUrl } from './lib/share'
import { fetchAndApplySpot } from './lib/spot'

type Mode = 'design' | 'model' | 'color' | 'ai'

function Masthead({ mode, setMode, onLab, onTour, onGallery, onSettings, onHotkeys }: { mode: Mode; setMode: (m: Mode) => void; onLab: () => void; onTour: () => void; onGallery: () => void; onSettings: () => void; onHotkeys: () => void }) {
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
  const [saved, setSaved] = useState(false)
  const m = computeMetal(spec)
  const share = async () => {
    try { await navigator.clipboard.writeText(shareUrl(spec)); setShared(true); setTimeout(() => setShared(false), 2000) } catch { /* clipboard blocked */ }
  }
  // One-click save reachable from every tab — bundles the current design AND
  // whatever's on the Sculpt bench into a single named project, same data a
  // manual save from the Projects panel would capture. Named automatically so
  // there's nothing to type; open the Projects panel to rename or manage saves.
  const quickSave = () => {
    const s = useDesign.getState().spec
    const sculpt = useModeler.getState().objects
    const stamp = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    projects.save(`${CATEGORY_LABEL[s.category]} — ${stamp}`, s, sculpt)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  return (
    <header className="mast">
      <div className="mast-in">
        <span className="logo">{shop.name === 'Mandrel' ? <>MAN<em>DREL</em></> : shop.name}</span>
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
        <button className="mast-lab" onClick={onSettings} title="Settings" aria-label="Settings">⚙</button>
        <button className="mast-lab" onClick={onHotkeys} title="Keyboard shortcuts" aria-label="Keyboard shortcuts">⌨</button>
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
      {/* Pinned to the header's own top-right corner, outside the crowded
          icon row — same one-click save on every tab, but unmistakable
          instead of blending into the Gallery/Metal Lab/settings cluster. */}
      <button className="mast-save-fab" onClick={quickSave} title="Save the current design + sculpt as a project — works from any tab">
        {saved ? '✓ Saved' : '💾 Save'}
      </button>
    </header>
  )
}

const TOUR_KEY = 'mandrel.tour.v1'

export default function App() {
  const [labOpen, setLabOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(true)   // the first window on launch
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hotkeysOpen, setHotkeysOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(() => { try { return !localStorage.getItem(TOUR_KEY) } catch { return false } })
  const mode = useWorkspace(s => s.mode)
  const setMode = useWorkspace(s => s.setMode)
  const subscription = useAuth(s => s.subscription)
  const subscriptionChecked = useAuth(s => s.subscriptionChecked)
  const load = useDesign(s => s.load)
  const hiddenPanels = useSettings(s => s.hiddenPanels)
  const paperTexture = useSettings(s => s.paperTexture)
  const compact = useSettings(s => s.compact)
  const show = (key: string) => !hiddenPanels.includes(key)
  const closeTour = () => { try { localStorage.setItem(TOUR_KEY, '1') } catch { /* private mode */ } setTourOpen(false) }

  // Appearance prefs → root classes the stylesheet reacts to.
  useEffect(() => {
    document.documentElement.classList.toggle('no-grain', !paperTexture)
    document.documentElement.classList.toggle('compact', compact)
  }, [paperTexture, compact])

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
    void useAuth.getState().refreshSubscription()   // billing state (no-op without a backend)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carry an AI/Design-studio piece into the Sculpt modeler: on switching to
  // Sculpt with an empty bench, bring the current design in as editable parts.
  // Only when empty, so hand-sculpted work is never clobbered (the panel has a
  // manual "Bring in" button for that case).
  useEffect(() => {
    if (mode !== 'model') return
    if (useModeler.getState().objects.length > 0) return
    useModeler.getState().importFromDesign(useDesign.getState().spec, true)
  }, [mode])

  // Autosave both workspaces (debounced) on every change.
  useEffect(() => {
    const unsubD = useDesign.subscribe((st, prev) => { if (st.spec !== prev.spec) autosave.writeDesign(st.spec) })
    const unsubS = useModeler.subscribe((st, prev) => { if (st.objects !== prev.objects) autosave.writeSculpt(st.objects) })
    return () => { unsubD(); unsubS() }
  }, [])

  // Returning from Stripe checkout (?billing=success): the subscription lands via
  // webhook, which can lag a second or two. Poll a few times so a paying customer
  // slides straight into the studio instead of briefly seeing the paywall again,
  // then scrub the query param so a later refresh doesn't re-trigger it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('billing')) return
    const outcome = params.get('billing')
    const clean = () => {
      params.delete('billing')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    }
    if (outcome !== 'success') { clean(); return }
    let active = true, tries = 0
    const tick = async () => {
      await useAuth.getState().refreshSubscription()
      if (!active) return
      const sub = useAuth.getState().subscription
      if (accessFromSubscription(sub, Date.now()).allowed || ++tries >= 6) { clean(); return }
      setTimeout(() => { void tick() }, 2000)
    }
    void tick()
    return () => { active = false }
  }, [])

  // Paywall gate — pay-to-play by default, but only when a backend is present to
  // check subscriptions against. A shop with no active subscription (or one-time
  // offline purchase) sees the pricing screen instead of the studio. The offline
  // desktop build has no API, so this never fires there.
  //
  // Wait for the first subscription fetch to land before deciding: without this,
  // a paying member would flash the pricing screen for a moment right after
  // sign-in (subscription starts null until the network round trip finishes),
  // which reads as "sign-in didn't work." A quick "checking" screen instead of
  // Pricing fixes that without changing who ultimately gets in.
  if (PAYWALL_ENABLED && apiConfigured()) {
    if (!subscriptionChecked) {
      return (
        <div className="access-checking">
          <p>Checking your account…</p>
        </div>
      )
    }
    if (!accessFromSubscription(subscription, Date.now()).allowed) {
      return <Pricing />
    }
  }

  return (
    <>
      <Masthead mode={mode} setMode={setMode} onLab={() => setLabOpen(true)} onTour={() => setTourOpen(true)} onGallery={() => setGalleryOpen(true)} onSettings={() => setSettingsOpen(true)} onHotkeys={() => setHotkeysOpen(true)} />
      <div className="app">
        {/* Each scene's <Canvas> stays mounted for the life of the app — only its
            visibility toggles with the active mode. Fully unmounting a Canvas on
            every switch tears down its WebGL context, and creating a fresh one
            right as the old one is being torn down can stall or silently fail to
            ever size/draw (surfaced as Sculpt flashing black for several seconds,
            or occasionally never recovering). Keeping one instance per scene alive
            sidesteps that entirely — switching modes is just a display toggle. */}
        <div style={{ display: mode === 'design' || mode === 'ai' ? 'contents' : 'none' }}>
          <Scene suggest={mode === 'design'} />
        </div>
        <div style={{ display: mode === 'color' ? 'contents' : 'none' }}>
          <ColorScene />
        </div>
        <div style={{ display: mode === 'model' ? 'contents' : 'none' }}>
          <ModelerScene />
        </div>

        {mode === 'design' ? (
          <aside className="panel">
            <div className="panel-scroll">
              <Controls />
              {show('stoneSource') && <StoneSourcePanel />}
              {show('variants') && <VariantsPanel />}
              <MetalPanel />
              {show('metalOptions') && <MetalOptionsPanel />}
              {show('production') && <ProductionPanel />}
              {show('customers') && <CustomersPanel />}
              <TeamPanel />
              <AffiliatesPanel />
              {show('library') && <LibraryPanel />}
              {show('projects') && <ProjectsPanel />}
            </div>
          </aside>
        ) : mode === 'color' ? (
          <aside className="panel">
            <div className="panel-scroll">
              <ColorPanel />
            </div>
          </aside>
        ) : mode === 'ai' ? (
          <aside className="panel ai-aside">
            <AIStudioPanel />
          </aside>
        ) : (
          <aside className="panel">
            <div className="panel-scroll">
              <ModelerPanel />
            </div>
          </aside>
        )}
      </div>
      <MetalGenerator open={labOpen} onClose={() => setLabOpen(false)} />
      {galleryOpen && <GalleryModal onClose={() => setGalleryOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {hotkeysOpen && <HotkeysModal onClose={() => setHotkeysOpen(false)} />}
      {tourOpen && !galleryOpen && <Tour onClose={closeTour} />}
      <SuggestToast />
    </>
  )
}
