-- ============================================================
-- Migration: Add 'both' batch, evening default qty, and entry batch
-- ============================================================

-- 1. Update customers batch constraint and add default_quantity_evening_litre
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_batch_check;
ALTER TABLE customers ADD CONSTRAINT customers_batch_check CHECK (batch IN ('morning', 'evening', 'both'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS default_quantity_evening_litre NUMERIC(5,2);

-- 2. Add batch column to milk_entries
ALTER TABLE milk_entries ADD COLUMN IF NOT EXISTS batch TEXT NOT NULL DEFAULT 'morning' CHECK (batch IN ('morning', 'evening'));

-- 3. Update unique constraint on milk_entries to (customer_id, entry_date, batch)
ALTER TABLE milk_entries DROP CONSTRAINT IF EXISTS milk_entries_customer_id_entry_date_key;
ALTER TABLE milk_entries DROP CONSTRAINT IF EXISTS milk_entries_customer_id_entry_date_batch_key;
ALTER TABLE milk_entries ADD CONSTRAINT milk_entries_customer_id_entry_date_batch_key UNIQUE (customer_id, entry_date, batch);
