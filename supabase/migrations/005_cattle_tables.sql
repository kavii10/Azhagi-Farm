-- ============================================================
-- Azhagi Farm — Cattle Inventory & Daily Yield Schema
-- Run this query in your Supabase SQL Editor to enable Cattle & Milk Yield tracking in the cloud!
-- ============================================================

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

CREATE TABLE IF NOT EXISTS cattle_yields (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES cattle(id) ON DELETE CASCADE,
  yield_date DATE NOT NULL,
  morning_litres NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  evening_litres NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (animal_id, yield_date)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cattle_status ON cattle(status);
CREATE INDEX IF NOT EXISTS idx_cattle_type ON cattle(type);
CREATE INDEX IF NOT EXISTS idx_cattle_yields_date ON cattle_yields(yield_date);
CREATE INDEX IF NOT EXISTS idx_cattle_yields_animal ON cattle_yields(animal_id);

-- Disable Row Level Security for No-Login Real-Time Access
ALTER TABLE IF EXISTS cattle DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cattle_yields DISABLE ROW LEVEL SECURITY;
