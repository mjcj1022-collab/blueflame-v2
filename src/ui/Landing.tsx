/**
 * The very first thing anyone hits — a marketing/landing page introducing
 * Mandrel before they're asked to sign in or create a shop account. Purely
 * informational: the single CTA hands off to the existing Login screen
 * (which already offers both New member and Existing member).
 *
 * Flanked on both sides by small stylized line-art icons of the kinds of
 * pieces the studio produces (ring, earrings, bracelet, necklace) — real
 * product renders would need a live sign-in to generate, so these stand in
 * as a quick visual sense of "jewelry design tool" before anyone's signed
 * in at all.
 */
const FEATURES: { title: string; body: string }[] = [
  {
    title: 'Design + AI studio',
    body: 'Configure a piece by hand — metal, stone, setting, finish — or describe it in plain English and watch the AI studio build it.',
  },
  {
    title: 'Free-form Sculpt',
    body: 'A true 3D CSG modeler: sketch a profile and revolve it, or place vertices in space and wire up a custom build from scratch.',
  },
  {
    title: 'Live quoting & production',
    body: 'Every change reprices instantly — metal weight, stone cost, labor. Export STL, tech packs, and client-ready sheets when it’s done.',
  },
  {
    title: 'Cloud library & team',
    body: 'Save designs and sculpts to your shop’s account, invite bench and setter accounts, and pick up any piece on any device.',
  },
]

/** A soft gold glow behind every icon's linework — shared by all four. */
function IconDefs() {
  return (
    <defs>
      <filter id="landing-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

function RingIcon() {
  return (
    <svg viewBox="0 0 100 100" className="landing-icon-svg">
      <IconDefs />
      <g filter="url(#landing-glow)" fill="none" stroke="#E7C989" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="50" cy="66" rx="25" ry="19" stroke="#C6A265" />
        <path d="M50 22 L62 36 L50 50 L38 36 Z" />
        <path d="M42 36 L58 36 M50 26 L50 46" strokeWidth="1.2" opacity="0.6" />
        <path d="M40 47 L34 55 M60 47 L66 55" strokeWidth="1.8" />
      </g>
    </svg>
  )
}

function EarringsIcon() {
  return (
    <svg viewBox="0 0 100 100" className="landing-icon-svg">
      <IconDefs />
      <g filter="url(#landing-glow)" fill="none" stroke="#E7C989" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        {[30, 70].map(cx => (
          <g key={cx}>
            <circle cx={cx} cy="26" r="4" stroke="#C6A265" />
            <path d={`M${cx} 30 L${cx} 40`} strokeWidth="1.4" opacity="0.7" />
            <path d={`M${cx} 40 C${cx - 12} 46, ${cx - 12} 64, ${cx} 72 C${cx + 12} 64, ${cx + 12} 46, ${cx} 40 Z`} />
          </g>
        ))}
      </g>
    </svg>
  )
}

function BraceletIcon() {
  const cxs = [26, 38, 50, 62, 74]
  return (
    <svg viewBox="0 0 100 100" className="landing-icon-svg">
      <IconDefs />
      <g filter="url(#landing-glow)" fill="none" stroke="#E7C989" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M18 58 Q50 76 82 58" stroke="#C6A265" strokeWidth="1.4" opacity="0.55" />
        {cxs.map((cx, i) => (
          <circle key={cx} cx={cx} cy={58 + Math.sin((i / (cxs.length - 1)) * Math.PI) * 12} r="6" />
        ))}
      </g>
    </svg>
  )
}

function NecklaceIcon() {
  return (
    <svg viewBox="0 0 100 100" className="landing-icon-svg">
      <IconDefs />
      <g filter="url(#landing-glow)" fill="none" stroke="#E7C989" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M22 24 C22 52, 40 58, 50 58 C60 58, 78 52, 78 24" stroke="#C6A265" strokeWidth="1.4" opacity="0.7" />
        <path d="M50 58 L44 68 L50 80 L56 68 Z" />
      </g>
    </svg>
  )
}

const LEFT_ICONS: { key: string; label: string; render: () => React.ReactNode }[] = [
  { key: 'ring', label: 'Rings', render: RingIcon },
  { key: 'bracelet', label: 'Bracelets', render: BraceletIcon },
]
const RIGHT_ICONS: { key: string; label: string; render: () => React.ReactNode }[] = [
  { key: 'earrings', label: 'Earrings', render: EarringsIcon },
  { key: 'necklace', label: 'Necklaces', render: NecklaceIcon },
]

function IconColumn({ items }: { items: typeof LEFT_ICONS }) {
  return (
    <div className="landing-icon-col">
      {items.map(it => (
        <div key={it.key} className="landing-icon-card">
          {it.render()}
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  )
}

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing-wrap">
      <div className="landing-flank">
        <IconColumn items={LEFT_ICONS} />

        <div className="landing-card">
          <div className="logo landing-logo">MAN<em>DREL</em></div>
          <p className="login-sub">Jewelry Design Studio</p>

          <h1 className="landing-head">Design, quote, and produce fine jewelry — all in one studio.</h1>
          <p className="landing-sub">
            Mandrel is the complete workbench for a modern jewelry shop: a design and sculpting studio, an AI
            assistant that turns a description into a real piece, and the quoting and production tools to take it
            from bench to client.
          </p>

          <div className="landing-feats">
            {FEATURES.map(f => (
              <div key={f.title} className="landing-feat">
                <b>{f.title}</b>
                <span>{f.body}</span>
              </div>
            ))}
          </div>

          <button className="login-btn landing-cta" onClick={onEnter}>Log in or create an account →</button>
          <p className="login-sub" style={{ margin: '2px 0 0' }}>Existing member or new member — both start here</p>
        </div>

        <IconColumn items={RIGHT_ICONS} />
      </div>
    </div>
  )
}
