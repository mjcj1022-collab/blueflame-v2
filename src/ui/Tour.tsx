import { useState } from 'react'

export interface TourStep { title: string; body: string }

/** The first-run walkthrough. Kept as data so it's easy to test and extend. */
export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Mandrel',
    body: 'Design fine jewelry two ways — a parametric configurator and a free-form 3D sculptor. Here’s the 30-second tour. You can reopen it any time from the “?” in the top bar.'
  },
  {
    title: 'The Design tab',
    body: 'Pick a category (ring, pendant, earrings…) and a template, then tune size, metal, stone and setting. The 3D preview, the finished weight and the price all update live as you go.'
  },
  {
    title: 'The Color tab',
    body: 'Open Color for a custom-color studio: click the metal or the stone on the 3D render, then paint it with a Photoshop-style picker or a click of a preset swatch. Colors preview live and never change your real specs — “Reset all colors” clears them.'
  },
  {
    title: 'The Sculpt tab',
    body: 'Switch to Sculpt for free-form modeling: drop in jewelry parts or primitives, move them with the gizmo, combine them with union / subtract / intersect, and export a print-ready STL.'
  },
  {
    title: 'Free draw',
    body: 'In Sculpt → Free draw → “Sketch a shape…”, draw a profile on the pad and Revolve it 360° (bands, bezels, beads) or Extrude it (charms, initials) into a real solid.'
  },
  {
    title: 'Sculpt the vertices',
    body: 'Select any part → Make editable → Vertices, then click a point and drag it. Mirror-X symmetry, Smooth and Subdivide give you fine control. Send a whole ring over with “Send ring → Sculpt”.'
  },
  {
    title: 'Nothing gets lost',
    body: 'Both tabs auto-save and come back on refresh. Undo / redo (Ctrl/⌘+Z) works everywhere. Save named designs, sculpts, or a whole project (design + sculpt together). That’s it — have fun.'
  }
]

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = TOUR_STEPS[i]
  const last = i === TOUR_STEPS.length - 1

  return (
    <div className="lab-overlay" onClick={onClose}>
      <div className="lab tour" style={{ width: 'min(440px,95vw)' }} onClick={e => e.stopPropagation()}>
        <div className="lab-head">
          <div>
            <h2>{step.title}</h2>
            <p>Step {i + 1} of {TOUR_STEPS.length}</p>
          </div>
          <button className="lab-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="tour-body">
          <p>{step.body}</p>
          <div className="tour-dots">{TOUR_STEPS.map((_, j) => <i key={j} className={j === i ? 'on' : ''} />)}</div>
          <div className="tour-nav">
            <button className="ghost" onClick={onClose}>Skip</button>
            <div className="tour-nav-r">
              {i > 0 && <button className="opt" onClick={() => setI(i - 1)}>Back</button>}
              <button className="primary" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Got it' : 'Next'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
