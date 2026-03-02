-- ==============================================================================
-- MIGRATION: Add missing columns to 'tasks' table + fix FK references
-- ==============================================================================
-- The frontend uses 'ProjectTask' with fields (clientName, clientPhone, segment,
-- deadline, daysLeft, salesExecutiveId) but these columns don't exist in the DB.
-- This migration adds them so saveProjectTask() can actually persist data.
-- ==============================================================================

-- 1. Add missing columns to 'tasks' table (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'clientName') THEN
        ALTER TABLE "tasks" ADD COLUMN "clientName" text DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'clientPhone') THEN
        ALTER TABLE "tasks" ADD COLUMN "clientPhone" text DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'segment') THEN
        ALTER TABLE "tasks" ADD COLUMN "segment" text DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'deadline') THEN
        ALTER TABLE "tasks" ADD COLUMN "deadline" integer DEFAULT 7;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'daysLeft') THEN
        ALTER TABLE "tasks" ADD COLUMN "daysLeft" integer DEFAULT 0;
    END IF;
    -- salesExecutiveId was added in previous migration, but check anyway
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'salesExecutiveId') THEN
        ALTER TABLE "tasks" ADD COLUMN "salesExecutiveId" text;
    END IF;
END $$;

-- Verification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name IN ('clientName', 'clientPhone', 'segment', 'deadline', 'daysLeft', 'salesExecutiveId')
ORDER BY column_name;
