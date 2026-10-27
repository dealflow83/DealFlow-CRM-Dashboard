/*
# Create cash buyer tables: cash_buyers + buyer_outreach_history

## Purpose
Adds persistence for the Worldwide Cash Buyer Search feature in DealFlow.

## Notes
- Single-tenant no-auth app: grants to anon, authenticated; USING/WITH CHECK (true).
- Country uses ISO country code for compatibility with the built-in country list;
  country_name is stored denormalized for display.
- Verification is tracked separately from relationship status. is_verified defaults
  false and is only set true when a user confirms proof-of-funds explicitly.
- buyer_source distinguishes saved vs imported vs external provider records.

## 1. New Tables

### cash_buyers
- id (uuid PK)
- owner_id (text)
- buyer_name (text) -- buyer or company name
- contact_person (text)
- business_email (text)
- business_phone (text)
- country, country_code, state_province, city, area, zip_code (text)
- preferred_markets (text) -- comma-separated preferred investment markets
- preferred_property_types (text) -- comma-separated
- min_purchase_price, max_purchase_price (numeric(14,2))
- investment_strategy (text)
- proof_of_funds_status (text) -- e.g. None / Provided / Verified
- buyer_source (text) -- Saved / Imported / External
- date_added (date)
- last_contact_date (date)
- follow_up_date (date)
- notes (text)
- relationship_status (text) -- New/Contacted/Interested/Verified/Offer Requested/Active Buyer/Inactive
- is_verified (bool default false)
- lead_id (text, nullable) -- optional association
- created_at, updated_at (timestamptz)

### buyer_outreach_history
- id (uuid PK)
- buyer_id (uuid FK -> cash_buyers.id ON DELETE CASCADE)
- contact_type (text) -- e.g. Call, Email, SMS, Meeting
- contact_date (date)
- note (text)
- created_at (timestamptz)

## 2. Security
- RLS enabled on both tables.
- Grants (SELECT, INSERT, UPDATE, DELETE) to anon, authenticated.
- Four per-verb policies per table, USING/WITH CHECK (true) (single-tenant shared data).
*/

CREATE TABLE IF NOT EXISTS cash_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT '',
  buyer_name text NOT NULL DEFAULT '',
  contact_person text NOT NULL DEFAULT '',
  business_email text NOT NULL DEFAULT '',
  business_phone text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT '',
  state_province text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  zip_code text NOT NULL DEFAULT '',
  preferred_markets text NOT NULL DEFAULT '',
  preferred_property_types text NOT NULL DEFAULT '',
  min_purchase_price numeric(14,2),
  max_purchase_price numeric(14,2),
  investment_strategy text NOT NULL DEFAULT '',
  proof_of_funds_status text NOT NULL DEFAULT 'None',
  buyer_source text NOT NULL DEFAULT 'Saved',
  date_added date,
  last_contact_date date,
  follow_up_date date,
  notes text NOT NULL DEFAULT '',
  relationship_status text NOT NULL DEFAULT 'New',
  is_verified boolean NOT NULL DEFAULT false,
  lead_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_outreach_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES cash_buyers(id) ON DELETE CASCADE,
  contact_type text NOT NULL DEFAULT 'Note',
  contact_date date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_buyers_country ON cash_buyers(country_code);
CREATE INDEX IF NOT EXISTS idx_cash_buyers_city ON cash_buyers(city);
CREATE INDEX IF NOT EXISTS idx_cash_buyers_area ON cash_buyers(area);
CREATE INDEX IF NOT EXISTS idx_cash_buyers_owner ON cash_buyers(owner_id);
CREATE INDEX IF NOT EXISTS idx_buyer_outreach_buyer ON buyer_outreach_history(buyer_id);

ALTER TABLE cash_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_outreach_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON cash_buyers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON buyer_outreach_history TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cash_buyers, buyer_outreach_history TO service_role;

-- Policies: cash_buyers
DROP POLICY IF EXISTS "buyer_select" ON cash_buyers;
CREATE POLICY "buyer_select" ON cash_buyers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "buyer_insert" ON cash_buyers;
CREATE POLICY "buyer_insert" ON cash_buyers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "buyer_update" ON cash_buyers;
CREATE POLICY "buyer_update" ON cash_buyers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "buyer_delete" ON cash_buyers;
CREATE POLICY "buyer_delete" ON cash_buyers FOR DELETE TO anon, authenticated USING (true);

-- Policies: buyer_outreach_history
DROP POLICY IF EXISTS "outreach_select" ON buyer_outreach_history;
CREATE POLICY "outreach_select" ON buyer_outreach_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "outreach_insert" ON buyer_outreach_history;
CREATE POLICY "outreach_insert" ON buyer_outreach_history FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "outreach_update" ON buyer_outreach_history;
CREATE POLICY "outreach_update" ON buyer_outreach_history FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "outreach_delete" ON buyer_outreach_history;
CREATE POLICY "outreach_delete" ON buyer_outreach_history FOR DELETE TO anon, authenticated USING (true);
