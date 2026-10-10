import { supabase } from './supabase'
import { roundCurrency } from './format'
import type { LoanDraw, LoanPayment } from '../types'

function generateIdempotencyKey(): string {
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function generateRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

async function writeAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  correlationId: string,
  detail: Record<string, unknown>
): Promise<void> {
  await supabase.from('lending_audit').insert({
    event_at: new Date().toISOString(),
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    correlation_id: correlationId,
    detail_json: detail,
  })
}

export interface CreateDrawParams {
  facilityId: string
  requestedAmount: number
  actorId: string
  correlationId?: string
}

export async function createDrawRequest(params: CreateDrawParams): Promise<{ draw: LoanDraw; alreadyExists: boolean }> {
  const { facilityId, requestedAmount, actorId } = params
  const correlationId = params.correlationId || `corr-${Date.now()}`
  const idempotencyKey = generateIdempotencyKey()
  const requestId = generateRequestId('REQ')

  const { data: facility } = await supabase
    .from('facilities')
    .select('*')
    .eq('id', facilityId)
    .maybeSingle()

  if (!facility) throw new Error('Facility was not found.')
  if (facility.status !== 'ACTIVE') throw new Error('Facility is not active for draw requests.')
  if (requestedAmount <= 0) throw new Error('Requested amount must be greater than zero.')
  if (requestedAmount > facility.commitment_amount)
    throw new Error('Requested amount exceeds the facility commitment.')

  const { data: idemCheck } = await supabase
    .from('api_idempotency')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .eq('operation_name', 'CREATE_DRAW_REQUEST')
    .maybeSingle()

  if (idemCheck) {
    const { data: existingDraw } = await supabase
      .from('loan_draws')
      .select('*')
      .eq('id', idemCheck.entity_id)
      .maybeSingle()
    if (existingDraw) return { draw: existingDraw as LoanDraw, alreadyExists: true }
  }

  const { data: draw, error } = await supabase
    .from('loan_draws')
    .insert({
      facility_id: facilityId,
      request_id: requestId,
      idempotency_key: idempotencyKey,
      requested_amount: roundCurrency(requestedAmount),
      status: 'PENDING_APPROVAL',
      requested_at: new Date().toISOString(),
      created_by: actorId,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create draw request: ${error.message}`)

  await supabase.from('api_idempotency').insert({
    idempotency_key: idempotencyKey,
    operation_name: 'CREATE_DRAW_REQUEST',
    entity_id: draw.id,
    result_status: 'PENDING_APPROVAL',
    created_at: new Date().toISOString(),
  })

  await writeAudit(actorId, 'DRAW_REQUEST_CREATED', 'loan_draw', draw.id, correlationId, {
    facility_id: facilityId,
    requested_amount: roundCurrency(requestedAmount),
    status: 'PENDING_APPROVAL',
  })

  return { draw: draw as LoanDraw, alreadyExists: false }
}

export interface ApproveDrawParams {
  drawId: string
  approverId: string
  netAvailability: number
  correlationId?: string
}

export async function approveDrawRequest(params: ApproveDrawParams): Promise<LoanDraw> {
  const { drawId, approverId, netAvailability, correlationId } = params
  const corrId = correlationId || `corr-${Date.now()}`

  const { data: draw } = await supabase
    .from('loan_draws')
    .select('*')
    .eq('id', drawId)
    .maybeSingle()

  if (!draw) throw new Error('Draw request was not found.')
  if (draw.status !== 'PENDING_APPROVAL') throw new Error('Draw request is not pending approval.')
  if (draw.created_by === approverId) throw new Error('Requester cannot approve the same draw.')
  if (draw.requested_amount > netAvailability)
    throw new Error('Requested draw exceeds current calculated availability.')

  const { data: updated, error } = await supabase
    .from('loan_draws')
    .update({
      approved_amount: roundCurrency(draw.requested_amount),
      status: 'APPROVED',
      approved_at: new Date().toISOString(),
      approved_by: approverId,
    })
    .eq('id', drawId)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to approve draw: ${error.message}`)

  await writeAudit(approverId, 'DRAW_REQUEST_APPROVED', 'loan_draw', drawId, corrId, {
    approved_amount: roundCurrency(draw.requested_amount),
    net_availability: netAvailability,
  })

  return updated as LoanDraw
}

export async function rejectDrawRequest(
  drawId: string,
  approverId: string,
  reason: string,
  correlationId?: string
): Promise<LoanDraw> {
  const corrId = correlationId || `corr-${Date.now()}`

  const { data: draw } = await supabase
    .from('loan_draws')
    .select('*')
    .eq('id', drawId)
    .maybeSingle()

  if (!draw) throw new Error('Draw request was not found.')
  if (draw.status !== 'PENDING_APPROVAL') throw new Error('Draw request is not pending approval.')

  const { data: updated, error } = await supabase
    .from('loan_draws')
    .update({
      status: 'REJECTED',
      approved_at: new Date().toISOString(),
      approved_by: approverId,
      rejection_reason: reason,
    })
    .eq('id', drawId)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to reject draw: ${error.message}`)

  await writeAudit(approverId, 'DRAW_REQUEST_REJECTED', 'loan_draw', drawId, corrId, {
    reason,
  })

  return updated as LoanDraw
}

export interface PostDrawParams {
  drawId: string
  actorId: string
  businessDate: string
  accountingDate: string
  correlationId?: string
}

export async function postApprovedDraw(params: PostDrawParams): Promise<void> {
  const { drawId, actorId, businessDate, accountingDate, correlationId } = params
  const corrId = correlationId || `corr-${Date.now()}`

  const { data: draw } = await supabase
    .from('loan_draws')
    .select('*')
    .eq('id', drawId)
    .maybeSingle()

  if (!draw) throw new Error('Approved draw was not found.')
  if (draw.status !== 'APPROVED') throw new Error('Draw is not approved for posting.')

  const amount = roundCurrency(draw.approved_amount || 0)

  const { data: facility } = await supabase
    .from('facilities')
    .select('*')
    .eq('id', draw.facility_id)
    .maybeSingle()

  if (!facility) throw new Error('Facility was not found.')

  const newOutstanding = roundCurrency(facility.outstanding_principal + amount)
  const newPending = roundCurrency(Math.max(0, facility.pending_fundings - amount))

  await supabase
    .from('facilities')
    .update({
      outstanding_principal: newOutstanding,
      pending_fundings: newPending,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draw.facility_id)

  await supabase.from('loan_ledger').insert([
    {
      facility_id: draw.facility_id,
      source_type: 'loan_draw',
      source_id: drawId,
      entry_type: 'PRINCIPAL_RECEIVABLE',
      debit_amount: amount,
      credit_amount: 0,
      accounting_date: accountingDate,
      business_date: businessDate,
      status: 'POSTED',
      description: 'Draw posted - principal receivable',
    },
    {
      facility_id: draw.facility_id,
      source_type: 'loan_draw',
      source_id: drawId,
      entry_type: 'CASH_OR_FUNDING_CLEARING',
      debit_amount: 0,
      credit_amount: amount,
      accounting_date: accountingDate,
      business_date: businessDate,
      status: 'POSTED',
      description: 'Draw posted - funding clearing',
    },
  ])

  await supabase
    .from('loan_draws')
    .update({
      status: 'POSTED',
      posted_at: new Date().toISOString(),
    })
    .eq('id', drawId)

  await writeAudit(actorId, 'DRAW_POSTED', 'loan_draw', drawId, corrId, {
    posted_amount: amount,
  })
}

export interface ReverseDrawParams {
  drawId: string
  reason: string
  actorId: string
  businessDate: string
  accountingDate: string
  correlationId?: string
}

export async function reversePostedDraw(params: ReverseDrawParams): Promise<LoanDraw> {
  const { drawId, reason, actorId, businessDate, accountingDate, correlationId } = params
  const corrId = correlationId || `corr-${Date.now()}`

  if (!reason.trim()) throw new Error('A reversal reason is required.')

  const { data: originalDraw } = await supabase
    .from('loan_draws')
    .select('*')
    .eq('id', drawId)
    .maybeSingle()

  if (!originalDraw) throw new Error('Original draw was not found.')
  if (originalDraw.status !== 'POSTED') throw new Error('Only posted draws can be reversed.')

  const { data: existingReversal } = await supabase
    .from('loan_draws')
    .select('id')
    .eq('reversal_of_draw_id', drawId)
    .maybeSingle()

  if (existingReversal) throw new Error('A reversal already exists for this draw.')

  const amount = roundCurrency(originalDraw.approved_amount || 0)

  const { data: facility } = await supabase
    .from('facilities')
    .select('*')
    .eq('id', originalDraw.facility_id)
    .maybeSingle()

  if (!facility) throw new Error('Facility was not found.')

  const { data: reversalDraw, error: revError } = await supabase
    .from('loan_draws')
    .insert({
      facility_id: originalDraw.facility_id,
      request_id: `REVERSAL-${drawId.slice(0, 8)}`,
      requested_amount: -amount,
      approved_amount: -amount,
      status: 'POSTED',
      created_by: actorId,
      approved_by: actorId,
      requested_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      posted_at: new Date().toISOString(),
      reversal_of_draw_id: drawId,
    })
    .select('*')
    .single()

  if (revError) throw new Error(`Failed to create reversal: ${revError.message}`)

  const newOutstanding = roundCurrency(facility.outstanding_principal - amount)
  await supabase
    .from('facilities')
    .update({
      outstanding_principal: newOutstanding,
      updated_at: new Date().toISOString(),
    })
    .eq('id', originalDraw.facility_id)

  await supabase.from('loan_ledger').insert([
    {
      facility_id: originalDraw.facility_id,
      source_type: 'loan_draw_reversal',
      source_id: reversalDraw.id,
      entry_type: 'CASH_OR_FUNDING_CLEARING_REVERSAL',
      debit_amount: amount,
      credit_amount: 0,
      accounting_date: accountingDate,
      business_date: businessDate,
      status: 'POSTED',
      description: `Draw reversal - clearing reversal`,
    },
    {
      facility_id: originalDraw.facility_id,
      source_type: 'loan_draw_reversal',
      source_id: reversalDraw.id,
      entry_type: 'PRINCIPAL_RECEIVABLE_REVERSAL',
      debit_amount: 0,
      credit_amount: amount,
      accounting_date: accountingDate,
      business_date: businessDate,
      status: 'POSTED',
      description: `Draw reversal - principal reversal`,
    },
  ])

  await writeAudit(actorId, 'DRAW_REVERSED', 'loan_draw', reversalDraw.id, corrId, {
    reversal_of: drawId,
    amount,
    reason: reason.replace(/"/g, "'"),
  })

  return reversalDraw as LoanDraw
}

export interface ApplyPaymentParams {
  facilityId: string
  receivedAmount: number
  accruedFees: number
  accruedInterest: number
  actorId: string
  correlationId?: string
}

export async function applyPayment(params: ApplyPaymentParams): Promise<LoanPayment> {
  const { facilityId, receivedAmount, accruedFees, accruedInterest, actorId, correlationId } = params
  const corrId = correlationId || `corr-${Date.now()}`
  const requestId = generateRequestId('PMT')

  if (receivedAmount <= 0) throw new Error('Payment amount must be greater than zero.')

  const { data: facility } = await supabase
    .from('facilities')
    .select('*')
    .eq('id', facilityId)
    .maybeSingle()

  if (!facility) throw new Error('Facility was not found.')

  let remaining = roundCurrency(receivedAmount)
  const fees = roundCurrency(Math.min(remaining, Math.max(0, accruedFees)))
  remaining = roundCurrency(remaining - fees)
  const interest = roundCurrency(Math.min(remaining, Math.max(0, accruedInterest)))
  remaining = roundCurrency(remaining - interest)
  const principal = roundCurrency(Math.min(remaining, Math.max(0, facility.outstanding_principal)))
  remaining = roundCurrency(remaining - principal)

  const { data: payment, error } = await supabase
    .from('loan_payments')
    .insert({
      facility_id: facilityId,
      request_id: requestId,
      received_amount: roundCurrency(receivedAmount),
      fee_amount: fees,
      interest_amount: interest,
      principal_amount: principal,
      unapplied_amount: remaining,
      received_at: new Date().toISOString(),
      status: 'POSTED',
      created_by: actorId,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to record payment: ${error.message}`)

  const newOutstanding = roundCurrency(facility.outstanding_principal - principal)
  await supabase
    .from('facilities')
    .update({
      outstanding_principal: newOutstanding,
      updated_at: new Date().toISOString(),
    })
    .eq('id', facilityId)

  await supabase.from('loan_ledger').insert([
    {
      facility_id: facilityId,
      source_type: 'loan_payment',
      source_id: payment.id,
      entry_type: 'CASH_RECEIPT',
      debit_amount: roundCurrency(receivedAmount),
      credit_amount: 0,
      accounting_date: new Date().toISOString().slice(0, 10),
      business_date: new Date().toISOString().slice(0, 10),
      status: 'POSTED',
      description: 'Payment received - cash',
    },
    {
      facility_id: facilityId,
      source_type: 'loan_payment',
      source_id: payment.id,
      entry_type: 'FEE_INCOME',
      debit_amount: 0,
      credit_amount: fees,
      accounting_date: new Date().toISOString().slice(0, 10),
      business_date: new Date().toISOString().slice(0, 10),
      status: 'POSTED',
      description: 'Payment allocation - fees',
    },
    {
      facility_id: facilityId,
      source_type: 'loan_payment',
      source_id: payment.id,
      entry_type: 'INTEREST_INCOME',
      debit_amount: 0,
      credit_amount: interest,
      accounting_date: new Date().toISOString().slice(0, 10),
      business_date: new Date().toISOString().slice(0, 10),
      status: 'POSTED',
      description: 'Payment allocation - interest',
    },
    {
      facility_id: facilityId,
      source_type: 'loan_payment',
      source_id: payment.id,
      entry_type: 'PRINCIPAL_REDUCTION',
      debit_amount: 0,
      credit_amount: principal,
      accounting_date: new Date().toISOString().slice(0, 10),
      business_date: new Date().toISOString().slice(0, 10),
      status: 'POSTED',
      description: 'Payment allocation - principal',
    },
  ])

  await writeAudit(actorId, 'PAYMENT_APPLIED', 'loan_payment', payment.id, corrId, {
    received: roundCurrency(receivedAmount),
    fees,
    interest,
    principal,
    unapplied: remaining,
  })

  return payment as LoanPayment
}
