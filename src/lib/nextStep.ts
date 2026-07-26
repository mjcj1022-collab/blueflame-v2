import type { DesignSpec } from '../spec/types'
import { hasCenterStone, NO_STONE } from '../spec/types'

export type Mode = 'design' | 'model' | 'color' | 'ai'

export interface NextTip { id: string; text: string }

/**
 * Context-aware "next step" hints, in priority order. The toast shows the first
 * tip whose condition holds and that hasn't been dismissed this session — so as
 * the design progresses (or a tip is closed), the suggestion advances. Pure so
 * it's easy to unit-test.
 */
export function nextStepTip(spec: DesignSpec, mode: Mode, dismissed: string[]): NextTip | null {
  const done = new Set(dismissed)
  const tips: NextTip[] = []

  tips.push({ id: 'welcome', text: 'Start by choosing a piece type at the top, then set the metal and stone below.' })

  if (hasCenterStone(spec.category) && spec.center.stoneTypeId === NO_STONE) {
    tips.push({ id: 'add-stone', text: 'Add a center stone in the Stone section to bring the piece to life.' })
  }

  if (mode === 'design') {
    tips.push({ id: 'explode', text: 'Drag the Explode slider (bottom of the 3D view) to separate the parts and inspect the build.' })
    tips.push({ id: 'try-ai', text: 'Try the AI ✦ tab — describe a piece in plain English and watch it build.' })
  }
  if (mode !== 'model') {
    tips.push({ id: 'try-sculpt', text: 'Open the Sculpt tab to free-form model — then use the new Twist, Taper and Bend tools.' })
  }
  tips.push({ id: 'color', text: 'Use the Color tab to try custom finishes and colorways on your piece.' })

  return tips.find((t) => !done.has(t.id)) ?? null
}
