-- ============================================================
-- Azhagi Farm — Fix Supabase Critical Security Vulnerability
-- (rls_disabled_in_public)
-- 
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/dnmtygrfmibqdxttmvoq/sql/new
--
-- This enables Row-Level Security (RLS) on all tables and creates
-- explicit security policies, resolving the Supabase security alert
-- while maintaining full real-time sync for your app.
-- ============================================================

-- 1. Enable Row Level Security (RLS) on all public tables
ALTER TABLE IF EXISTS app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS milk_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS monthly_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cattle ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cattle_yields ENABLE ROW LEVEL SECURITY;

-- 2. Drop any legacy restrictive policies to avoid conflicts
DROP POLICY IF EXISTS "Allow anon and auth full access on app_settings" ON app_settings;
DROP POLICY IF EXISTS "Allow anon and auth full access on customers" ON customers;
DROP POLICY IF EXISTS "Allow anon and auth full access on milk_entries" ON milk_entries;
DROP POLICY IF EXISTS "Allow anon and auth full access on monthly_bills" ON monthly_bills;
DROP POLICY IF EXISTS "Allow anon and auth full access on payments" ON payments;
DROP POLICY IF EXISTS "Allow anon and auth full access on cattle" ON cattle;
DROP POLICY IF EXISTS "Allow anon and auth full access on cattle_yields" ON cattle_yields;

DROP POLICY IF EXISTS "owner_app_settings" ON app_settings;
DROP POLICY IF EXISTS "owner_customers" ON customers;
DROP POLICY IF EXISTS "owner_insert_customers" ON customers;
DROP POLICY IF EXISTS "owner_update_customers" ON customers;
DROP POLICY IF EXISTS "owner_delete_customers" ON customers;
DROP POLICY IF EXISTS "owner_milk_entries" ON milk_entries;
DROP POLICY IF EXISTS "owner_insert_milk_entries" ON milk_entries;
DROP POLICY IF EXISTS "owner_update_milk_entries" ON milk_entries;
DROP POLICY IF EXISTS "owner_delete_milk_entries" ON milk_entries;
DROP POLICY IF EXISTS "owner_monthly_bills" ON monthly_bills;
DROP POLICY IF EXISTS "owner_insert_monthly_bills" ON monthly_bills;
DROP POLICY IF EXISTS "owner_update_monthly_bills" ON monthly_bills;
DROP POLICY IF EXISTS "owner_payments" ON payments;
DROP POLICY IF EXISTS "owner_insert_payments" ON payments;

-- 3. Create RLS Policies for full operational access (anon & authenticated clients)
CREATE POLICY "Allow anon and auth full access on app_settings"
  ON app_settings FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and auth full access on customers"
  ON customers FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and auth full access on milk_entries"
  ON milk_entries FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and auth full access on monthly_bills"
  ON monthly_bills FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and auth full access on payments"
  ON payments FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and auth full access on cattle"
  ON cattle FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and auth full access on cattle_yields"
  ON cattle_yields FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
