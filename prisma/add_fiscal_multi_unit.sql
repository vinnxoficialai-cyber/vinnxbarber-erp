-- ============================================================
-- Migration: Multi-Unit Fiscal Support
-- Date: 2026-05-05
-- Description: Adds unique constraint for per-unit fiscal config,
--              performance indices, and clientPhone column.
-- Safe to run multiple times (IF NOT EXISTS / idempotent).
-- ============================================================

-- 1. Unique partial index: max 1 fiscal config per unit
--    Allows N units, each with their own fiscal_settings row
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_settings_unit 
  ON fiscal_settings ("unitId") WHERE "unitId" IS NOT NULL;

-- 2. Performance indices for unit-filtered queries
CREATE INDEX IF NOT EXISTS idx_invoices_unit 
  ON invoices ("unitId") WHERE "unitId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_emitters_unit 
  ON invoice_emitters ("unitId") WHERE "unitId" IS NOT NULL;

-- 3. Phone column for tomador (Sigiss accepts phone number)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "clientPhone" TEXT;
