/**
 * The very first thing anyone hits — a marketing/landing page introducing
 * Mandrel before they're asked to sign in or create a shop account. Purely
 * informational: the single CTA hands off to the existing Login screen
 * (which already offers both New member and Existing member).
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

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing-wrap">
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
    </div>
  )
}
