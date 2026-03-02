-- ============================================================
-- Migration: Add missing EventType enum values
-- Issue 3: Frontend uses event types not in the PostgreSQL enum
-- ============================================================
-- Current EventType: MEETING, CALL, PRESENTATION, DEADLINE, OTHER
-- Frontend needs: MEETING, WORK, PERSONAL, DEADLINE, DELIVERY, BLOCKED
-- Adding: PERSONAL, WORK, DELIVERY, BLOCKED

-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- Execute each statement separately in Supabase SQL Editor

ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'PERSONAL';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'WORK';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'DELIVERY';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'BLOCKED';
