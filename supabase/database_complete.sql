-- ============================================================
-- Azhagi Farm — Complete All-in-One Database Schema
-- Run this single script in your Supabase SQL Editor to set up
-- the entire database for Azhagi Farm Milk (web + mobile app).
-- Includes all tables, indexes, triggers, public access & realtime sync!
-- ============================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Table: app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  default_rate NUMERIC(10,2) NOT NULL DEFAULT 60.00,
  farm_name TEXT NOT NULL DEFAULT 'Azhagi Farm',
  currency TEXT NOT NULL DEFAULT 'INR',
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  batch TEXT NOT NULL CHECK (batch IN ('morning', 'evening', 'both')),
  default_quantity_litre NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  default_quantity_evening_litre NUMERIC(5,2),
  custom_rate NUMERIC(10,2),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: milk_entries
CREATE TABLE IF NOT EXISTS milk_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  batch TEXT NOT NULL CHECK (batch IN ('morning', 'evening')) DEFAULT 'morning',
  quantity_litre NUMERIC(5,2),
  status TEXT NOT NULL CHECK (status IN ('delivered', 'no_milk')) DEFAULT 'delivered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_milk_entries_customer_date_batch UNIQUE (customer_id, entry_date, batch)
);

-- Table: monthly_bills
CREATE TABLE IF NOT EXISTS monthly_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  billing_year INTEGER NOT NULL,
  billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  total_litres NUMERIC(8,2) NOT NULL DEFAULT 0,
  rate_per_litre NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_monthly_bills_customer_period UNIQUE (customer_id, billing_year, billing_month)
);

-- Table: payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID,
  bill_id UUID NOT NULL REFERENCES monthly_bills(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: cattle (inventory)
CREATE TABLE IF NOT EXISTS cattle (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cow', 'buffalo')),
  status TEXT NOT NULL CHECK (status IN ('milking', 'dry', 'calf', 'sold')),
  tag_number TEXT,
  dob DATE,
  purchased_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: cattle_yields (daily milk yield per animal)
CREATE TABLE IF NOT EXISTS cattle_yields (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES cattle(id) ON DELETE CASCADE,
  yield_date DATE NOT NULL,
  morning_litres NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  evening_litres NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cattle_yields_animal_date UNIQUE (animal_id, yield_date)
);

-- ============================================================
-- 3. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(active);
CREATE INDEX IF NOT EXISTS idx_milk_entries_date ON milk_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_milk_entries_customer_date ON milk_entries(customer_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_monthly_bills_period ON monthly_bills(billing_year, billing_month);
CREATE INDEX IF NOT EXISTS idx_monthly_bills_customer ON monthly_bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_cattle_status ON cattle(status);
CREATE INDEX IF NOT EXISTS idx_cattle_type ON cattle(type);
CREATE INDEX IF NOT EXISTS idx_cattle_yields_date ON cattle_yields(yield_date);
CREATE INDEX IF NOT EXISTS idx_cattle_yields_animal ON cattle_yields(animal_id);

-- ============================================================
-- 4. AUTO-UPDATE TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_settings_updated ON app_settings;
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_customers_updated ON customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_milk_entries_updated ON milk_entries;
CREATE TRIGGER trg_milk_entries_updated BEFORE UPDATE ON milk_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_monthly_bills_updated ON monthly_bills;
CREATE TRIGGER trg_monthly_bills_updated BEFORE UPDATE ON monthly_bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cattle_updated ON cattle;
CREATE TRIGGER trg_cattle_updated BEFORE UPDATE ON cattle FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cattle_yields_updated ON cattle_yields;
CREATE TRIGGER trg_cattle_yields_updated BEFORE UPDATE ON cattle_yields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. NO-LOGIN PUBLIC ACCESS (Disable RLS for single-farm access)
-- ============================================================
ALTER TABLE IF EXISTS app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS milk_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS monthly_bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cattle DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cattle_yields DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. ENABLE REALTIME BROADCAST (Live cross-device sync)
-- ============================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE app_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE customers; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE milk_entries; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE monthly_bills; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE payments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE cattle; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE cattle_yields; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
