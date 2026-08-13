import { useState } from 'react'
import { useDesign } from '../state/design'
import { sizeToDiameter, sizeToCircumference, sizeConversions, formatSize } from '../lib/sizing'

type Tab = 'about' | 'sizing' | 'returns' | 'contact'
const TABS: [Tab, string][] = [['about', 'About'], ['sizing', 'Size guide'], ['returns', 'Returns & warranty'], ['contact', 'Contact']]

const SIZE_ROWS = Array.from({ length: 21 }, (_, i) => 3 + i * 0.5)

/**
 * The information a buyer actually looks for before committing to a custom
 * order: who's making it, how sizing works, what happens if it doesn't fit
 * or something's wrong, and how to reach the shop. Reachable from every tab
 * via the ⓘ button in the masthead — nothing here depends on being mid-design.
 */
export function PoliciesModal({ onClose }: { onClose: () => void }) {
  const shop = useDesign(s => s.shop)
  const [tab, setTab] = useState<Tab>('about')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-win policies-win" onClick={e => e.stopPropagation()} role="dialog" aria-label="Shop information">
        <div className="settings-head">
          <h2>{shop.name}</h2>
          <button className="settings-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="policies-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={`policies-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div className="settings-body policies-body">
          {tab === 'about' && (
            <div className="settings-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              <b>Made on the bench, with you</b>
              <p className="disc" style={{ marginTop: 8 }}>
                Every piece from {shop.name} starts as a design session, not a catalog pick — you set the metal, the stone,
                the fit, and watch it take shape before anything is cast. Once you approve the design, it's cast, set, and
                hand-finished before it ships to you.
              </p>
              <p className="disc" style={{ marginTop: 10 }}>
                Prices are calculated live from current metal spot, stone cost, and labor — the number you see on your
                quote is what you pay, no surprise markup at pickup.
              </p>
            </div>
          )}

          {tab === 'sizing' && (
            <div className="settings-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              <b>Ring sizing</b>
              <p className="disc" style={{ marginTop: 6 }}>
                Every ring is built to the exact US size on your quote. Not sure of your size? Any local jeweler can
                measure you for free, or use the diameter/circumference below with a flexible tape or a printed sizer.
              </p>
              <div className="cmp-scroll" style={{ marginTop: 10 }}>
                <table className="cmp size-tbl">
                  <thead>
                    <tr><th style={{ textAlign: 'left' }}>US</th><th>Diameter</th><th>Circumference</th><th>UK</th><th>EU</th><th>JP</th></tr>
                  </thead>
                  <tbody>
                    {SIZE_ROWS.map(size => {
                      const c = sizeConversions(size)
                      return (
                        <tr key={size}>
                          <th scope="row" style={{ display: 'table-cell' }}>{formatSize(size)}</th>
                          <td>{sizeToDiameter(size).toFixed(2)} mm</td>
                          <td>{sizeToCircumference(size).toFixed(1)} mm</td>
                          <td>{c.uk}</td>
                          <td>{c.eu.toFixed(1)} mm</td>
                          <td>{c.jp}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="disc" style={{ marginTop: 10 }}>
                Bands 5 mm and wider tend to fit snugger than the size chart suggests — we account for this automatically
                when you set band width on your design, and will flag it on your quote if a size-up is worth considering.
              </p>
            </div>
          )}

          {tab === 'returns' && (
            <div className="settings-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              <b>Returns & exchanges</b>
              <p className="disc" style={{ marginTop: 6 }}>
                Because each piece is made to order for you specifically, we're not able to offer refunds once
                production has started. If anything isn't right, tell us within 7 days of delivery and we'll fix it —
                that includes a complimentary resize within 30 days of pickup.
              </p>
              <b style={{ display: 'block', marginTop: 16 }}>Warranty</b>
              <p className="disc" style={{ marginTop: 6 }}>
                Every piece is covered for one year against manufacturing defects — loose stones, solder failures,
                plating wear from normal use. This doesn't cover damage from impact, loss, or a setting that was never
                reported as loose. Bring it back any time and we'll take a look, warranty or not.
              </p>
            </div>
          )}

          {tab === 'contact' && (
            <div className="settings-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              <b>Get in touch</b>
              {shop.email || shop.phone ? (
                <div className="policies-contact">
                  {shop.email && <a href={`mailto:${shop.email}`} className="opt">✉ {shop.email}</a>}
                  {shop.phone && <a href={`tel:${shop.phone.replace(/[^0-9+]/g, '')}`} className="opt">☎ {shop.phone}</a>}
                </div>
              ) : (
                <p className="disc" style={{ marginTop: 8 }}>
                  Ask {shop.name} directly for the best way to reach them about an order in progress.
                </p>
              )}
              <p className="disc" style={{ marginTop: 12 }}>
                Questions about a quote, a design change, or timing — reach out any time before or after you order.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
