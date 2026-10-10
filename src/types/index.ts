export interface Borrower {
  id: string
  name: string
  legal_name: string
  tax_id: string | null
  address: string | null
  contact_email: string | null
  contact_phone: string | null
  industry: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface Facility {
  id: string
  borrower_id: string
  facility_name: string
  status: 'DRAFT' | 'ACTIVE' | 'FROZEN' | 'CLOSED'
  currency_code: string
  commitment_amount: number
  outstanding_principal: number
  pending_fundings: number
  reserve_amount: number
  ar_advance_rate: number
  inventory_advance_rate: number
  interest_rate: number
  effective_date: string | null
  maturity_date: string | null
  created_at: string
  updated_at: string
  borrower?: Borrower
}

export interface CollateralAR {
  id: string
  facility_id: string
  obligor_id: string
  obligor_name: string | null
  invoice_number: string
  outstanding_amount: number
  invoice_date: string
  due_date: string | null
  disputed_flag: boolean
  ineligible_flag: boolean
  status: 'OPEN' | 'PAID' | 'DISPUTED' | 'COLLECTED'
  created_at: string
  updated_at: string
}

export interface Reserve {
  id: string
  facility_id: string
  reserve_type: string
  description: string | null
  amount: number
  status: 'ACTIVE' | 'RELEASED' | 'EXPIRED'
  effective_at: string
  expiration_at: string | null
  rule_set_version: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export interface LoanDraw {
  id: string
  facility_id: string
  request_id: string
  idempotency_key: string | null
  requested_amount: number
  approved_amount: number | null
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'REVERSED' | 'REJECTED'
  requested_at: string
  approved_at: string | null
  posted_at: string | null
  created_by: string | null
  approved_by: string | null
  reversal_of_draw_id: string | null
  rejection_reason: string | null
  created_at: string
  facility?: Facility
}

export interface LoanPayment {
  id: string
  facility_id: string
  request_id: string | null
  received_amount: number
  principal_amount: number
  interest_amount: number
  fee_amount: number
  unapplied_amount: number
  received_at: string
  status: 'POSTED' | 'REVERSED'
  created_by: string | null
  created_at: string
  facility?: Facility
}

export interface LoanLedgerEntry {
  id: string
  facility_id: string
  source_type: string
  source_id: string
  entry_type: string
  debit_amount: number
  credit_amount: number
  accounting_date: string | null
  business_date: string | null
  status: 'POSTED' | 'REVERSED'
  reversal_of_ledger_id: string | null
  description: string | null
  created_at: string
}

export interface LendingAuditEntry {
  id: string
  event_at: string
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  correlation_id: string | null
  detail_json: Record<string, unknown> | null
  created_at: string
}

export interface AvailabilityResult {
  grossBase: number
  reserves: number
  usage: number
  netAvail: number
  eligibleAR: number
}
