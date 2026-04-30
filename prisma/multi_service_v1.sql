-- ============================================================
-- Multi-Service & Fractional Quota Migration
-- ============================================================
-- Run in Supabase SQL Editor
-- SAFE: All operations are idempotent (IF NOT EXISTS / OR REPLACE)

-- ─── Step 1: Add combo fields to subscription_plans ───
ALTER TABLE subscription_plans 
  ADD COLUMN IF NOT EXISTS "comboMode" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "comboServiceIds" JSONB DEFAULT '[]'::jsonb;

-- ─── Step 2: Add missing columns to calendar_events ───
-- These fields are written by the booking flow but were never in the schema!
-- Without them: serviceIds, usedInPlan, couponCode, finalPrice, source 
-- are silently dropped on INSERT, breaking cancel-decrement and audit trail.
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS "serviceIds" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "usedInPlan" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "finalPrice" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "couponCode" TEXT,
  ADD COLUMN IF NOT EXISTS "usedReferralCredit" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "clientId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS "rating" INT,
  ADD COLUMN IF NOT EXISTS "ratingComment" TEXT;

-- ─── Step 3: Normalize NULLs before type change ───
UPDATE subscriptions 
  SET "usesThisMonth" = 0 
  WHERE "usesThisMonth" IS NULL;

-- ─── Step 4: Change usesThisMonth from INT to DECIMAL(5,1) ───
ALTER TABLE subscriptions 
  ALTER COLUMN "usesThisMonth" TYPE DECIMAL(5,1) 
    USING "usesThisMonth"::DECIMAL(5,1);

-- Re-declare default after type change
ALTER TABLE subscriptions 
  ALTER COLUMN "usesThisMonth" SET DEFAULT 0;

-- ─── Step 5: Ensure maxUsesPerMonth exists ───
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_plans' AND column_name = 'maxUsesPerMonth'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN "maxUsesPerMonth" INTEGER;
  END IF;
END $$;

-- ─── Step 6: Update RPC to accept NUMERIC (was INT) ───
DROP FUNCTION IF EXISTS increment_subscription_uses(UUID, INT);
CREATE OR REPLACE FUNCTION increment_subscription_uses(sub_id UUID, delta NUMERIC)
RETURNS void LANGUAGE sql AS $$
    UPDATE subscriptions
    SET "usesThisMonth" = GREATEST(0, COALESCE("usesThisMonth", 0) + delta)
    WHERE id = sub_id;
$$;

-- ─── Step 7: Comments ───
COMMENT ON COLUMN subscription_plans."comboMode" IS 'When true, booking all combo services = 1 use, partial = 0.5';
COMMENT ON COLUMN subscription_plans."comboServiceIds" IS 'Service IDs that form the combo group';
COMMENT ON COLUMN subscriptions."usesThisMonth" IS 'DECIMAL for fractional combo usage (1.0 = full, 0.5 = partial)';
COMMENT ON COLUMN calendar_events."serviceIds" IS 'JSON array of service IDs for multi-service bookings';
COMMENT ON COLUMN calendar_events."usedInPlan" IS 'True if plan discount was applied to this booking';

SELECT 'Multi-service migration applied successfully!' as result;
