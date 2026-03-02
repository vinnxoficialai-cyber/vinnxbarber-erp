-- ==============================================================================
-- FINAL SECURITY MIGRATION: Project Tasks (table: "tasks") Scoping & Security
-- ==============================================================================
-- This script performs two critical actions:
-- 1. Adds the 'salesExecutiveId' column to 'tasks' (if missing).
-- 2. Enforces strict Row Level Security (RLS) policies.
-- 
-- IMPORTANT: The actual table name is "tasks" (Prisma @@map("tasks")),
-- NOT "project_tasks". The frontend calls them "ProjectTasks" but the
-- database table is "tasks".
-- ==============================================================================

-- 1. Add 'salesExecutiveId' Column (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'salesExecutiveId') THEN
        ALTER TABLE "tasks" ADD COLUMN "salesExecutiveId" text;
    END IF;
END $$;

-- 1b. Assign existing unowned tasks to the first ADMIN
-- This prevents tasks from becoming invisible after scoping is enforced
UPDATE "tasks"
SET "salesExecutiveId" = (
    SELECT u.id FROM users u WHERE u.role = 'ADMIN' LIMIT 1
)
WHERE "salesExecutiveId" IS NULL;

-- 2. Enable Row Level Security
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;

-- 3. Cleanup Old/Permissive Policies
DROP POLICY IF EXISTS "Allow all for tasks" ON "tasks";
DROP POLICY IF EXISTS "tasks_select" ON "tasks";
DROP POLICY IF EXISTS "tasks_insert" ON "tasks";
DROP POLICY IF EXISTS "tasks_update" ON "tasks";
DROP POLICY IF EXISTS "tasks_delete" ON "tasks";

-- 4. Define Strict Policies

-- SELECT: Users see their own tasks OR if they are Admin/Manager
CREATE POLICY "tasks_select" ON "tasks" FOR SELECT
USING (
  auth.uid()::text = "salesExecutiveId"
  OR
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::text 
    AND role IN ('ADMIN', 'MANAGER')
  )
);

-- INSERT: Any authenticated user can create a task
-- Note: Logic in App ensures they assign themselves as owner
CREATE POLICY "tasks_insert" ON "tasks" FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Owners OR Admins/Managers can edit
CREATE POLICY "tasks_update" ON "tasks" FOR UPDATE
USING (
  auth.uid()::text = "salesExecutiveId" 
  OR
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::text 
    AND role IN ('ADMIN', 'MANAGER')
  )
);

-- DELETE: Owners OR Admins/Managers can delete
CREATE POLICY "tasks_delete" ON "tasks" FOR DELETE
USING (
  auth.uid()::text = "salesExecutiveId"
  OR
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::text 
    AND role IN ('ADMIN', 'MANAGER')
  )
);

-- Verification Output
SELECT 'Tasks Security policies applied successfully.' as result;
