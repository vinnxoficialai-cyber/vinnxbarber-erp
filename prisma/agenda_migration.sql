-- ============================================================
-- VINNX Barber — Agenda Enterprise: calendar_events expansion
-- Adds barber, service, and duration fields to enable:
--   - Column-per-professional Day View
--   - Drag-and-drop reassignment between barbers
--   - Service-linked duration auto-fill
-- ============================================================

-- 1. Add barberId (FK to team_members.id which is TEXT)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "barberId" TEXT;

-- 2. Add barberName (display cache)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "barberName" TEXT;

-- 3. Add serviceId (FK to services.id which is TEXT)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "serviceId" TEXT;

-- 4. Add serviceName (display cache)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "serviceName" TEXT;

-- 5. Add duration in minutes (default 30)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "duration" INT DEFAULT 30;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_barber ON calendar_events("barberId");
CREATE INDEX IF NOT EXISTS idx_calendar_events_service ON calendar_events("serviceId");
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_barber ON calendar_events("date", "barberId");

SELECT 'calendar_events agenda fields added successfully!' as result;
