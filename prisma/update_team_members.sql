-- ============================================
-- Update Team Members Table
-- Adds missing columns required by the application
-- ============================================

-- Add columns if they don't exist
DO $$
BEGIN
    -- contractType
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'contractType') THEN
        ALTER TABLE "team_members" ADD COLUMN "contractType" TEXT DEFAULT 'CLT';
    END IF;

    -- paymentPreference
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'paymentPreference') THEN
        ALTER TABLE "team_members" ADD COLUMN "paymentPreference" TEXT DEFAULT 'Mensal';
    END IF;

    -- pixKey
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'pixKey') THEN
        ALTER TABLE "team_members" ADD COLUMN "pixKey" TEXT;
    END IF;

    -- bankInfo
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'bankInfo') THEN
        ALTER TABLE "team_members" ADD COLUMN "bankInfo" JSONB;
    END IF;

    -- admissionDate
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'admissionDate') THEN
        ALTER TABLE "team_members" ADD COLUMN "admissionDate" TIMESTAMP(3);
    END IF;
END
$$;
