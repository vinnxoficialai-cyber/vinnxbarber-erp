-- ============================================================
-- Migration: Create payroll_periods + weekly_checkins tables
-- Issue: Referenced in AppDataContext.tsx but never created
-- Run on BOTH original and clone Supabase projects
-- ============================================================

-- ============================================================
-- 1. PAYROLL_PERIODS (Períodos de Folha de Pagamento)
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    period TEXT NOT NULL,                    -- Formato YYYY-MM (ex: "2026-02")
    status TEXT NOT NULL DEFAULT 'open',     -- 'open' | 'closed'
    "closedAt" TIMESTAMPTZ,
    "closedBy" TEXT,                         -- user ID que fechou
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    UNIQUE(period)                          -- Apenas 1 período por mês
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payroll_periods_period ON payroll_periods(period DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);

-- RLS
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_periods_select" ON payroll_periods;
CREATE POLICY "payroll_periods_select" ON payroll_periods
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "payroll_periods_insert" ON payroll_periods;
CREATE POLICY "payroll_periods_insert" ON payroll_periods
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "payroll_periods_update" ON payroll_periods;
CREATE POLICY "payroll_periods_update" ON payroll_periods
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "payroll_periods_delete" ON payroll_periods;
CREATE POLICY "payroll_periods_delete" ON payroll_periods
    FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 2. WEEKLY_CHECKINS (Check-ins Semanais de Colaboradores)
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_checkins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "employeeId" TEXT NOT NULL,              -- FK para users.id / team_members.userId
    "periodStart" TEXT NOT NULL,             -- Data início da semana (YYYY-MM-DD)
    satisfaction INTEGER NOT NULL DEFAULT 3, -- 1 a 5
    highlights TEXT,                         -- Destaques da semana
    blockers TEXT,                           -- Bloqueios/Impedimentos
    "needHelp" TEXT,                         -- Onde precisa de ajuda
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT satisfaction_range CHECK (satisfaction >= 1 AND satisfaction <= 5)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_weekly_checkins_employee ON weekly_checkins("employeeId");
CREATE INDEX IF NOT EXISTS idx_weekly_checkins_period ON weekly_checkins("periodStart" DESC);

-- RLS
ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_checkins_select" ON weekly_checkins;
CREATE POLICY "weekly_checkins_select" ON weekly_checkins
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "weekly_checkins_insert" ON weekly_checkins;
CREATE POLICY "weekly_checkins_insert" ON weekly_checkins
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "weekly_checkins_update" ON weekly_checkins;
CREATE POLICY "weekly_checkins_update" ON weekly_checkins
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "weekly_checkins_delete" ON weekly_checkins;
CREATE POLICY "weekly_checkins_delete" ON weekly_checkins
    FOR DELETE TO authenticated USING (true);

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
SELECT 'payroll_periods created' AS result
UNION ALL
SELECT 'weekly_checkins created' AS result;
