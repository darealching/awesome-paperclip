import type { Facility, CollateralAR, Reserve } from '../types'
import { roundCurrency } from './format'

export interface AvailabilityBreakdown {
  eligibleAR: number
  grossAdvance: number
  activeReserves: number
  usage: number
  netAvailability: number
}

const MAX_AR_AGE_DAYS = 90

export function calculateEligibleAR(collateral: CollateralAR[], asOfDate: Date = new Date()): number {
  let total = 0
  for (const item of collateral) {
    if (item.status !== 'OPEN') continue
    if (item.outstanding_amount <= 0) continue
    if (item.ineligible_flag) continue
    if (item.disputed_flag) continue
    const ageDays = Math.round((asOfDate.getTime() - new Date(item.invoice_date).getTime()) / (1000 * 60 * 60 * 24))
    if (ageDays > MAX_AR_AGE_DAYS) continue
    total += item.outstanding_amount
  }
  return roundCurrency(total)
}

export function calculateARAdvance(facility: Facility, collateral: CollateralAR[], asOfDate?: Date): number {
  const eligible = calculateEligibleAR(collateral, asOfDate)
  return roundCurrency(eligible * facility.ar_advance_rate)
}

export function activeReserveTotal(reserves: Reserve[], asOf: Date = new Date()): number {
  let total = 0
  const asOfTime = asOf.getTime()
  for (const r of reserves) {
    if (r.status !== 'ACTIVE') continue
    if (new Date(r.effective_at).getTime() > asOfTime) continue
    if (r.expiration_at && new Date(r.expiration_at).getTime() <= asOfTime) continue
    total += r.amount
  }
  return roundCurrency(total)
}

export function calculateAvailability(
  facility: Facility,
  collateral: CollateralAR[],
  reserves: Reserve[],
  asOf?: Date
): AvailabilityBreakdown {
  const grossAdvance = calculateARAdvance(facility, collateral, asOf)
  const reserveTotal = activeReserveTotal(reserves, asOf)
  const usage = roundCurrency(facility.outstanding_principal + facility.pending_fundings)
  const netAvailability = roundCurrency(grossAdvance - reserveTotal - usage)
  return {
    eligibleAR: calculateEligibleAR(collateral, asOf),
    grossAdvance,
    activeReserves: reserveTotal,
    usage,
    netAvailability,
  }
}
