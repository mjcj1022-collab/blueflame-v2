import { DEFAULT_SPEC, NO_STONE, type DesignSpec, type ProductCategory } from '../spec/types'

/**
 * A template is a named starting point — a full DesignSpec the designer then
 * tunes. Every template is parametric: it sets values, not a frozen mesh, so
 * changing the stone or metal afterwards reflows weight, cost and geometry.
 */
export interface Template {
  id: string
  name: string
  blurb: string
  category: ProductCategory
  build: () => DesignSpec
}

interface Over {
  category?: ProductCategory
  finish?: DesignSpec['finish']
  metal?: Partial<DesignSpec['metal']>
  center?: Partial<DesignSpec['center']>
  setting?: Partial<DesignSpec['setting']>
  ring?: Partial<DesignSpec['ring']>
  pendant?: Partial<DesignSpec['pendant']>
  earring?: Partial<DesignSpec['earring']>
  bracelet?: Partial<DesignSpec['bracelet']>
  necklace?: Partial<DesignSpec['necklace']>
}

/** Merge overrides onto the default spec, block by block. */
const base = (over: Over): DesignSpec => ({
  ...DEFAULT_SPEC,
  ...(over.category ? { category: over.category } : {}),
  ...(over.finish ? { finish: over.finish } : {}),
  metal: { ...DEFAULT_SPEC.metal, ...(over.metal ?? {}) },
  center: { ...DEFAULT_SPEC.center, ...(over.center ?? {}) },
  setting: { ...DEFAULT_SPEC.setting, ...(over.setting ?? {}) },
  ring: { ...DEFAULT_SPEC.ring, ...(over.ring ?? {}) },
  pendant: { ...DEFAULT_SPEC.pendant, ...(over.pendant ?? {}) },
  earring: { ...DEFAULT_SPEC.earring, ...(over.earring ?? {}) },
  bracelet: { ...DEFAULT_SPEC.bracelet, ...(over.bracelet ?? {}) },
  necklace: { ...DEFAULT_SPEC.necklace, ...(over.necklace ?? {}) }
})

export const TEMPLATES: Template[] = [
  // Rings
  { id: 'solitaire', name: 'Classic Solitaire', blurb: 'Round, 4-prong, 1 ct', category: 'ring',
    build: () => base({ category: 'ring', center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1 }, setting: { typeId: 'p4' }, ring: { width: 2, thickness: 1.8 } }) },
  { id: 'tiffany', name: 'Six-Prong Solitaire', blurb: 'Tiffany-style, 1.25 ct', category: 'ring',
    build: () => base({ category: 'ring', center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1.25 }, setting: { typeId: 'p6' } }) },
  { id: 'bezel-ring', name: 'Bezel Solitaire', blurb: 'Protective, low-profile', category: 'ring',
    build: () => base({ category: 'ring', center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 0.9 }, setting: { typeId: 'bz' } }) },
  { id: 'oval', name: 'Oval Solitaire', blurb: 'Oval, six-prong, 18KY', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18ky' }, center: { shapeId: 'ov', stoneTypeId: 'dia', carat: 1.5 }, setting: { typeId: 'p6' } }) },
  { id: 'emerald-plat', name: 'Emerald in Platinum', blurb: 'Emerald cut, bezel, Pt', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: 'pt95' }, center: { shapeId: 'em', stoneTypeId: 'dia', carat: 1.2 }, setting: { typeId: 'bz' } }) },
  { id: 'cocktail', name: 'Cocktail Ring', blurb: 'Statement 3 ct, six-prong', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18ky' }, center: { shapeId: 'cu', stoneTypeId: 'sap', carat: 3 }, setting: { typeId: 'p6' }, ring: { width: 2.4, thickness: 2.0 } }) },
  { id: 'wedding-flat', name: 'Wedding Band', blurb: 'Plain flat, 2.5 mm', category: 'ring',
    build: () => base({ category: 'ring', center: { stoneTypeId: NO_STONE }, ring: { width: 2.5, thickness: 1.6, fit: 'standard' } }) },
  { id: 'mens-band', name: "Men's Band", blurb: 'Wide 6 mm comfort, white', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '14kw' }, center: { stoneTypeId: NO_STONE }, ring: { size: 10, width: 6, thickness: 1.9, fit: 'comfort' } }) },
  { id: 'halo', name: 'Halo', blurb: 'Round center, single halo, 18KW', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18kw' }, center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1 }, setting: { typeId: 'hal' } }) },
  { id: 'double-halo', name: 'Double Halo', blurb: 'Layered halo, cushion 1.25 ct', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18kw' }, center: { shapeId: 'cu', stoneTypeId: 'dia', carat: 1.25 }, setting: { typeId: 'hl2' } }) },
  { id: 'three-stone', name: 'Three-Stone', blurb: 'Trilogy, emerald center, Pt', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: 'pt95' }, center: { shapeId: 'em', stoneTypeId: 'dia', carat: 1.2 }, setting: { typeId: 'th3' } }) },
  { id: 'pave-band', name: 'Pavé Solitaire', blurb: 'Pavé shank, round 1 ct, 18KW', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18kw' }, center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1 }, setting: { typeId: 'pav' }, ring: { width: 2.2, thickness: 1.9 } }) },
  { id: 'channel', name: 'Channel Band', blurb: 'Flush-set row, round 0.9 ct', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '14kw' }, center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 0.9 }, setting: { typeId: 'chn' }, ring: { width: 2.6, thickness: 1.9 } }) },
  { id: 'eternity', name: 'Eternity Band', blurb: 'Stones all around, no centre', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18kw' }, center: { stoneTypeId: NO_STONE }, setting: { typeId: 'etr' }, ring: { width: 2.4, thickness: 1.8 } }) },

  // Pendants
  { id: 'solitaire-pendant', name: 'Solitaire Pendant', blurb: 'Bezel, 1 ct, 18" chain', category: 'pendant',
    build: () => base({ category: 'pendant', center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 1 }, setting: { typeId: 'bz' } }) },
  { id: 'pear-drop', name: 'Pear Drop', blurb: 'Pear, prong, on chain', category: 'pendant',
    build: () => base({ category: 'pendant', metal: { alloyId: '18kw' }, center: { shapeId: 'pe', stoneTypeId: 'dia', carat: 1 }, setting: { typeId: 'p4' } }) },

  // Earrings
  { id: 'studs', name: 'Diamond Studs', blurb: 'Pair, 4-prong, 0.5 ct ea', category: 'earring',
    build: () => base({ category: 'earring', center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 0.5 }, setting: { typeId: 'p4' }, earring: { pair: true, dropLength: 0 } }) },
  { id: 'drops', name: 'Drop Earrings', blurb: 'Pair, 15 mm drop', category: 'earring',
    build: () => base({ category: 'earring', metal: { alloyId: '18ky' }, center: { shapeId: 'ov', stoneTypeId: 'sap', carat: 0.75 }, setting: { typeId: 'p4' }, earring: { pair: true, dropLength: 15 } }) },

  // Bracelets
  { id: 'tennis', name: 'Tennis Bracelet', blurb: '3 ct total, 42 stones', category: 'bracelet',
    build: () => base({ category: 'bracelet', center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 3 }, setting: { typeId: 'p4' }, bracelet: { ...DEFAULT_SPEC.bracelet, kind: 'tennis', linkCount: 42 } }) },
  { id: 'bangle', name: 'Bangle', blurb: 'Solid 6 mm, no stone', category: 'bracelet',
    build: () => base({ category: 'bracelet', center: { stoneTypeId: NO_STONE }, bracelet: { ...DEFAULT_SPEC.bracelet, kind: 'bangle', width: 6, thickness: 2.4 } }) },
  { id: 'cuff', name: 'Cuff', blurb: 'Open cuff, 8 mm', category: 'bracelet',
    build: () => base({ category: 'bracelet', metal: { alloyId: '14kr' }, center: { stoneTypeId: NO_STONE }, bracelet: { ...DEFAULT_SPEC.bracelet, kind: 'cuff', width: 8, thickness: 2.6 } }) },

  // Necklaces
  { id: 'chain', name: 'Chain', blurb: '18" cable, no pendant', category: 'necklace',
    build: () => base({ category: 'necklace', center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 18, hasPendant: false } }) },
  { id: 'pendant-necklace', name: 'Pendant Necklace', blurb: '20" with bezel pendant', category: 'necklace',
    build: () => base({ category: 'necklace', center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 0.75 }, setting: { typeId: 'bz' }, necklace: { ...DEFAULT_SPEC.necklace, length: 20, hasPendant: true } }) },

  // ── More rings ──────────────────────────────────────────────────────────
  { id: 'princess-solitaire', name: 'Princess Solitaire', blurb: 'Princess cut, 4-prong, 1 ct', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '14kw' }, center: { shapeId: 'pr', stoneTypeId: 'dia', carat: 1 }, setting: { typeId: 'p4' } }) },
  { id: 'pear-ew', name: 'Pear Solitaire', blurb: 'Pear, six-prong, 18KY', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18ky' }, center: { shapeId: 'pe', stoneTypeId: 'dia', carat: 1.25 }, setting: { typeId: 'p6' } }) },
  { id: 'marquise-solitaire', name: 'Marquise Solitaire', blurb: 'Marquise, six-prong, 1.1 ct', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18kw' }, center: { shapeId: 'ma', stoneTypeId: 'dia', carat: 1.1 }, setting: { typeId: 'p6' } }) },
  { id: 'radiant-halo', name: 'Radiant Halo', blurb: 'Radiant centre, halo, rose', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '14kr' }, center: { shapeId: 'ra', stoneTypeId: 'dia', carat: 1.4 }, setting: { typeId: 'hal' } }) },
  { id: 'asscher-3', name: 'Asscher Trilogy', blurb: 'Asscher, three-stone, Pt', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: 'pt95' }, center: { shapeId: 'as', stoneTypeId: 'dia', carat: 1.3 }, setting: { typeId: 'th3' } }) },
  { id: 'sapphire-halo', name: 'Sapphire Halo', blurb: 'Blue sapphire, diamond halo', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18kw' }, center: { shapeId: 'ov', stoneTypeId: 'sap', carat: 1.5 }, setting: { typeId: 'hal' } }) },
  { id: 'ruby-3stone', name: 'Ruby Three-Stone', blurb: 'Ruby centre, diamond sides', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18ky' }, center: { shapeId: 'cu', stoneTypeId: 'rub', carat: 1.2 }, setting: { typeId: 'th3' } }) },
  { id: 'emerald-cocktail', name: 'Emerald Cocktail', blurb: 'Emerald, 2.5 ct, six-prong', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18ky' }, center: { shapeId: 'em', stoneTypeId: 'eme', carat: 2.5 }, setting: { typeId: 'p6' }, ring: { width: 2.4, thickness: 2.0 } }) },
  { id: 'tension-set', name: 'Tension Set', blurb: 'Floating round, modern', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '18kw' }, center: { shapeId: 'rd', stoneTypeId: 'moi', carat: 1 }, setting: { typeId: 'ten' } }) },
  { id: 'cushion-pave', name: 'Cushion Pavé', blurb: 'Cushion centre, pavé shank', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '14kw' }, center: { shapeId: 'cu', stoneTypeId: 'dia', carat: 1.5 }, setting: { typeId: 'pav' }, ring: { width: 2.2, thickness: 1.9 } }) },
  { id: 'stackable', name: 'Stackable Band', blurb: 'Thin 1.6 mm, plain', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '14kr' }, center: { stoneTypeId: NO_STONE }, ring: { width: 1.6, thickness: 1.3 } }) },
  { id: 'signet', name: 'Signet Ring', blurb: 'Flat-top, engravable, 14KY', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '14ky' }, center: { stoneTypeId: NO_STONE }, ring: { size: 8, width: 3, thickness: 2.2 } }) },
  { id: 'mens-black', name: "Men's Black Band", blurb: '7 mm zirconium comfort', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: 'zr' }, center: { stoneTypeId: NO_STONE }, ring: { size: 10.5, width: 7, thickness: 2.0, fit: 'comfort' } }) },
  { id: 'wide-eternity', name: 'Wide Eternity', blurb: '3.5 mm stones all around', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: 'pt95' }, center: { stoneTypeId: NO_STONE }, setting: { typeId: 'etr' }, ring: { width: 3.5, thickness: 1.9 } }) },
  { id: 'morganite-halo', name: 'Morganite Halo', blurb: 'Peachy oval, rose-gold halo', category: 'ring',
    build: () => base({ category: 'ring', metal: { alloyId: '14kr' }, center: { shapeId: 'ov', stoneTypeId: 'mor', carat: 1.75 }, setting: { typeId: 'hal' } }) },

  // ── More pendants ───────────────────────────────────────────────────────
  { id: 'halo-pendant', name: 'Halo Pendant', blurb: 'Round centre, halo, on chain', category: 'pendant',
    build: () => base({ category: 'pendant', metal: { alloyId: '18kw' }, center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 0.75 }, setting: { typeId: 'hal' } }) },
  { id: 'emerald-pendant', name: 'Emerald Pendant', blurb: 'Emerald cut, bezel, 18KY', category: 'pendant',
    build: () => base({ category: 'pendant', metal: { alloyId: '18ky' }, center: { shapeId: 'em', stoneTypeId: 'eme', carat: 1 }, setting: { typeId: 'bz' } }) },
  { id: 'heart-pendant', name: 'Ruby Heart', blurb: 'Heart-cut ruby, prong', category: 'pendant',
    build: () => base({ category: 'pendant', metal: { alloyId: '14kr' }, center: { shapeId: 'he', stoneTypeId: 'rub', carat: 1 }, setting: { typeId: 'p4' } }) },
  { id: 'aqua-drop', name: 'Aquamarine Drop', blurb: 'Pear aqua on chain', category: 'pendant',
    build: () => base({ category: 'pendant', metal: { alloyId: '14kw' }, center: { shapeId: 'pe', stoneTypeId: 'aqu', carat: 1.5 }, setting: { typeId: 'p4' } }) },

  // ── More earrings ───────────────────────────────────────────────────────
  { id: 'sapphire-studs', name: 'Sapphire Studs', blurb: 'Pair, oval sapphire, 0.75 ct', category: 'earring',
    build: () => base({ category: 'earring', metal: { alloyId: '18kw' }, center: { shapeId: 'ov', stoneTypeId: 'sap', carat: 0.75 }, setting: { typeId: 'p4' }, earring: { ...DEFAULT_SPEC.earring, pair: true, dropLength: 0 } }) },
  { id: 'halo-studs', name: 'Halo Studs', blurb: 'Round centre + halo, pair', category: 'earring',
    build: () => base({ category: 'earring', metal: { alloyId: '14kw' }, center: { shapeId: 'rd', stoneTypeId: 'dia', carat: 0.5 }, setting: { typeId: 'hal' }, earring: { ...DEFAULT_SPEC.earring, pair: true, dropLength: 0 } }) },
  { id: 'emerald-studs', name: 'Emerald-Cut Studs', blurb: 'Pair, 0.6 ct each', category: 'earring',
    build: () => base({ category: 'earring', metal: { alloyId: '18ky' }, center: { shapeId: 'em', stoneTypeId: 'dia', carat: 0.6 }, setting: { typeId: 'p4' }, earring: { ...DEFAULT_SPEC.earring, pair: true, dropLength: 0 } }) },
  { id: 'pear-drops', name: 'Pear Drops', blurb: 'Pair, 18 mm drop', category: 'earring',
    build: () => base({ category: 'earring', metal: { alloyId: '18kw' }, center: { shapeId: 'pe', stoneTypeId: 'dia', carat: 0.9 }, setting: { typeId: 'p4' }, earring: { ...DEFAULT_SPEC.earring, pair: true, dropLength: 18 } }) },
  { id: 'morganite-studs', name: 'Morganite Studs', blurb: 'Rose gold, cushion, pair', category: 'earring',
    build: () => base({ category: 'earring', metal: { alloyId: '14kr' }, center: { shapeId: 'cu', stoneTypeId: 'mor', carat: 0.8 }, setting: { typeId: 'p4' }, earring: { ...DEFAULT_SPEC.earring, pair: true, dropLength: 0 } }) },

  // ── More bracelets ──────────────────────────────────────────────────────
  { id: 'sapphire-tennis', name: 'Sapphire Tennis', blurb: 'Blue sapphires, 4 ct total', category: 'bracelet',
    build: () => base({ category: 'bracelet', metal: { alloyId: '18kw' }, center: { shapeId: 'rd', stoneTypeId: 'sap', carat: 4 }, setting: { typeId: 'p4' }, bracelet: { ...DEFAULT_SPEC.bracelet, kind: 'tennis', linkCount: 44 } }) },
  { id: 'cuban-bracelet', name: 'Cuban Bracelet', blurb: 'Chunky curb links, 7.5"', category: 'bracelet',
    build: () => base({ category: 'bracelet', metal: { alloyId: '14ky' }, center: { stoneTypeId: NO_STONE }, bracelet: { ...DEFAULT_SPEC.bracelet, kind: 'chain', width: 6, thickness: 3 } }) },
  { id: 'hammered-cuff', name: 'Hammered Cuff', blurb: 'Open cuff, hammered finish', category: 'bracelet',
    build: () => base({ category: 'bracelet', metal: { alloyId: '14ky' }, center: { stoneTypeId: NO_STONE }, finish: 'hammered', bracelet: { ...DEFAULT_SPEC.bracelet, kind: 'cuff', width: 9, thickness: 2.4 } }) },
  { id: 'gemstone-bangle', name: 'Gemstone Bangle', blurb: 'Solid bangle, bezel accent', category: 'bracelet',
    build: () => base({ category: 'bracelet', metal: { alloyId: '18kr' }, center: { shapeId: 'ov', stoneTypeId: 'eme', carat: 0.5 }, setting: { typeId: 'bz' }, bracelet: { ...DEFAULT_SPEC.bracelet, kind: 'bangle', width: 5, thickness: 2.2 } }) },

  // ── Chains & necklaces (the full range of chain types) ────────────────────
  { id: 'cable-chain', name: 'Cable Chain', blurb: 'Classic round links, 18"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14ky' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 18, chainStyle: 'cable' } }) },
  { id: 'rolo-chain', name: 'Rolo / Belcher', blurb: 'Round symmetrical links, 20"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14kw' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 20, chainStyle: 'rolo' } }) },
  { id: 'curb-chain', name: 'Curb Chain', blurb: 'Flat interlocking links, 20"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14ky' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 20, chainStyle: 'curb', gauge: 1.8 } }) },
  { id: 'cuban-chain', name: 'Cuban Link', blurb: 'Chunky flattened curb, 22"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14ky' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 22, chainStyle: 'cuban', gauge: 2.4 } }) },
  { id: 'figaro-chain', name: 'Figaro Chain', blurb: 'Long-and-short pattern, 20"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14ky' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 20, chainStyle: 'figaro', gauge: 1.6 } }) },
  { id: 'rope-chain', name: 'Rope Chain', blurb: 'Twisted rope, 18"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14ky' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 18, chainStyle: 'rope', gauge: 1.6 } }) },
  { id: 'box-chain', name: 'Box / Venetian', blurb: 'Square links, sleek, 18"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14kw' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 18, chainStyle: 'box' } }) },
  { id: 'snake-chain', name: 'Snake Chain', blurb: 'Smooth flexible, 16"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '18kw' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 16, chainStyle: 'snake' } }) },
  { id: 'herringbone-chain', name: 'Herringbone', blurb: 'Flat woven ribbon, 16"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14ky' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 16, chainStyle: 'herringbone', gauge: 2 } }) },
  { id: 'mariner-chain', name: 'Mariner / Anchor', blurb: 'Oval links with bar, 20"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14ky' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 20, chainStyle: 'mariner', gauge: 1.8 } }) },
  { id: 'bead-chain', name: 'Bead / Ball Chain', blurb: 'Round beads, 18"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14kw' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 18, chainStyle: 'bead' } }) },
  { id: 'ruby-station', name: 'Ruby-by-the-Yard', blurb: 'Rubies every 2" on cable', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '18ky' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 18, chainStyle: 'cable', station: { stoneId: 'rub', shapeId: 'rd', carat: 0.05, everyIn: 2 } } }) },
  { id: 'diamond-riviera', name: 'Diamond Riviera', blurb: 'Diamonds all along, 16"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '18kw' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 16, chainStyle: 'cable', station: { stoneId: 'dia', shapeId: 'rd', carat: 0.1, everyIn: 1 } } }) },
  { id: 'sapphire-station', name: 'Sapphire Station', blurb: 'Sapphires every 1.5", 18"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '18kw' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 18, chainStyle: 'cable', station: { stoneId: 'sap', shapeId: 'rd', carat: 0.07, everyIn: 1.5 } } }) },
  { id: 'celtic-necklace', name: 'Celtic Knot', blurb: 'Cable chain, knot motif, 18"', category: 'necklace',
    build: () => base({ category: 'necklace', metal: { alloyId: '14kw' }, center: { stoneTypeId: NO_STONE }, necklace: { ...DEFAULT_SPEC.necklace, length: 18, chainStyle: 'cable', motif: 'celtic' } }) }
]
