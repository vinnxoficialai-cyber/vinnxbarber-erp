-- ============================================================
-- VINNX Barber — Enterprise Fields: Team Commissions
-- ============================================================
-- ALREADY APPLIED TO SUPABASE (2026-02-27)

-- 1. Team Members: Add Subscription & Product Commissions
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS "subscriptionCommission" DECIMAL(5,4) DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS "productCommission" DECIMAL(5,4) DEFAULT 0.10;
