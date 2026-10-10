/*
# Create Transaction Tables — Draws, Payments, Ledger, Audit, Idempotency

1. New Tables
- `loan_draws` — draw requests against facilities
  - id (uuid, PK), facility_id (uuid, FK→facilities), request_id (text), idempotency_key (text unique),
    requested_amount (numeric), approved_amount (numeric), status (text: PENDING_APPROVAL/APPROVED/POSTED/REVERSED/REJECTED),
    requested_at (timestamptz), approved_at (timestamptz), posted_at (timestamptz),
    created_by (text), approved_by (text), reversal_of_draw_id (uuid, FK→loan_draws),
    rejection_reason (text), created_at
- `loan_payments` — incoming payments allocated to fees, interest, principal
  - id (uuid, PK), facility_id (uuid, FK→facilities), request_id (text),
    received_amount (numeric), principal_amount (numeric), interest_amount (numeric),
    fee_amount (numeric), unapplied_amount (numeric), received_at (timestamptz),
    status (text: POSTED/REVERSED), created_by (text), created_at
- `loan_ledger` — double-entry ledger entries
  - id (uuid, PK), facility_id (uuid, FK→facilities), source_type (text), source_id (text),
    entry_type (text), debit_amount (numeric), credit_amount (numeric),
    accounting_date (date), business_date (date), status (text: POSTED/REVERSED),
    reversal_of_ledger_id (uuid), description (text), created_at
- `lending_audit` — audit trail for all lending operations
  - id (uuid, PK), event_at (timestamptz), actor_id (text), action (text),
    entity_type (text), entity_id (text), correlation_id (text), detail_json (jsonb), created_at
- `api_idempotency` — idempotency key store for safe retries
  - id (uuid, PK), idempotency_key (text), operation_name (text), request_hash (text),
    entity_id (text), result_status (text), created_at (timestamptz), response_json (jsonb)

2. Security
- Enable RLS on all tables.
- Single-tenant, no-auth app: allow anon + authenticated full CRUD on all tables.

3. Indexes
- loan_draws by facility_id and status
- loan_payments by facility_id
- loan_ledger by facility_id and source_type/source_id
- lending_audit by entity_type/entity_id and correlation_id
- api_idempotency by idempotency_key (unique)
*/

CREATE TABLE IF NOT EXISTS loan_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  idempotency_key text UNIQUE,
  requested_amount numeric(18,2) NOT NULL DEFAULT 0,
  approved_amount numeric(18,2),
  status text NOT NULL DEFAULT 'PENDING_APPROVAL',
  requested_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  posted_at timestamptz,
  created_by text,
  approved_by text,
  reversal_of_draw_id uuid REFERENCES loan_draws(id),
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  request_id text,
  received_amount numeric(18,2) NOT NULL DEFAULT 0,
  principal_amount numeric(18,2) NOT NULL DEFAULT 0,
  interest_amount numeric(18,2) NOT NULL DEFAULT 0,
  fee_amount numeric(18,2) NOT NULL DEFAULT 0,
  unapplied_amount numeric(18,2) NOT NULL DEFAULT 0,
  received_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'POSTED',
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id text NOT NULL,
  entry_type text NOT NULL,
  debit_amount numeric(18,2) NOT NULL DEFAULT 0,
  credit_amount numeric(18,2) NOT NULL DEFAULT 0,
  accounting_date date,
  business_date date,
  status text NOT NULL DEFAULT 'POSTED',
  reversal_of_ledger_id uuid REFERENCES loan_ledger(id),
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lending_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_at timestamptz DEFAULT now(),
  actor_id text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  correlation_id text,
  detail_json jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  operation_name text NOT NULL,
  request_hash text,
  entity_id text,
  result_status text,
  created_at timestamptz DEFAULT now(),
  response_json jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loan_draws_facility_id ON loan_draws(facility_id);
CREATE INDEX IF NOT EXISTS idx_loan_draws_status ON loan_draws(status);
CREATE INDEX IF NOT EXISTS idx_loan_draws_reversal_of ON loan_draws(reversal_of_draw_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_facility_id ON loan_payments(facility_id);
CREATE INDEX IF NOT EXISTS idx_loan_ledger_facility_id ON loan_ledger(facility_id);
CREATE INDEX IF NOT EXISTS idx_loan_ledger_source ON loan_ledger(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_lending_audit_entity ON lending_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_lending_audit_correlation ON lending_audit(correlation_id);
CREATE INDEX IF NOT EXISTS idx_api_idempotency_key ON api_idempotency(idempotency_key);

-- Enable RLS
ALTER TABLE loan_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE lending_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_idempotency ENABLE ROW LEVEL SECURITY;

-- Loan draws policies
DROP POLICY IF EXISTS "anon_select_loan_draws" ON loan_draws;
CREATE POLICY "anon_select_loan_draws" ON loan_draws FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_loan_draws" ON loan_draws;
CREATE POLICY "anon_insert_loan_draws" ON loan_draws FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_loan_draws" ON loan_draws;
CREATE POLICY "anon_update_loan_draws" ON loan_draws FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_loan_draws" ON loan_draws;
CREATE POLICY "anon_delete_loan_draws" ON loan_draws FOR DELETE TO anon, authenticated USING (true);

-- Loan payments policies
DROP POLICY IF EXISTS "anon_select_loan_payments" ON loan_payments;
CREATE POLICY "anon_select_loan_payments" ON loan_payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_loan_payments" ON loan_payments;
CREATE POLICY "anon_insert_loan_payments" ON loan_payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_loan_payments" ON loan_payments;
CREATE POLICY "anon_update_loan_payments" ON loan_payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_loan_payments" ON loan_payments;
CREATE POLICY "anon_delete_loan_payments" ON loan_payments FOR DELETE TO anon, authenticated USING (true);

-- Loan ledger policies
DROP POLICY IF EXISTS "anon_select_loan_ledger" ON loan_ledger;
CREATE POLICY "anon_select_loan_ledger" ON loan_ledger FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_loan_ledger" ON loan_ledger;
CREATE POLICY "anon_insert_loan_ledger" ON loan_ledger FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_loan_ledger" ON loan_ledger;
CREATE POLICY "anon_update_loan_ledger" ON loan_ledger FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_loan_ledger" ON loan_ledger;
CREATE POLICY "anon_delete_loan_ledger" ON loan_ledger FOR DELETE TO anon, authenticated USING (true);

-- Lending audit policies
DROP POLICY IF EXISTS "anon_select_lending_audit" ON lending_audit;
CREATE POLICY "anon_select_lending_audit" ON lending_audit FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_lending_audit" ON lending_audit;
CREATE POLICY "anon_insert_lending_audit" ON lending_audit FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_lending_audit" ON lending_audit;
CREATE POLICY "anon_update_lending_audit" ON lending_audit FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_lending_audit" ON lending_audit;
CREATE POLICY "anon_delete_lending_audit" ON lending_audit FOR DELETE TO anon, authenticated USING (true);

-- API idempotency policies
DROP POLICY IF EXISTS "anon_select_api_idempotency" ON api_idempotency;
CREATE POLICY "anon_select_api_idempotency" ON api_idempotency FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_api_idempotency" ON api_idempotency;
CREATE POLICY "anon_insert_api_idempotency" ON api_idempotency FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_api_idempotency" ON api_idempotency;
CREATE POLICY "anon_update_api_idempotency" ON api_idempotency FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_api_idempotency" ON api_idempotency;
CREATE POLICY "anon_delete_api_idempotency" ON api_idempotency FOR DELETE TO anon, authenticated USING (true);
