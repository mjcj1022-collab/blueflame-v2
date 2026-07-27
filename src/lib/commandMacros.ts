import type { ModelerCommand } from './aiCommands'

/**
 * One-click finishing recipes — ordered command lists the maker can apply
 * without the AI round-trip. Same executor the AI command layer uses, so a whole
 * macro reverts in a single undo step.
 */
export interface CommandMacro {
  id: string
  name: string
  blurb: string
  commands: ModelerCommand[]
}

export const MACROS: CommandMacro[] = [
  { id: 'hammered', name: 'Hammered band', blurb: 'Organic hammered texture on the metal.', commands: [{ op: 'texture', style: 'hammered', depth: 0.15 }] },
  { id: 'vintage', name: 'Vintage finish', blurb: 'Florentine engraving + a milgrain rim.', commands: [{ op: 'texture', style: 'florentine', depth: 0.12 }, { op: 'milgrain', radius: 4, beadDia: 0.5 }] },
  { id: 'signet-ready', name: 'Signet ready', blurb: 'Flat signet face, symmetrised for engraving.', commands: [{ op: 'signet', width: 10, length: 12, thickness: 1.5 }, { op: 'symmetrize', axis: 'x' }] },
  { id: 'halo-set', name: 'Halo the stone', blurb: 'Fit a head and ring the centre with a halo.', commands: [{ op: 'fitHead', prongs: 4 }, { op: 'halo', count: 12, carat: 0.03 }] },
  { id: 'print-ready', name: 'Print ready', blurb: 'Rotate to the lowest-support orientation.', commands: [{ op: 'autoOrient' }] },
]

export const macroById = (id: string): CommandMacro | undefined => MACROS.find((m) => m.id === id)
