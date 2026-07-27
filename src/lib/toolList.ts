import type { SculptObject } from '../state/modeler'
import { stoneById } from '../catalog'
import { mmForCarat } from './stoneSize'
import { burForStoneMm } from './benchAdvisor'

/**
 * Tool & bur list. From the piece itself, the burs and bench tools a maker needs
 * to pull before starting — setting burs sized to each stone, a bearing/hart bur,
 * prong tools for heads, and the finishing kit. So the bench is set up once, not
 * rummaged through mid-job. Derived from the stones, mounts and features present.
 */

export interface ToolItem { tool: string; detail: string }

export function toolList(objects: SculptObject[]): ToolItem[] {
  const items: ToolItem[] = []
  const gems = objects.filter(o => o.kind === 'gem')
  const heads = objects.filter(o => o.kind === 'head')
  const bezels = objects.filter(o => o.kind === 'bezel')

  // Setting burs, one per distinct stone size.
  const sizes = new Map<number, number>()
  for (const g of gems) {
    const mm = mmForCarat(g.params?.shapeId ?? 'rd', g.params?.stoneTypeId ?? 'dia', g.params?.carat ?? 0).width
    const bur = burForStoneMm(mm)
    sizes.set(bur, (sizes.get(bur) ?? 0) + 1)
  }
  for (const [bur, n] of [...sizes.entries()].sort((a, b) => a[0] - b[0])) {
    items.push({ tool: `Setting bur ${bur.toFixed(1)} mm`, detail: `${n} stone${n === 1 ? '' : 's'} — cut the bearing to seat the girdle` })
  }
  if (gems.length) items.push({ tool: 'Bud / hart bur', detail: 'Under-cut the seat and open the culet clearance' })

  if (heads.length) {
    items.push({ tool: 'Prong pusher & pliers', detail: `${heads.length} head${heads.length === 1 ? '' : 's'} — bend and burnish prongs over the girdle` })
    items.push({ tool: 'Cup bur', detail: 'Round and polish the prong tips after setting' })
  }
  if (bezels.length) items.push({ tool: 'Bezel roller / pusher', detail: `${bezels.length} bezel${bezels.length === 1 ? '' : 's'} — burnish the rim over the stone` })

  const drilled = objects.some(o => o.kind === 'mesh')
  if (drilled) items.push({ tool: 'Twist drills (assorted)', detail: 'Pilot and open any pierced/drilled features' })

  // Finishing kit — always.
  items.push({ tool: 'Files & sanding sticks', detail: 'Clean up sprue sites and refine the surface' })
  items.push({ tool: 'Polishing wheels + rouge', detail: 'Cut and colour to final finish' })
  if (gems.some(g => (stoneById(g.params?.stoneTypeId ?? 'dia').mohs) < 7)) {
    items.push({ tool: 'Hand-polish only near soft stones', detail: 'Avoid ultrasonic/steam — protect softer gems' })
  }
  return items
}

export function toolListText(objects: SculptObject[], brand = 'Blue Flame'): string {
  const items = toolList(objects)
  return [`${brand.toUpperCase()} — TOOL & BUR LIST`, '', ...items.map(i => `  [ ] ${i.tool} — ${i.detail}`)].join('\n')
}
