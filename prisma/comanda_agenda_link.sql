-- ============================================================
-- VINNX Barber ERP — Comanda ↔ Agenda Link Migration
-- Connects scheduling (calendar_events) to orders (comandas)
-- ============================================================

-- 1. Add appointmentId to comandas (links comanda to its calendar_event)
ALTER TABLE comandas ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_comandas_appointment ON comandas("appointmentId") WHERE "appointmentId" IS NOT NULL;

-- 2. Add origin to comandas (where the comanda was created from)
ALTER TABLE comandas ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'manual';

-- 3. Add openedBy / closedBy (audit trail: who opened/closed the comanda)
ALTER TABLE comandas ADD COLUMN IF NOT EXISTS "openedBy" TEXT;
ALTER TABLE comandas ADD COLUMN IF NOT EXISTS "closedBy" TEXT;

-- 4. Add comandaId to calendar_events (reverse link from event to comanda)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "comandaId" TEXT;
CREATE INDEX IF NOT EXISTS idx_calendar_events_comanda ON calendar_events("comandaId") WHERE "comandaId" IS NOT NULL;
