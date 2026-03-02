-- Add salesExecutiveId column to project_tasks table to support component-level access control
-- This matches the pattern used in the 'clients' table

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'salesExecutiveId') THEN
        ALTER TABLE "project_tasks" ADD COLUMN "salesExecutiveId" text;
    END IF;
END $$;
