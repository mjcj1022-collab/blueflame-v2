import { useDesign } from '../state/design'
import { designFeatures, isHidden, isDeletable } from '../lib/features'

const copyOut = (text: string) => { try { void navigator.clipboard?.writeText(text) } catch { /* clipboard blocked */ } }

/**
 * The attribute table, floated on the left of the 3D stage. Lists every
 * rendered object in the design; click a row to hide/restore it, copy its
 * name to the clipboard, or — for optional additions — permanently delete it
 * from the design (unlike Hide, this can't be undone with "Add" afterward).
 */
export function AttributesOverlay() {
  const spec = useDesign(s => s.spec)
  const toggle = useDesign(s => s.toggleHidden)
  const del = useDesign(s => s.deleteFeature)
  const feats = designFeatures(spec)
  if (!feats.length) return null
  const shown = feats.filter(f => !isHidden(spec, f.key))

  return (
    <div className="stage-attrs">
      <h5>Attributes <b>{shown.length}/{feats.length}</b></h5>
      {feats.map(f => {
        const hidden = isHidden(spec, f.key)
        const deletable = isDeletable(spec, f.key)
        return (
          <div key={f.key} className={`attr-row ${hidden ? 'off' : ''}`} onClick={() => toggle(f.key)}>
            <span>{f.label}</span>
            <span className="attr-acts">
              <button onClick={e => { e.stopPropagation(); copyOut(f.label) }} title="Copy name to clipboard">Copy</button>
              <button onClick={e => { e.stopPropagation(); toggle(f.key) }} title={hidden ? 'Restore' : 'Hide from the piece'}>{hidden ? 'Add' : 'Hide'}</button>
              {deletable && (
                <button
                  className="attr-del"
                  onClick={e => {
                    e.stopPropagation()
                    if (window.confirm(`Delete ${f.label}? This can't be undone with Add — use Undo if you change your mind.`)) del(f.key)
                  }}
                  title="Permanently delete this feature"
                >Delete</button>
              )}
            </span>
          </div>
        )
      })}
      <div className="attrs-foot">
        <button onClick={() => copyOut(shown.map(f => f.label).join('\n'))} title="Copy all shown objects">Copy all</button>
      </div>
    </div>
  )
}
