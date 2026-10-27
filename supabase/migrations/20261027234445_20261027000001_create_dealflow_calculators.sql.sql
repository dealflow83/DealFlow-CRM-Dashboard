/*
# Create calculator tables: ARV analyses, comparables, subto, wrap

## Purpose
Adds persistence for the three new calculators in DealFlow:
1. Comps / ARV Calculator
2. Subject-To (Subto) Calculator
3. Wrap Mortgage Calculator

## Notes
- The DealFlow app currently runs as a single-tenant no-auth preview (no sign-in screen, anon key).
- Per Bolt database guidance for no-auth apps, all new tables are granted to
  `anon, authenticated` and use `USING (true)` policies so the anon-key client
  can read and write its own data. RLS is still enabled on every table.
- owner_id is a text column (client-generated identifier) for future migration
  to authenticated users; it is not enforced by policy in the no-auth model.
- Monetary values use numeric(14,2) for proper precision.
- None of the existing tables (leads, lead_activities, follow_ups) are modified.

## 1. New Tables

### arv_analyses
- id (uuid PK)
- owner_id (text, client identifier)
- property_address, country, state_province, city, area, zip_code (text)
- property_type (text)
- bedrooms (int), bathrooms (numeric(3,1))
- square_footage (int), lot_size (numeric(10,2))
- property_condition (text)
- estimated_repair_costs (numeric(14,2))
- estimated_arv, arv_low, arv_high (numeric(14,2)) -- computed outputs
- avg_price_sqft, median_sale_price, avg_sale_price (numeric(14,2)) -- computed
- notes (text)
- lead_id (text, nullable) -- optional association with a lead
- created_at, updated_at (timestamptz)

### comparables
- id (uuid PK)
- arv_analysis_id (uuid FK -> arv_analyses.id ON DELETE CASCADE)
- address, sale_date (text)
- sale_price (numeric(14,2))
- square_footage (int)
- bedrooms (int), bathrooms (numeric(3,1))
- property_type, property_condition (text)
- distance (numeric(8,2)) -- miles/km from subject
- notes (text)
- excluded (bool default false) -- user can exclude a comp from calc
- created_at (timestamptz)

### subto_analyses
- id (uuid PK)
- owner_id (text)
- property_address (text)
- estimated_value, estimated_arv, mortgage_balance (numeric(14,2))
- monthly_pi, monthly_taxes, monthly_insurance, hoa_fees (numeric(14,2))
- interest_rate (numeric(6,3))
- remaining_term_months (int)
- monthly_rent, monthly_maintenance, vacancy_allowance, property_management (numeric(14,2))
- closing_costs, cash_to_seller, other_acquisition_costs (numeric(14,2))
- expected_resale_price (numeric(14,2))
- holding_period_months (int)
- notes (text)
- lead_id (text, nullable)
- created_at, updated_at (timestamptz)

### wrap_analyses
- id (uuid PK)
- owner_id (text)
- property_address, country, state_province, city, area (text)
- estimated_value, underlying_balance (numeric(14,2))
- underlying_monthly_payment (numeric(14,2))
- underlying_rate (numeric(6,3))
- underlying_term_months (int)
- wrap_sale_price, buyer_down_payment, wrap_principal (numeric(14,2))
- wrap_rate (numeric(6,3))
- wrap_term_months, amortization_months (int)
- balloon_amount (numeric(14,2))
- balloon_date (text)
- monthly_taxes, monthly_insurance, hoa_fees, other_monthly, servicing_fees, closing_costs (numeric(14,2))
- notes (text)
- lead_id (text, nullable)
- created_at, updated_at (timestamptz)

## 2. Security
- RLS enabled on every new table.
- Grants (SELECT, INSERT, UPDATE, DELETE) to anon, authenticated.
- Four per-verb policies per table, all USING/WITH CHECK (true) (single-tenant shared data).
- service_role granted all verbs for server-side use if needed later.
*/

CREATE TABLE IF NOT EXISTS arv_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT '',
  property_address text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  state_province text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  zip_code text NOT NULL DEFAULT '',
  property_type text NOT NULL DEFAULT 'Single Family',
  bedrooms integer,
  bathrooms numeric(3,1),
  square_footage integer,
  lot_size numeric(10,2),
  property_condition text NOT NULL DEFAULT '',
  estimated_repair_costs numeric(14,2),
  estimated_arv numeric(14,2),
  arv_low numeric(14,2),
  arv_high numeric(14,2),
  avg_price_sqft numeric(14,2),
  median_sale_price numeric(14,2),
  avg_sale_price numeric(14,2),
  notes text NOT NULL DEFAULT '',
  lead_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comparables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arv_analysis_id uuid NOT NULL REFERENCES arv_analyses(id) ON DELETE CASCADE,
  address text NOT NULL DEFAULT '',
  sale_price numeric(14,2),
  sale_date text NOT NULL DEFAULT '',
  square_footage integer,
  bedrooms integer,
  bathrooms numeric(3,1),
  property_type text NOT NULL DEFAULT '',
  property_condition text NOT NULL DEFAULT '',
  distance numeric(8,2),
  notes text NOT NULL DEFAULT '',
  excluded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subto_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT '',
  property_address text NOT NULL DEFAULT '',
  estimated_value numeric(14,2),
  estimated_arv numeric(14,2),
  mortgage_balance numeric(14,2),
  monthly_pi numeric(14,2),
  monthly_taxes numeric(14,2),
  monthly_insurance numeric(14,2),
  hoa_fees numeric(14,2),
  interest_rate numeric(6,3),
  remaining_term_months integer,
  monthly_rent numeric(14,2),
  monthly_maintenance numeric(14,2),
  vacancy_allowance numeric(14,2),
  property_management numeric(14,2),
  closing_costs numeric(14,2),
  cash_to_seller numeric(14,2),
  other_acquisition_costs numeric(14,2),
  expected_resale_price numeric(14,2),
  holding_period_months integer,
  notes text NOT NULL DEFAULT '',
  lead_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wrap_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT '',
  property_address text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  state_province text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  estimated_value numeric(14,2),
  underlying_balance numeric(14,2),
  underlying_monthly_payment numeric(14,2),
  underlying_rate numeric(6,3),
  underlying_term_months integer,
  wrap_sale_price numeric(14,2),
  buyer_down_payment numeric(14,2),
  wrap_principal numeric(14,2),
  wrap_rate numeric(6,3),
  wrap_term_months integer,
  amortization_months integer,
  balloon_amount numeric(14,2),
  balloon_date text NOT NULL DEFAULT '',
  monthly_taxes numeric(14,2),
  monthly_insurance numeric(14,2),
  hoa_fees numeric(14,2),
  other_monthly numeric(14,2),
  servicing_fees numeric(14,2),
  closing_costs numeric(14,2),
  notes text NOT NULL DEFAULT '',
  lead_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_comparables_arv_analysis ON comparables(arv_analysis_id);
CREATE INDEX IF NOT EXISTS idx_arv_analyses_owner ON arv_analyses(owner_id);
CREATE INDEX IF NOT EXISTS idx_subto_analyses_owner ON subto_analyses(owner_id);
CREATE INDEX IF NOT EXISTS idx_wrap_analyses_owner ON wrap_analyses(owner_id);

-- Enable RLS
ALTER TABLE arv_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparables ENABLE ROW LEVEL SECURITY;
ALTER TABLE subto_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrap_analyses ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON arv_analyses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON comparables TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subto_analyses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wrap_analyses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON arv_analyses, comparables, subto_analyses, wrap_analyses TO service_role;

-- Policies: arv_analyses (single-tenant, anon+authenticated)
DROP POLICY IF EXISTS "arv_select" ON arv_analyses;
CREATE POLICY "arv_select" ON arv_analyses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "arv_insert" ON arv_analyses;
CREATE POLICY "arv_insert" ON arv_analyses FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "arv_update" ON arv_analyses;
CREATE POLICY "arv_update" ON arv_analyses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "arv_delete" ON arv_analyses;
CREATE POLICY "arv_delete" ON arv_analyses FOR DELETE TO anon, authenticated USING (true);

-- Policies: comparables
DROP POLICY IF EXISTS "comp_select" ON comparables;
CREATE POLICY "comp_select" ON comparables FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "comp_insert" ON comparables;
CREATE POLICY "comp_insert" ON comparables FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "comp_update" ON comparables;
CREATE POLICY "comp_update" ON comparables FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "comp_delete" ON comparables;
CREATE POLICY "comp_delete" ON comparables FOR DELETE TO anon, authenticated USING (true);

-- Policies: subto_analyses
DROP POLICY IF EXISTS "subto_select" ON subto_analyses;
CREATE POLICY "subto_select" ON subto_analyses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "subto_insert" ON subto_analyses;
CREATE POLICY "subto_insert" ON subto_analyses FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "subto_update" ON subto_analyses;
CREATE POLICY "subto_update" ON subto_analyses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "subto_delete" ON subto_analyses;
CREATE POLICY "subto_delete" ON subto_analyses FOR DELETE TO anon, authenticated USING (true);

-- Policies: wrap_analyses
DROP POLICY IF EXISTS "wrap_select" ON wrap_analyses;
CREATE POLICY "wrap_select" ON wrap_analyses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "wrap_insert" ON wrap_analyses;
CREATE POLICY "wrap_insert" ON wrap_analyses FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "wrap_update" ON wrap_analyses;
CREATE POLICY "wrap_update" ON wrap_analyses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "wrap_delete" ON wrap_analyses;
CREATE POLICY "wrap_delete" ON wrap_analyses FOR DELETE TO anon, authenticated USING (true);
