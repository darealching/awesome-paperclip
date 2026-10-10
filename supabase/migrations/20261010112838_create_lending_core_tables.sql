/*
# Create Core Lending Tables — Facilities, Borrowers, Collateral AR, Reserves

1. New Tables
- `borrowers` — entities that receive credit under a facility
  - id (uuid, PK), name (text), legal_name (text), tax_id (text), address (text),
    contact_email (text), contact_phone (text), industry (text), status (text),
    created_at, updated_at
- `facilities` — credit facilities (lines of credit, asset-based lending)
  - id (uuid, PK), borrower_id (uuid, FK→borrowers), facility_name (text), status (text: DRAFT/ACTIVE/FROZEN/CLOSED),
    currency_code (text), commitment_amount (numeric), outstanding_principal (numeric), pending_fundings (numeric),
    reserve_amount (numeric), ar_advance_rate (numeric), inventory_advance_rate (numeric),
    interest_rate (numeric), effective_date (date), maturity_date (date), created_at, updated_at
- `collateral_ar` — accounts receivable collateral records
  - id (uuid, PK), facility_id (uuid, FK→facilities), obligor_id (text), obligor_name (text),
    invoice_number (text), outstanding_amount (numeric), invoice_date (date), due_date (date),
    disputed_flag (boolean), ineligible_flag (boolean), status (text: OPEN/PAID/DISPUTED/COLLECTED),
    created_at, updated_at
- `reserves` — effective-dated reserve records against a facility
  - id (uuid, PK), facility_id (uuid, FK→facilities), reserve_type (text),
    description (text), amount (numeric), status (text: ACTIVE/RELEASED/EXPIRED),
    effective_at (timestamptz), expiration_at (timestamptz), rule_set_version (text),
    approved_by (text), approved_at (timestamptz), created_at

2. Security
- Enable RLS on all tables.
- Single-tenant, no-auth app: allow anon + authenticated full CRUD on all tables
  (data is intentionally shared for this internal operations tool).

3. Indexes
- facilities by borrower_id
- collateral_ar by facility_id and status
- reserves by facility_id and status
*/

CREATE TABLE IF NOT EXISTS borrowers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text NOT NULL,
  tax_id text,
  address text,
  contact_email text,
  contact_phone text,
  industry text,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  facility_name text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  currency_code text NOT NULL DEFAULT 'USD',
  commitment_amount numeric(18,2) NOT NULL DEFAULT 0,
  outstanding_principal numeric(18,2) NOT NULL DEFAULT 0,
  pending_fundings numeric(18,2) NOT NULL DEFAULT 0,
  reserve_amount numeric(18,2) NOT NULL DEFAULT 0,
  ar_advance_rate numeric(5,4) NOT NULL DEFAULT 0.85,
  inventory_advance_rate numeric(5,4) NOT NULL DEFAULT 0.50,
  interest_rate numeric(8,5) NOT NULL DEFAULT 0.08500,
  effective_date date,
  maturity_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collateral_ar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  obligor_id text NOT NULL,
  obligor_name text,
  invoice_number text NOT NULL,
  outstanding_amount numeric(18,2) NOT NULL DEFAULT 0,
  invoice_date date NOT NULL,
  due_date date,
  disputed_flag boolean NOT NULL DEFAULT false,
  ineligible_flag boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reserves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  reserve_type text NOT NULL,
  description text,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  effective_at timestamptz NOT NULL DEFAULT now(),
  expiration_at timestamptz,
  rule_set_version text DEFAULT '1.0',
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facilities_borrower_id ON facilities(borrower_id);
CREATE INDEX IF NOT EXISTS idx_facilities_status ON facilities(status);
CREATE INDEX IF NOT EXISTS idx_collateral_ar_facility_id ON collateral_ar(facility_id);
CREATE INDEX IF NOT EXISTS idx_collateral_ar_status ON collateral_ar(status);
CREATE INDEX IF NOT EXISTS idx_reserves_facility_id ON reserves(facility_id);
CREATE INDEX IF NOT EXISTS idx_reserves_status ON reserves(status);

-- Enable RLS
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE collateral_ar ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserves ENABLE ROW LEVEL SECURITY;

-- Borrowers policies (single-tenant, no auth)
DROP POLICY IF EXISTS "anon_select_borrowers" ON borrowers;
CREATE POLICY "anon_select_borrowers" ON borrowers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_borrowers" ON borrowers;
CREATE POLICY "anon_insert_borrowers" ON borrowers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_borrowers" ON borrowers;
CREATE POLICY "anon_update_borrowers" ON borrowers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_borrowers" ON borrowers;
CREATE POLICY "anon_delete_borrowers" ON borrowers FOR DELETE TO anon, authenticated USING (true);

-- Facilities policies
DROP POLICY IF EXISTS "anon_select_facilities" ON facilities;
CREATE POLICY "anon_select_facilities" ON facilities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_facilities" ON facilities;
CREATE POLICY "anon_insert_facilities" ON facilities FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_facilities" ON facilities;
CREATE POLICY "anon_update_facilities" ON facilities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_facilities" ON facilities;
CREATE POLICY "anon_delete_facilities" ON facilities FOR DELETE TO anon, authenticated USING (true);

-- Collateral AR policies
DROP POLICY IF EXISTS "anon_select_collateral_ar" ON collateral_ar;
CREATE POLICY "anon_select_collateral_ar" ON collateral_ar FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_collateral_ar" ON collateral_ar;
CREATE POLICY "anon_insert_collateral_ar" ON collateral_ar FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_collateral_ar" ON collateral_ar;
CREATE POLICY "anon_update_collateral_ar" ON collateral_ar FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_collateral_ar" ON collateral_ar;
CREATE POLICY "anon_delete_collateral_ar" ON collateral_ar FOR DELETE TO anon, authenticated USING (true);

-- Reserves policies
DROP POLICY IF EXISTS "anon_select_reserves" ON reserves;
CREATE POLICY "anon_select_reserves" ON reserves FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reserves" ON reserves;
CREATE POLICY "anon_insert_reserves" ON reserves FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reserves" ON reserves;
CREATE POLICY "anon_update_reserves" ON reserves FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_reserves" ON reserves;
CREATE POLICY "anon_delete_reserves" ON reserves FOR DELETE TO anon, authenticated USING (true);
