import { useDesign } from '../state/design'
import {
  ALLOYS, SHAPES, STONES, SETTINGS, FINISHES, TEMPLATES,
} from '../catalog'
import { NECKLACE_STYLES } from '../lib/necklaceChain'
import { MOTIFS } from '../lib/motif'
import { CATEGORY_LABEL, stoneOnPiece, NO_STONE, type ProductCategory } from '../spec/types'

const CATEGORIES: ProductCategory[] = ['ring', 'pendant', 'earring', 'bracelet', 'necklace', 'body']
const TEMPLATE_CATS: ProductCategory[] = ['ring', 'necklace', 'bracelet', 'earring', 'pendant']

/**
 * A single dropdown of every premade design, grouped by category — a fast way
 * to drop in a realistic starting piece and then tune it. Applies on pick.
 */
export function TemplateBrowser() {
  const load = useDesign(s => s.load)
  return (
    <div className="qc-field qc-templates">
      <label htmlFor="qc-template">Start from a premade design</label>
      <select id="qc-template" value="" onChange={e => {
        const t = TEMPLATES.find(x => x.id === e.target.value)
        if (t) load(t.build())
      }}>
        <option value="" disabled>Choose a design… ({TEMPLATES.length} styles)</option>
        {TEMPLATE_CATS.map(c => (
          <optgroup key={c} label={CATEGORY_LABEL[c]}>
            {TEMPLATES.filter(t => t.category === c).map(t => (
              <option key={t.id} value={t.id}>{t.name} — {t.blurb}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

/** One labelled dropdown row. */
function Field({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  const id = `qc-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <div className="qc-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}>{children}</select>
    </div>
  )
}

/**
 * A compact, dropdown-driven configurator — one menu per feature (piece type,
 * metal, stone, shape, setting, finish, and, for a necklace, chain type and
 * motif). Mirrored on the Design tab and inside the AI studio so a maker can
 * pick a piece "by type" from menus, the way a jeweler's site configurator works,
 * without hunting through the swatch grids. Writes straight to the live design.
 */
export function QuickConfigure() {
  const spec = useDesign(s => s.spec)
  const { setCategory, setAlloy, setShape, setStone, setSetting, setFinish, setNecklace } = useDesign()
  const cat = spec.category
  const hasStone = stoneOnPiece(spec)
  const stoneCapable = cat === 'ring' || cat === 'pendant' || cat === 'earring' || cat === 'bracelet' || cat === 'necklace'

  return (
    <div className="quick-config">
      <div className="qc-grid">
        <Field label="Piece" value={cat} onChange={v => setCategory(v as ProductCategory)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </Field>

        <Field label="Metal" value={spec.metal.alloyId} onChange={setAlloy}>
          {ALLOYS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Field>

        {cat === 'necklace' && (
          <>
            <Field label="Chain type" value={spec.necklace.chainStyle ?? 'cable'} onChange={v => setNecklace({ chainStyle: v as never })}>
              {NECKLACE_STYLES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Field>
            <Field label="Motif" value={spec.necklace.motif ?? 'none'} onChange={v => setNecklace({ motif: v as never })}>
              <option value="none">None (plain / stone)</option>
              {MOTIFS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Field>
          </>
        )}

        {stoneCapable && (
          <Field label="Stone" value={hasStone ? spec.center.stoneTypeId : NO_STONE}
            onChange={v => setStone(v)}>
            <option value={NO_STONE}>None (plain metal)</option>
            {STONES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Field>
        )}

        {stoneCapable && hasStone && (
          <Field label="Shape" value={spec.center.shapeId} onChange={setShape}>
            {SHAPES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Field>
        )}

        {(cat === 'ring' || cat === 'pendant' || cat === 'earring') && hasStone && (
          <Field label="Setting" value={spec.setting.typeId} onChange={setSetting}>
            {SETTINGS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Field>
        )}

        <Field label="Finish" value={spec.finish} onChange={v => setFinish(v as never)}>
          {FINISHES.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Field>
      </div>
    </div>
  )
}
