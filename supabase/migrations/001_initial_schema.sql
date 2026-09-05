-- ============================================================
-- Azhagi Farm — Supabase PostgreSQL Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- app_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  default_rate NUMERIC(10,2) NOT NULL DEFAULT 60.00,
  farm_name TEXT NOT NULL DEFAULT 'Azhagi Farm',
  currency TEXT NOT NULL DEFAULT 'INR',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- customers
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- ============================================================
-- milk_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS milk_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  batch TEXT NOT NULL CHECK (batch IN ('morning', 'evening')) DEFAULT 'morning',
  quantity_litre NUMERIC(5,2),
  status TEXT NOT NULL CHECK (status IN ('delivered', 'no_milk')) DEFAULT 'delivered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, entry_date, batch)
);

-- ============================================================
-- monthly_bills
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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
  UNIQUE (customer_id, billing_year, billing_month)
);

-- ============================================================
-- payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES monthly_bills(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_milk_entries_customer_date ON milk_entries(customer_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_milk_entries_date ON milk_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_milk_entries_owner ON milk_entries(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id, active);
CREATE INDEX IF NOT EXISTS idx_monthly_bills_owner ON monthly_bills(owner_id);
CREATE INDEX IF NOT EXISTS idx_monthly_bills_period ON monthly_bills(billing_year, billing_month);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- app_settings policies
CREATE POLICY "owner_settings" ON app_settings
  USING (owner_id = auth.uid());
CREATE POLICY "owner_insert_settings" ON app_settings
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner_update_settings" ON app_settings
  FOR UPDATE USING (owner_id = auth.uid());

-- customers policies
CREATE POLICY "owner_customers" ON customers
  USING (owner_id = auth.uid());
CREATE POLICY "owner_insert_customers" ON customers
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner_update_customers" ON customers
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "owner_delete_customers" ON customers
  FOR DELETE USING (owner_id = auth.uid());

-- milk_entries policies
CREATE POLICY "owner_milk_entries" ON milk_entries
  USING (owner_id = auth.uid());
CREATE POLICY "owner_insert_milk_entries" ON milk_entries
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner_update_milk_entries" ON milk_entries
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "owner_delete_milk_entries" ON milk_entries
  FOR DELETE USING (owner_id = auth.uid());

-- monthly_bills policies
CREATE POLICY "owner_monthly_bills" ON monthly_bills
  USING (owner_id = auth.uid());
CREATE POLICY "owner_insert_monthly_bills" ON monthly_bills
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner_update_monthly_bills" ON monthly_bills
  FOR UPDATE USING (owner_id = auth.uid());

-- payments policies
CREATE POLICY "owner_payments" ON payments
  USING (owner_id = auth.uid());
CREATE POLICY "owner_insert_payments" ON payments
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_app_settings_updated
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_milk_entries_updated
  BEFORE UPDATE ON milk_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_monthly_bills_updated
  BEFORE UPDATE ON monthly_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
