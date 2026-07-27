/**
 * Deposit & payment schedule. Custom work is paid in stages so the shop isn't
 * financing materials. From the retail total and a deposit rate, this lays out the
 * up-front deposit that starts the job and the balance due before delivery — plus
 * an optional three-stage split (deposit / at casting / on completion) for bigger
 * commissions. Pure arithmetic; the maker sets the rates.
 */

export interface Milestone { label: string; pct: number; amount: number }
export interface PaymentSchedule {
  total: number
  depositRate: number
  deposit: number
  balance: number
  milestones: Milestone[]
}

export function paymentSchedule(total: number, depositRate = 0.5, staged = false): PaymentSchedule {
  const t = Math.max(0, total)
  const dr = Math.min(1, Math.max(0, depositRate))
  const deposit = t * dr
  const balance = t - deposit
  const milestones: Milestone[] = staged
    ? [
      { label: 'Deposit to start', pct: dr, amount: deposit },
      { label: 'At casting', pct: (1 - dr) / 2, amount: balance / 2 },
      { label: 'On completion', pct: (1 - dr) / 2, amount: balance / 2 },
    ]
    : [
      { label: 'Deposit to start', pct: dr, amount: deposit },
      { label: 'Balance before delivery', pct: 1 - dr, amount: balance },
    ]
  return { total: t, depositRate: dr, deposit, balance, milestones }
}
