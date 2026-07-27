/**
 * Shop market settings the metal and pricing engines read, so quotes can be
 * tuned live without touching code. A module singleton (kept in sync from the
 * store) keeps the engine signatures clean.
 */
export interface Market {
  spotFactor: number    // multiplier on every alloy's spot price
  margin: number        // retail multiplier on the subtotal
  finishFee: number     // cast + finish + polish — setup base, $
  finishPerGram: number // finishing that scales with mass, $/g
  meleeLabor: number    // setting labor per accent stone, $
  settingBase: number   // baseline setting labor per main stone, $ (scaled by size)
  rhodiumFee: number    // rhodium plating pass, $
  laborRate: number     // bench labor, $/hour — drives the time-based estimate
}

export const DEFAULT_MARKET: Market = {
  spotFactor: 1, margin: 1.35,
  finishFee: 95, finishPerGram: 2.5,
  meleeLabor: 12, settingBase: 55,
  rhodiumFee: 45, laborRate: 65,
}

export const MARKET: Market = { ...DEFAULT_MARKET }

export function setMarket(patch: Partial<Market>): void {
  Object.assign(MARKET, patch)
}
