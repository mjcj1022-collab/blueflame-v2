import type { AiDesignPatch } from './aiAssistant'

/**
 * Curated, professionally-proportioned starting designs. Each is a complete,
 * validated spec (real catalog ids) a maker can drop into the modeler in one
 * click and then refine — a fast, high-quality alternative to describing a piece
 * from scratch. Also seeds the AI with known-good exemplars.
 */

export interface DesignTemplate {
  id: string
  name: string
  blurb: string
  patch: AiDesignPatch
}

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'classic-solitaire',
    name: 'Classic solitaire',
    blurb: 'Round diamond, six-prong, white gold — the timeless engagement ring.',
    patch: { category: 'ring', alloyId: '14kw', shapeId: 'rd', stoneTypeId: 'dia', carat: 1, settingId: 'p6', size: 6.5, bandWidth: 2, bandProfile: 'round', finish: 'polish' },
  },
  {
    id: 'cushion-halo',
    name: 'Cushion halo',
    blurb: 'Cushion centre framed by a halo of accents, rose gold, satin band.',
    patch: { category: 'ring', alloyId: '14kr', shapeId: 'cu', stoneTypeId: 'dia', carat: 1.25, settingId: 'hal', size: 6.5, bandWidth: 2.2, bandProfile: 'round', finish: 'satin' },
  },
  {
    id: 'emerald-bezel',
    name: 'Emerald-cut bezel',
    blurb: 'Sleek low-profile bezel, emerald cut, 18k white — modern and protective.',
    patch: { category: 'ring', alloyId: '18kw', shapeId: 'em', stoneTypeId: 'dia', carat: 1.5, settingId: 'bz', size: 6.5, bandWidth: 2.6, bandProfile: 'flat', finish: 'polish' },
  },
  {
    id: 'wedding-band',
    name: 'Comfort wedding band',
    blurb: 'Simple 4 mm comfort-fit band, 14k yellow, no stone.',
    patch: { category: 'ring', alloyId: '14ky', stoneTypeId: 'none', size: 9, bandWidth: 4, bandProfile: 'dshape', finish: 'polish' },
  },
  {
    id: 'sapphire-pendant',
    name: 'Sapphire pendant',
    blurb: 'Oval sapphire in a prong drop with a bail, 14k yellow.',
    patch: { category: 'pendant', alloyId: '14ky', shapeId: 'ov', stoneTypeId: 'sap', carat: 1, settingId: 'p4', finish: 'polish' },
  },
  {
    id: 'diamond-studs',
    name: 'Diamond studs',
    blurb: 'Round brilliant studs, four-prong, white gold.',
    patch: { category: 'earring', alloyId: '14kw', shapeId: 'rd', stoneTypeId: 'dia', carat: 0.5, settingId: 'p4', dropLength: 0, finish: 'polish' },
  },
]

export const templateById = (id: string): DesignTemplate | undefined => DESIGN_TEMPLATES.find((t) => t.id === id)
