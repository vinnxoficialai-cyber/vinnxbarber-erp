-- ============================================================
-- VINNX Barber — Work Schedules (Expedientes)
-- Grade semanal de horários por barbeiro
-- ============================================================

CREATE TABLE IF NOT EXISTS work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "memberId" TEXT NOT NULL,
    "dayOfWeek" INT NOT NULL CHECK ("dayOfWeek" BETWEEN 0 AND 6),
    "startTime" TEXT,
    "endTime" TEXT,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "isOff" BOOLEAN DEFAULT false,
    "templateName" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("memberId", "dayOfWeek")
);

ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_schedules_select" ON work_schedules;
CREATE POLICY "work_schedules_select" ON work_schedules
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "work_schedules_insert" ON work_schedules;
CREATE POLICY "work_schedules_insert" ON work_schedules
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "work_schedules_update" ON work_schedules;
CREATE POLICY "work_schedules_update" ON work_schedules
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "work_schedules_delete" ON work_schedules;
CREATE POLICY "work_schedules_delete" ON work_schedules
    FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_work_schedules_member ON work_schedules("memberId");
CREATE INDEX IF NOT EXISTS idx_work_schedules_day ON work_schedules("dayOfWeek");

SELECT 'Work schedules table created successfully!' as result;
