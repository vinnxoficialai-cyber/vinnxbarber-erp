-- Migration: Add serviceSlots and groupId columns to calendar_events
-- Run this in Supabase SQL Editor
-- IMPORTANT: Run BEFORE deploying the updated frontend code

-- 1. Add compound event columns
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "serviceSlots" JSONB DEFAULT NULL;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "groupId" TEXT DEFAULT NULL;

-- 2. Index for groupId lookups (split event propagation via F5/F6)
CREATE INDEX IF NOT EXISTS idx_calendar_events_group_id ON calendar_events ("groupId") WHERE "groupId" IS NOT NULL;

-- 3. Verify
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'calendar_events'
  AND column_name IN ('serviceSlots', 'groupId')
ORDER BY column_name;
