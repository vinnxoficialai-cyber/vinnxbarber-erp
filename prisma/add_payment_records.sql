-- ============================================
-- Payment Records Table
-- Stores payment history with status tracking
-- ============================================

-- Check if table exists before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_records') THEN
        CREATE TABLE "payment_records" (
            "id" TEXT NOT NULL,
            "employeeId" TEXT NOT NULL,
            "period" TEXT NOT NULL,
            "grossSalary" DECIMAL(12,2) NOT NULL,
            "netSalary" DECIMAL(12,2) NOT NULL,
            "inss" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "irrf" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "fgts" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "commissions" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "paidAt" TIMESTAMP(3),
            "paidBy" TEXT,
            "paymentMethod" TEXT,
            "transactionId" TEXT,
            "notes" TEXT,
            "receiptUrl" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
        );

        -- Index for faster queries by employee and period
        CREATE INDEX "payment_records_employeeId_idx" ON "payment_records"("employeeId");
        CREATE INDEX "payment_records_period_idx" ON "payment_records"("period");
        CREATE INDEX "payment_records_status_idx" ON "payment_records"("status");
    END IF;
END
$$;

-- ============================================
-- RLS Policies for payment_records
-- ============================================

-- Enable RLS
ALTER TABLE "payment_records" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "payment_records_select_policy" ON "payment_records";
DROP POLICY IF EXISTS "payment_records_insert_policy" ON "payment_records";
DROP POLICY IF EXISTS "payment_records_update_policy" ON "payment_records";
DROP POLICY IF EXISTS "payment_records_delete_policy" ON "payment_records";

-- Allow authenticated users to read all payment records
CREATE POLICY "payment_records_select_policy" ON "payment_records"
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert payment records
CREATE POLICY "payment_records_insert_policy" ON "payment_records"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update payment records
CREATE POLICY "payment_records_update_policy" ON "payment_records"
    FOR UPDATE
    TO authenticated
    USING (true);

-- Allow authenticated users to delete payment records
CREATE POLICY "payment_records_delete_policy" ON "payment_records"
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- NOTE: paymentDay is stored inside app_settings.financial JSONB field
-- NOT as a separate column. The frontend reads:
--   settings?.financial?.paymentDay
-- To update, use:
--   UPDATE app_settings
--   SET financial = jsonb_set(financial, '{paymentDay}', '5')
--   WHERE id = (SELECT id FROM app_settings LIMIT 1);
-- ============================================
