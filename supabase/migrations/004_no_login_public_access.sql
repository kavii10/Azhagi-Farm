-- ============================================================
-- Azhagi Farm — Allow Public / No-Login Real-Time Access
-- Run this in your Supabase SQL Editor to enable cloud sync
-- without requiring user login or passwords.
-- ============================================================

-- Option A: Disable RLS for single-farm real-time usage (Easiest)
ALTER TABLE IF EXISTS app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS milk_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS monthly_bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;

-- If owner_id had a foreign key constraint to auth.users, allow nulls:
ALTER TABLE IF EXISTS customers ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE IF EXISTS milk_entries ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE IF EXISTS monthly_bills ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE IF EXISTS payments ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE IF EXISTS app_settings ALTER COLUMN owner_id DROP NOT NULL;
