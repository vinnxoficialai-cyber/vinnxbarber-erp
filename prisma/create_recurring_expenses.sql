-- ============================================================
-- Migration: Create recurring_expenses table for Contas a Pagar
-- Issue 6: New admin-only page for managing recurring bills
-- ============================================================

CREATE TABLE IF NOT EXISTS recurring_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(12, 2) NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    -- Categories: rent, utilities, subscriptions, taxes, insurance, salaries, other
    "dueDay" INTEGER NOT NULL DEFAULT 1,
    -- Day of month the bill is due (1-31)
    recurrence TEXT NOT NULL DEFAULT 'monthly',
    -- monthly, quarterly, annual
    status TEXT NOT NULL DEFAULT 'active',
    -- active, paused, cancelled
    "lastPaidAt" TIMESTAMPTZ,
    "lastPaidAmount" DECIMAL(12, 2),
    notes TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can access (admin check will be done in frontend)
DROP POLICY IF EXISTS "recurring_expenses_select" ON recurring_expenses;
CREATE POLICY "recurring_expenses_select" ON recurring_expenses
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recurring_expenses_insert" ON recurring_expenses;
CREATE POLICY "recurring_expenses_insert" ON recurring_expenses
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "recurring_expenses_update" ON recurring_expenses;
CREATE POLICY "recurring_expenses_update" ON recurring_expenses
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "recurring_expenses_delete" ON recurring_expenses;
CREATE POLICY "recurring_expenses_delete" ON recurring_expenses
    FOR DELETE TO authenticated USING (true);
